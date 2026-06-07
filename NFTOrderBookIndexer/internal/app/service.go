package app

import (
	"context"
	"fmt"
	"time"

	"nft-orderbook-indexer/internal/chain"
	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/indexer"
	"nft-orderbook-indexer/internal/store"
)

type DependencyStatus struct {
	CurrentBlock uint64
}

type RunResult struct {
	CurrentBlock uint64
	Batch        *indexer.BatchResult
}

func CheckDependencies(ctx context.Context, cfg *config.Config) (*DependencyStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	db, err := store.OpenDB(cfg.DB)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping mysql: %w", err)
	}

	redisClient := store.OpenRedis(cfg.Redis)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	chainClient, err := chain.Dial(ctx, cfg.Chain)
	if err != nil {
		return nil, fmt.Errorf("connect chain rpc: %w", err)
	}
	defer chainClient.Close()

	currentBlock, err := chainClient.CurrentBlock(ctx)
	if err != nil {
		return nil, fmt.Errorf("get current block: %w", err)
	}

	return &DependencyStatus{
		CurrentBlock: currentBlock,
	}, nil
}

func RunCheckpointBatch(ctx context.Context, cfg *config.Config) (*RunResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	db, err := store.OpenDB(cfg.DB)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping mysql: %w", err)
	}

	redisClient := store.OpenRedis(cfg.Redis)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	chainClient, err := chain.Dial(ctx, cfg.Chain)
	if err != nil {
		return nil, fmt.Errorf("connect chain rpc: %w", err)
	}
	defer chainClient.Close()

	currentBlock, err := chainClient.CurrentBlock(ctx)
	if err != nil {
		return nil, fmt.Errorf("get current block: %w", err)
	}

	idx := indexer.New(cfg, db, chainClient)
	batch, err := idx.SyncNextBatch(ctx)
	if err != nil {
		return nil, err
	}

	return &RunResult{
		CurrentBlock: currentBlock,
		Batch:        batch,
	}, nil
}
