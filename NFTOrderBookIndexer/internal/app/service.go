package app

import (
	"context"
	"fmt"
	"time"

	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/store"
)

func CheckDependencies(ctx context.Context, cfg *config.Config) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	db, err := store.OpenDB(cfg.DB)
	if err != nil {
		return fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping mysql: %w", err)
	}

	redisClient := store.OpenRedis(cfg.Redis)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("ping redis: %w", err)
	}

	return nil
}
