package chain

import (
	"context"
	"fmt"

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

func (c *Client) Close() {
	c.eth.Close()
}
