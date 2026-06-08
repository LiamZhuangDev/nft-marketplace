package indexer

import (
	"context"
	"database/sql"
	"fmt"

	"nft-orderbook-indexer/internal/chain"
	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/store"
)

type Service struct {
	cfg        *config.Config
	chain      *chain.Client
	checkpoint *store.CheckpointStore
	orderbook  *store.OrderbookStore
	events     *eventDecoder
}

type BatchResult struct {
	FromBlock         uint64
	ToBlock           uint64
	NextBlock         uint64
	CurrentBlock      uint64
	SafeBlock         uint64
	LogCount          int
	OrderCreatedCount int
	NoBlocksReady     bool // No safe block to index as one of these two reasons: current block is not far enough ahead or checkpoint is already ahead of the safe block
}

func New(cfg *config.Config, db *sql.DB, chainClient *chain.Client) (*Service, error) {
	events, err := newEventDecoder()
	if err != nil {
		return nil, err
	}

	return &Service{
		cfg:        cfg,
		chain:      chainClient,
		checkpoint: store.NewCheckpointStore(db),
		orderbook:  store.NewOrderbookStore(db),
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
	for _, log := range logs {
		if !s.events.IsOrderCreated(log) {
			continue
		}

		record, err := s.events.DecodeOrderCreated(log, s.cfg.Chain.ID)
		if err != nil {
			return nil, fmt.Errorf("decode OrderCreated tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
		}

		if err := s.orderbook.SaveOrderCreated(ctx, record.order, record.item, record.activity); err != nil {
			return nil, fmt.Errorf("save OrderCreated tx=%s index=%d: %w", log.TxHash.Hex(), log.Index, err)
		}
		orderCreatedCount++
	}

	nextBlock := toBlock + 1
	if err := s.checkpoint.SaveLastIndexedBlock(ctx, s.cfg.Chain.ID, nextBlock); err != nil {
		return nil, err
	}

	return &BatchResult{
		FromBlock:         fromBlock,
		ToBlock:           toBlock,
		NextBlock:         nextBlock,
		CurrentBlock:      currentBlock,
		SafeBlock:         safeBlock,
		LogCount:          len(logs),
		OrderCreatedCount: orderCreatedCount,
	}, nil
}
