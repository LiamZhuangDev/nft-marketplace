package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"

	"nft-orderbook-indexer/internal/model"
)

const OrderExpiryQueueKey = "nft-orderbook-indexer:order-expiries"

type OrderExpiryQueue struct {
	redis *redis.Client
}

func NewOrderExpiryQueue(redisClient *redis.Client) *OrderExpiryQueue {
	return &OrderExpiryQueue{redis: redisClient}
}

func (q *OrderExpiryQueue) Schedule(ctx context.Context, event model.OrderExpiryEvent) error {
	if event.ExpireTime == 0 {
		return nil
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal order expiry event: %w", err)
	}

	if err := q.redis.ZAdd(ctx, OrderExpiryQueueKey, redis.Z{
		Score:  float64(event.ExpireTime),
		Member: payload,
	}).Err(); err != nil {
		return fmt.Errorf("schedule order expiry event: %w", err)
	}
	return nil
}

func (q *OrderExpiryQueue) DequeueDue(ctx context.Context, now uint64) (*model.OrderExpiryEvent, bool, error) {
	items, err := q.redis.ZRangeArgs(ctx, redis.ZRangeArgs{
		Key:     OrderExpiryQueueKey,
		Start:   "-inf",
		Stop:    fmt.Sprintf("%d", now),
		ByScore: true,
		Offset:  0,
		Count:   1,
	}).Result()
	if err != nil {
		return nil, false, fmt.Errorf("query due order expiry events: %w", err)
	}
	if len(items) == 0 {
		return nil, false, nil
	}

	if err := q.redis.ZRem(ctx, OrderExpiryQueueKey, items[0]).Err(); err != nil {
		return nil, false, fmt.Errorf("remove due order expiry event: %w", err)
	}

	var event model.OrderExpiryEvent
	if err := json.Unmarshal([]byte(items[0]), &event); err != nil {
		return nil, false, fmt.Errorf("unmarshal order expiry event: %w", err)
	}
	return &event, true, nil
}
