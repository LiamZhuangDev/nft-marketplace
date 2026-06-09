package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"nft-orderbook-indexer/internal/model"
)

type OrderbookStore struct {
	db *sql.DB
}

const zeroAddress = "0x0000000000000000000000000000000000000000"

func NewOrderbookStore(db *sql.DB) *OrderbookStore {
	return &OrderbookStore{db: db}
}

func (s *OrderbookStore) SaveOrderCreated(ctx context.Context, order model.Order, item model.Item) error {
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

	activity := model.Activity{
		ChainID:           order.ChainID,
		OrderType:         order.OrderType,
		OrderID:           order.OrderID,
		CounterOrderID:    "",
		CollectionAddress: order.CollectionAddress,
		TokenID:           order.TokenID,
		Maker:             order.Maker,
		Taker:             zeroAddress,
		Price:             order.Price,
		BlockNumber:       order.BlockNumber,
		TxHash:            order.TxHash,
		LogIndex:          order.LogIndex,
	}

	if err := insertActivity(ctx, tx, activity); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit OrderCreated tx: %w", err)
	}
	return nil
}

func (s *OrderbookStore) SaveOrderCancelled(ctx context.Context, event model.OrderCancelled) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	order, err := getOrderForUpdate(ctx, tx, event.ChainID, event.OrderID)
	if err != nil {
		return err
	}

	if err := updateOrderCancelled(ctx, tx, event); err != nil {
		return err
	}

	if order.OrderType == "listing" {
		if err := clearItemListing(ctx, tx, *order); err != nil {
			return err
		}
	}

	activity := model.Activity{
		ChainID:           event.ChainID,
		OrderType:         "order_cancelled",
		OrderID:           event.OrderID,
		CounterOrderID:    "",
		CollectionAddress: order.CollectionAddress,
		TokenID:           order.TokenID,
		Maker:             event.Maker,
		Taker:             zeroAddress,
		Price:             order.Price,
		BlockNumber:       event.BlockNumber,
		TxHash:            event.TxHash,
		LogIndex:          event.LogIndex,
	}
	if err := insertActivity(ctx, tx, activity); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit OrderCancelled tx: %w", err)
	}
	return nil
}

func (s *OrderbookStore) SaveOrderMatched(ctx context.Context, event model.OrderMatched) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if err := fillListingOrder(ctx, tx, event); err != nil {
		return err
	}
	if err := reduceOfferOrderIfExists(ctx, tx, event); err != nil {
		return err
	}
	if err := upsertItemOnMatch(ctx, tx, event); err != nil {
		return err
	}

	// If seller accepts an offer, then the maker is the buyer and the taker is the seller
	maker := event.Offer.Maker
	orderID := event.OfferOrderID
	counterOrderID := event.ListingOrderID
	// If buyer accepts a listing, then the maker is the seller and the taker is the buyer
	if event.Taker == event.Offer.Maker {
		maker = event.Listing.Maker
		orderID = event.ListingOrderID
		counterOrderID = event.OfferOrderID
	}
	activity := model.Activity{
		ChainID:           event.ChainID,
		OrderType:         "order_matched",
		OrderID:           orderID,
		CounterOrderID:    counterOrderID,
		CollectionAddress: event.Listing.CollectionAddress,
		TokenID:           event.Listing.TokenID,
		Maker:             maker,
		Taker:             event.Taker,
		Price:             event.FillPrice,
		BlockNumber:       event.BlockNumber,
		TxHash:            event.TxHash,
		LogIndex:          event.LogIndex,
	}
	if err := insertActivity(ctx, tx, activity); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit OrderMatched tx: %w", err)
	}
	return nil
}

