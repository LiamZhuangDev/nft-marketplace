package indexer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

const checkpointName = "orderbook_events"

type CheckpointStore struct {
	db *sql.DB
}

func NewCheckpointStore(db *sql.DB) *CheckpointStore {
	return &CheckpointStore{db: db}
}

func (s *CheckpointStore) LastIndexedBlock(ctx context.Context, chainID int64, startBlock uint64) (uint64, error) {
	var block uint64
	err := s.db.QueryRowContext(
		ctx,
		`SELECT last_indexed_block
		 FROM indexer_checkpoints
		 WHERE chain_id = ? AND indexer_name = ?`,
		chainID,
		checkpointName,
	).Scan(&block)
	if err == nil {
		return block, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("query checkpoint: %w", err)
	}

	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO indexer_checkpoints (chain_id, indexer_name, last_indexed_block)
		 VALUES (?, ?, ?)`,
		chainID,
		checkpointName,
		startBlock,
	); err != nil {
		return 0, fmt.Errorf("create checkpoint: %w", err)
	}

	return startBlock, nil
}

func (s *CheckpointStore) SaveLastIndexedBlock(ctx context.Context, chainID int64, nextBlock uint64) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE indexer_checkpoints
		 SET last_indexed_block = ?
		 WHERE chain_id = ? AND indexer_name = ?`,
		nextBlock,
		chainID,
		checkpointName,
	)
	if err != nil {
		return fmt.Errorf("update checkpoint: %w", err)
	}
	return nil
}
