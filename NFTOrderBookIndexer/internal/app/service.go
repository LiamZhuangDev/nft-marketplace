package app

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"nft-orderbook-indexer/internal/chain"
	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/indexer"
	"nft-orderbook-indexer/internal/model"
	"nft-orderbook-indexer/internal/store"
)

type RuntimeDependencies struct {
	DB    *sql.DB
	Redis *redis.Client
	Chain *chain.Client
}

type RunResult struct {
	Batch                      *indexer.BatchResult
	OrderExpiryEventsProcessed int
	OrdersExpired              int
	FloorPriceEventsProcessed  int
}

type BackgroundWorkResult struct {
	OrderExpiryEventsProcessed int
	OrdersExpired              int
	FloorPriceEventsProcessed  int
}

type FloorPriceQueue interface {
	Enqueue(ctx context.Context, event model.FloorPriceEvent) error
	Dequeue(ctx context.Context) (*model.FloorPriceEvent, bool, error)
}

type OrderExpiryQueue interface {
	DequeueDue(ctx context.Context, now uint64) (*model.OrderExpiryEvent, bool, error)
}

type OrderbookStore interface {
	ExpireOrder(ctx context.Context, event model.OrderExpiryEvent, now uint64) (*model.Order, bool, error)
	UpdateCollectionFloorPrice(ctx context.Context, event model.FloorPriceEvent) error
}

func (d *RuntimeDependencies) Close() {
	if d.Chain != nil {
		d.Chain.Close()
	}
	if d.Redis != nil {
		_ = d.Redis.Close()
	}
	if d.DB != nil {
		_ = d.DB.Close()
	}
}

func CheckDependencies(ctx context.Context, cfg *config.Config) (*RuntimeDependencies, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	deps := &RuntimeDependencies{}

	db, err := store.OpenDB(cfg.DB)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	deps.DB = db

	if err := db.PingContext(ctx); err != nil {
		deps.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}

	redisClient := store.OpenRedis(cfg.Redis)
	deps.Redis = redisClient

	if err := redisClient.Ping(ctx).Err(); err != nil {
		deps.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	chainClient, err := chain.Dial(ctx, cfg.Chain)
	if err != nil {
		deps.Close()
		return nil, fmt.Errorf("connect chain rpc: %w", err)
	}
	deps.Chain = chainClient

	return deps, nil
}

func RunCheckpointBatch(ctx context.Context, cfg *config.Config) (*RunResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	deps, err := CheckDependencies(ctx, cfg)
	if err != nil {
		return nil, err
	}
	defer deps.Close()

	batch, err := runIndexerBatch(ctx, cfg, deps)
	if err != nil {
		return nil, err
	}

	backgroundWork, err := processBackgroundWork(ctx, deps)
	if err != nil {
		return nil, err
	}

	return &RunResult{
		Batch:                      batch,
		OrderExpiryEventsProcessed: backgroundWork.OrderExpiryEventsProcessed,
		OrdersExpired:              backgroundWork.OrdersExpired,
		FloorPriceEventsProcessed:  backgroundWork.FloorPriceEventsProcessed,
	}, nil
}

func runIndexerBatch(ctx context.Context, cfg *config.Config, deps *RuntimeDependencies) (*indexer.BatchResult, error) {
	floorPriceQueue := store.NewFloorPriceQueue(deps.Redis)
	orderExpiryQueue := store.NewOrderExpiryQueue(deps.Redis)
	checkpointStore := store.NewCheckpointStore(deps.DB)
	orderbookStore := store.NewOrderbookStore(deps.DB)
	idx, err := indexer.New(cfg, deps.Chain, checkpointStore, orderbookStore, floorPriceQueue, orderExpiryQueue)
	if err != nil {
		return nil, fmt.Errorf("create indexer: %w", err)
	}
	batch, err := idx.SyncNextBatch(ctx)
	if err != nil {
		return nil, err
	}

	return batch, nil
}

func processBackgroundWork(ctx context.Context, deps *RuntimeDependencies) (*BackgroundWorkResult, error) {
	floorPriceQueue := store.NewFloorPriceQueue(deps.Redis)
	orderExpiryQueue := store.NewOrderExpiryQueue(deps.Redis)
	orderbookStore := store.NewOrderbookStore(deps.DB)
	orderExpiryEventsProcessed, ordersExpired, err := ProcessOrderExpiryEvents(ctx, orderExpiryQueue, floorPriceQueue, orderbookStore, 100)
	if err != nil {
		return nil, err
	}
	floorPriceEventsProcessed, err := ProcessFloorPriceEvents(ctx, floorPriceQueue, orderbookStore, 100)
	if err != nil {
		return nil, err
	}

	return &BackgroundWorkResult{
		OrderExpiryEventsProcessed: orderExpiryEventsProcessed,
		OrdersExpired:              ordersExpired,
		FloorPriceEventsProcessed:  floorPriceEventsProcessed,
	}, nil
}

func ProcessOrderExpiryEvents(ctx context.Context, expiryQueue OrderExpiryQueue, floorPriceQueue FloorPriceQueue, orderbook OrderbookStore, limit int) (int, int, error) {
	processed := 0
	expired := 0
	now := uint64(time.Now().Unix())
	for processed < limit {
		event, ok, err := expiryQueue.DequeueDue(ctx, now)
		if err != nil {
			return processed, expired, err
		}
		if !ok {
			return processed, expired, nil
		}
		processed++

		order, didExpire, err := orderbook.ExpireOrder(ctx, *event, now)
		if err != nil {
			return processed, expired, err
		}
		if !didExpire {
			continue
		}

		expired++
		if order.OrderType != "listing" {
			continue
		}

		if err := floorPriceQueue.Enqueue(ctx, model.FloorPriceEvent{
			ChainID:           order.ChainID,
			CollectionAddress: order.CollectionAddress,
			Reason:            "order_expired",
		}); err != nil {
			return processed, expired, err
		}
	}
	return processed, expired, nil
}

func ProcessFloorPriceEvents(ctx context.Context, queue FloorPriceQueue, orderbook OrderbookStore, limit int) (int, error) {
	processed := 0
	for processed < limit {
		event, ok, err := queue.Dequeue(ctx)
		if err != nil {
			return processed, err
		}
		if !ok {
			return processed, nil
		}

		if err := orderbook.UpdateCollectionFloorPrice(ctx, *event); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}
