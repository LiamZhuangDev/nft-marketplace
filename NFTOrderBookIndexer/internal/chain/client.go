package chain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	"nft-orderbook-indexer/internal/config"
)

type Client struct {
	eth *ethclient.Client
}

func Dial(ctx context.Context, cfg config.ChainConfig) (*Client, error) {
	eth, err := ethclient.DialContext(ctx, cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc %q: %w", cfg.RPCURL, err)
	}

	return &Client{eth: eth}, nil
}

func (c *Client) CurrentBlock(ctx context.Context) (uint64, error) {
	return c.eth.BlockNumber(ctx)
}

func (c *Client) FilterLogs(ctx context.Context, fromBlock, toBlock uint64, address string) ([]types.Log, error) {
	query := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Addresses: []common.Address{common.HexToAddress(address)},
	}

	return c.eth.FilterLogs(ctx, query)
}

func (c *Client) Close() {
	c.eth.Close()
}
