package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"

	"nft-orderbook-indexer/internal/model"
)

const FloorPriceQueueKey = "nft-orderbook-indexer:floor-price-events"

type FloorPriceQueue struct {
	redis *redis.Client
}

func NewFloorPriceQueue(redisClient *redis.Client) *FloorPriceQueue {
	return &FloorPriceQueue{redis: redisClient}
}

func (q *FloorPriceQueue) Enqueue(ctx context.Context, event model.FloorPriceEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal floor price event: %w", err)
	}

	if err := q.redis.RPush(ctx, FloorPriceQueueKey, payload).Err(); err != nil {
		return fmt.Errorf("enqueue floor price event: %w", err)
	}
	return nil
}

func (q *FloorPriceQueue) Dequeue(ctx context.Context) (*model.FloorPriceEvent, bool, error) {
	payload, err := q.redis.LPop(ctx, FloorPriceQueueKey).Result()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("dequeue floor price event: %w", err)
	}

	var event model.FloorPriceEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		return nil, false, fmt.Errorf("unmarshal floor price event: %w", err)
	}
	return &event, true, nil
}
