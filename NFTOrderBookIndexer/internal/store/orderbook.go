package store

import (
	"context"
	"database/sql"
	"fmt"

	"nft-orderbook-indexer/internal/model"
)

type OrderbookStore struct {
	db *sql.DB
}

func NewOrderbookStore(db *sql.DB) *OrderbookStore {
	return &OrderbookStore{db: db}
}

func (s *OrderbookStore) SaveOrderCreated(ctx context.Context, order model.Order, item model.Item, activity model.Activity) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if err := insertOrder(ctx, tx, order); err != nil {
		return err
	}
	if err := upsertItemOnListing(ctx, tx, item); err != nil {
		return err
	}
	if err := insertActivity(ctx, tx, activity); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit OrderCreated tx: %w", err)
	}
	return nil
}

func insertOrder(ctx context.Context, tx *sql.Tx, order model.Order) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO nft_orders (
			chain_id, order_id, order_status, order_type, collection_address, token_id,
			maker, taker, price, quantity_remaining, size, expire_time, salt,
			block_number, tx_hash, log_index
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			order_status = VALUES(order_status),
			order_type = VALUES(order_type),
			collection_address = VALUES(collection_address),
			token_id = VALUES(token_id),
			maker = VALUES(maker),
			taker = VALUES(taker),
			price = VALUES(price),
			quantity_remaining = VALUES(quantity_remaining),
			size = VALUES(size),
			expire_time = VALUES(expire_time),
			salt = VALUES(salt),
			block_number = VALUES(block_number),
			tx_hash = VALUES(tx_hash),
			log_index = VALUES(log_index)`,
		order.ChainID,
		order.OrderID,
		order.OrderStatus,
		order.OrderType,
		order.CollectionAddress,
		order.TokenID,
		order.Maker,
		order.Taker,
		order.Price,
		order.QuantityRemaining,
		order.Size,
		order.ExpireTime,
		order.Salt,
		order.BlockNumber,
		order.TxHash,
		order.LogIndex,
	)
	if err != nil {
		return fmt.Errorf("insert order %s: %w", order.OrderID, err)
	}
	return nil
}

func upsertItemOnListing(ctx context.Context, tx *sql.Tx, item model.Item) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO nft_items (
			chain_id, collection_address, token_id, owner, supply, list_price, list_time
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			owner = VALUES(owner),
			supply = VALUES(supply),
			list_price = VALUES(list_price),
			list_time = VALUES(list_time)`,
		item.ChainID,
		item.CollectionAddress,
		item.TokenID,
		item.Owner,
		item.Supply,
		item.ListPrice,
		item.ListTime,
	)
	if err != nil {
		return fmt.Errorf("upsert item %s/%s: %w", item.CollectionAddress, item.TokenID, err)
	}
	return nil
}

func insertActivity(ctx context.Context, tx *sql.Tx, activity model.Activity) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO nft_activities (
			chain_id, activity_type, order_id, collection_address, token_id,
			maker, taker, price, block_number, tx_hash, log_index
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			order_id = VALUES(order_id),
			collection_address = VALUES(collection_address),
			token_id = VALUES(token_id),
			maker = VALUES(maker),
			taker = VALUES(taker),
			price = VALUES(price),
			block_number = VALUES(block_number)`,
		activity.ChainID,
		activity.ActivityType,
		activity.OrderID,
		activity.CollectionAddress,
		activity.TokenID,
		activity.Maker,
		activity.Taker,
		activity.Price,
		activity.BlockNumber,
		activity.TxHash,
		activity.LogIndex,
	)
	if err != nil {
		return fmt.Errorf("insert activity %s/%d: %w", activity.TxHash, activity.LogIndex, err)
	}
	return nil
}
