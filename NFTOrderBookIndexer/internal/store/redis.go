package store

import (
	"github.com/redis/go-redis/v9"

	"nft-orderbook-indexer/internal/config"
)

func OpenRedis(cfg config.RedisConfig) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     cfg.Host,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
}