func insertOrder(ctx context.Context, tx *sql.Tx, order model.Order) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO nft_orders (
			chain_id, order_id, order_status, order_type, collection_address, token_id,
			maker, price, quantity_remaining, size, expire_time, salt,
			block_number, tx_hash, log_index
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			order_status = VALUES(order_status),
			order_type = VALUES(order_type),
			collection_address = VALUES(collection_address),
			token_id = VALUES(token_id),
			maker = VALUES(maker),
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

func fillListingOrder(ctx context.Context, tx *sql.Tx, event model.OrderMatched) error {
	_, err := tx.ExecContext(
		ctx,
		`UPDATE nft_orders
		 SET order_status = ?,
		     quantity_remaining = 0,
		     block_number = ?,
		     tx_hash = ?,
		     log_index = ?
		 WHERE chain_id = ? AND order_id = ?`,
		"filled",
		event.BlockNumber,
		event.TxHash,
		event.LogIndex,
		event.ChainID,
		event.ListingOrderID,
	)
	if err != nil {
		return fmt.Errorf("fill listing order %s: %w", event.ListingOrderID, err)
	}
	return nil
}

func reduceOfferOrderIfExists(ctx context.Context, tx *sql.Tx, event model.OrderMatched) error {
	_, err := tx.ExecContext(
		ctx,
		`UPDATE nft_orders
		 SET quantity_remaining = CASE
		       WHEN quantity_remaining <= ? THEN 0
		       ELSE quantity_remaining - ?
		     END,
		     order_status = CASE
		       WHEN quantity_remaining <= ? THEN ?
		       ELSE order_status
		     END,
		     block_number = ?,
		     tx_hash = ?,
		     log_index = ?
		 WHERE chain_id = ? AND order_id = ?`,
		event.Listing.Amount,
		event.Listing.Amount,
		event.Listing.Amount,
		"filled",
		event.BlockNumber,
		event.TxHash,
		event.LogIndex,
		event.ChainID,
		event.OfferOrderID,
	)
	if err != nil {
		return fmt.Errorf("reduce offer order %s: %w", event.OfferOrderID, err)
	}
	return nil
}

func upsertItemOnMatch(ctx context.Context, tx *sql.Tx, event model.OrderMatched) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO nft_items (
			chain_id, collection_address, token_id, owner, supply, list_price, list_time
		) VALUES (?, ?, ?, ?, ?, NULL, NULL)
		ON DUPLICATE KEY UPDATE
			owner = VALUES(owner),
			supply = VALUES(supply),
			list_price = NULL,
			list_time = NULL`,
		event.ChainID,
		event.Listing.CollectionAddress,
		event.Listing.TokenID,
		event.Offer.Maker,
		event.Listing.Amount,
	)
	if err != nil {
		return fmt.Errorf("upsert item on match %s/%s: %w", event.Listing.CollectionAddress, event.Listing.TokenID, err)
	}
	return nil
}

func getOrderForUpdate(ctx context.Context, tx *sql.Tx, chainID int64, orderID string) (*model.Order, error) {
	var order model.Order
	err := tx.QueryRowContext(
		ctx,
		`SELECT
			chain_id, order_id, order_status, order_type, collection_address, token_id,
			maker, price, quantity_remaining, size, expire_time, salt,
			block_number, tx_hash, log_index
		FROM nft_orders
		WHERE chain_id = ? AND order_id = ?
		FOR UPDATE`,
		chainID,
		orderID,
	).Scan(
		&order.ChainID,
		&order.OrderID,
		&order.OrderStatus,
		&order.OrderType,
		&order.CollectionAddress,
		&order.TokenID,
		&order.Maker,
		&order.Price,
		&order.QuantityRemaining,
		&order.Size,
		&order.ExpireTime,
		&order.Salt,
		&order.BlockNumber,
		&order.TxHash,
		&order.LogIndex,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("cancelled order %s not found", orderID)
	}
	if err != nil {
		return nil, fmt.Errorf("query order %s for update: %w", orderID, err)
	}
	return &order, nil
}

func updateOrderCancelled(ctx context.Context, tx *sql.Tx, event model.OrderCancelled) error {
	_, err := tx.ExecContext(
		ctx,
		`UPDATE nft_orders
		 SET order_status = ?,
		     quantity_remaining = 0,
		     block_number = ?,
		     tx_hash = ?,
		     log_index = ?
		 WHERE chain_id = ? AND order_id = ?`,
		"cancelled",
		event.BlockNumber,
		event.TxHash,
		event.LogIndex,
		event.ChainID,
		event.OrderID,
	)
	if err != nil {
		return fmt.Errorf("update order %s cancelled: %w", event.OrderID, err)
	}
	return nil
}

func clearItemListing(ctx context.Context, tx *sql.Tx, order model.Order) error {
	_, err := tx.ExecContext(
		ctx,
		`UPDATE nft_items
		 SET list_price = NULL,
		     list_time = NULL
		 WHERE chain_id = ? AND collection_address = ? AND token_id = ?`,
		order.ChainID,
		order.CollectionAddress,
		order.TokenID,
	)
	if err != nil {
		return fmt.Errorf("clear item listing %s/%s: %w", order.CollectionAddress, order.TokenID, err)
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
			chain_id, activity_type, order_id, counter_order_id, collection_address, token_id,
			maker, taker, price, block_number, tx_hash, log_index
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			order_id = VALUES(order_id),
			counter_order_id = VALUES(counter_order_id),
			collection_address = VALUES(collection_address),
			token_id = VALUES(token_id),
			maker = VALUES(maker),
			taker = VALUES(taker),
			price = VALUES(price),
			block_number = VALUES(block_number)`,
		activity.ChainID,
		activity.OrderType,
		activity.OrderID,
		activity.CounterOrderID,
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
