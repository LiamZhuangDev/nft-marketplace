package indexer

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/core/types"

	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/model"
)

type Service struct {
	cfg        *config.Config
	chain      ChainReader
	checkpoint CheckpointStore
	orderbook  OrderbookStore
	floorPrice FloorPriceQueue
	expiry     OrderExpiryQueue
	events     *eventDecoder
}

type ChainReader interface {
	CurrentBlock(ctx context.Context) (uint64, error)
	FilterLogs(ctx context.Context, fromBlock, toBlock uint64, address string) ([]types.Log, error)
}

type CheckpointStore interface {
	LastIndexedBlock(ctx context.Context, chainID int64, defaultStart uint64) (uint64, error)
	SaveLastIndexedBlock(ctx context.Context, chainID int64, nextBlock uint64) error
}

type OrderbookStore interface {
	SaveOrderCreated(ctx context.Context, order model.Order, item model.Item) error
	SaveOrderCancelled(ctx context.Context, event model.OrderCancelled) (string, error)
	SaveOrderMatched(ctx context.Context, event model.OrderMatched) error
}

type FloorPriceQueue interface {
	Enqueue(ctx context.Context, event model.FloorPriceEvent) error
}

type OrderExpiryQueue interface {
	Schedule(ctx context.Context, event model.OrderExpiryEvent) error
}

type BatchResult struct {
	FromBlock             uint64
	ToBlock               uint64
	NextBlock             uint64
	CurrentBlock          uint64
	SafeBlock             uint64
	LogCount              int
	OrderCreatedCount     int
	OrderCancelledCount   int
	OrderMatchedCount     int
	FloorPriceEventCount  int
	OrderExpiryEventCount int
	NoBlocksReady         bool // No safe block to index as one of these two reasons: current block is not far enough ahead or checkpoint is already ahead of the safe block
}

func New(cfg *config.Config, chainClient ChainReader, checkpoint CheckpointStore, orderbook OrderbookStore, floorPrice FloorPriceQueue, expiry OrderExpiryQueue) (*Service, error) {
	events, err := newEventDecoder()
	if err != nil {
		return nil, err
	}

	return &Service{
		cfg:        cfg,
		chain:      chainClient,
		checkpoint: checkpoint,
		orderbook:  orderbook,
		floorPrice: floorPrice,
		expiry:     expiry,
		events:     events,
	}, nil
}

func (s *Service) SyncNextBatch(ctx context.Context) (*BatchResult, error) {
	currentBlock, err := s.chain.CurrentBlock(ctx)
	if err != nil {
		return nil, fmt.Errorf("get current block: %w", err)
	}

	if currentBlock <= s.cfg.Chain.SafeBlockConfirmations {
		return &BatchResult{
			CurrentBlock:  currentBlock,
			NoBlocksReady: true,
		}, nil
	}

	safeBlock := currentBlock - s.cfg.Chain.SafeBlockConfirmations
	fromBlock, err := s.checkpoint.LastIndexedBlock(ctx, s.cfg.Chain.ID, s.cfg.Chain.StartBlock)
	if err != nil {
		return nil, err
	}

	if fromBlock > safeBlock {
		return &BatchResult{
			FromBlock:     fromBlock,
			CurrentBlock:  currentBlock,
			SafeBlock:     safeBlock,
			NoBlocksReady: true,
		}, nil
	}

	toBlock := min(fromBlock+s.cfg.Chain.MaxBlockRange-1, safeBlock)

	logs, err := s.chain.FilterLogs(ctx, fromBlock, toBlock, s.cfg.Contract.OrderbookAddress)
	if err != nil {
		return nil, fmt.Errorf("fetch logs from %d to %d: %w", fromBlock, toBlock, err)
	}

	orderCreatedCount := 0
	orderCancelledCount := 0
	orderMatchedCount := 0
	floorPriceEventCount := 0
	orderExpiryEventCount := 0
	for _, log := range logs {
		if s.events.IsOrderCreated(log) {
			record, err := s.events.DecodeOrderCreated(log, s.cfg.Chain.ID)
			if err != nil {
				return nil, fmt.Errorf("decode OrderCreated tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}

			if err := s.orderbook.SaveOrderCreated(ctx, record.order, record.item); err != nil {
				return nil, fmt.Errorf("save OrderCreated tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			if err := s.enqueueFloorPriceEvent(ctx, record.order.CollectionAddress, "order_created"); err != nil {
				return nil, fmt.Errorf("enqueue floor price event tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			scheduled, err := s.scheduleOrderExpiry(ctx, record.order)
			if err != nil {
				return nil, fmt.Errorf("schedule order expiry tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			orderCreatedCount++
			floorPriceEventCount++
			if scheduled {
				orderExpiryEventCount++
			}
			continue
		}

		if s.events.IsOrderCancelled(log) {
			event, err := s.events.DecodeOrderCancelled(log, s.cfg.Chain.ID)
			if err != nil {
				return nil, fmt.Errorf("decode OrderCancelled tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}

			collectionAddress, err := s.orderbook.SaveOrderCancelled(ctx, *event)
			if err != nil {
				return nil, fmt.Errorf("save OrderCancelled tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			if err := s.enqueueFloorPriceEvent(ctx, collectionAddress, "order_cancelled"); err != nil {
				return nil, fmt.Errorf("enqueue floor price event tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			orderCancelledCount++
			floorPriceEventCount++
			continue
		}

		if s.events.IsOrderMatched(log) {
			event, err := s.events.DecodeOrderMatched(log, s.cfg.Chain.ID)
			if err != nil {
				return nil, fmt.Errorf("decode OrderMatched tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}

			if err := s.orderbook.SaveOrderMatched(ctx, *event); err != nil {
				return nil, fmt.Errorf("save OrderMatched tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			if err := s.enqueueFloorPriceEvent(ctx, event.Listing.CollectionAddress, "order_matched"); err != nil {
				return nil, fmt.Errorf("enqueue floor price event tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
			}
			orderMatchedCount++
			floorPriceEventCount++
		}
	}

	nextBlock := toBlock + 1
	if err := s.checkpoint.SaveLastIndexedBlock(ctx, s.cfg.Chain.ID, nextBlock); err != nil {
		return nil, err
	}

	return &BatchResult{
		FromBlock:             fromBlock,
		ToBlock:               toBlock,
		NextBlock:             nextBlock,
		CurrentBlock:          currentBlock,
		SafeBlock:             safeBlock,
		LogCount:              len(logs),
		OrderCreatedCount:     orderCreatedCount,
		OrderCancelledCount:   orderCancelledCount,
		OrderMatchedCount:     orderMatchedCount,
		FloorPriceEventCount:  floorPriceEventCount,
		OrderExpiryEventCount: orderExpiryEventCount,
	}, nil
}

func (s *Service) enqueueFloorPriceEvent(ctx context.Context, collectionAddress string, reason string) error {
	return s.floorPrice.Enqueue(ctx, model.FloorPriceEvent{
		ChainID:           s.cfg.Chain.ID,
		CollectionAddress: collectionAddress,
		Reason:            reason,
	})
}

func (s *Service) scheduleOrderExpiry(ctx context.Context, order model.Order) (bool, error) {
	if order.ExpireTime == 0 {
		return false, nil
	}

	return true, s.expiry.Schedule(ctx, model.OrderExpiryEvent{
		ChainID:    order.ChainID,
		OrderID:    order.OrderID,
		ExpireTime: order.ExpireTime,
	})
}
