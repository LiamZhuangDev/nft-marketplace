package indexer

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"nft-orderbook-indexer/internal/model"
)

const (
	sideList  uint8 = 0
	sideOffer uint8 = 1

	saleKindCollection uint8 = 0

	orderStatusActive    = "active"
	orderStatusCancelled = "cancelled"
	orderTypeListing     = "listing"
	orderTypeItemBid     = "item_bid"
	orderTypeCollBid     = "collection_bid"

	activityListing        = "listing"
	activityItemBid        = "item_bid"
	activityCollBid        = "collection_bid"
	activityOrderCancelled = "order_cancelled"
	activityOrderMatched   = "order_matched"

	zeroAddress = "0x0000000000000000000000000000000000000000"
)

const orderbookABI = `[
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "internalType": "OrderKey", "name": "listingOrderKey", "type": "bytes32"},
			{"indexed": true, "internalType": "OrderKey", "name": "offerOrderKey", "type": "bytes32"},
			{"indexed": true, "internalType": "address", "name": "taker", "type": "address"},
			{
				"components": [
					{"internalType": "uint8", "name": "side", "type": "uint8"},
					{"internalType": "uint8", "name": "saleKind", "type": "uint8"},
					{"internalType": "address", "name": "maker", "type": "address"},
					{
						"components": [
							{"internalType": "uint256", "name": "tokenId", "type": "uint256"},
							{"internalType": "address", "name": "collection", "type": "address"},
							{"internalType": "uint96", "name": "amount", "type": "uint96"}
						],
						"internalType": "struct Asset",
						"name": "nft",
						"type": "tuple"
					},
					{"internalType": "uint128", "name": "price", "type": "uint128"},
					{"internalType": "uint64", "name": "expiry", "type": "uint64"},
					{"internalType": "uint64", "name": "salt", "type": "uint64"}
				],
				"indexed": false,
				"internalType": "struct Order",
				"name": "listing",
				"type": "tuple"
			},
			{
				"components": [
					{"internalType": "uint8", "name": "side", "type": "uint8"},
					{"internalType": "uint8", "name": "saleKind", "type": "uint8"},
					{"internalType": "address", "name": "maker", "type": "address"},
					{
						"components": [
							{"internalType": "uint256", "name": "tokenId", "type": "uint256"},
							{"internalType": "address", "name": "collection", "type": "address"},
							{"internalType": "uint96", "name": "amount", "type": "uint96"}
						],
						"internalType": "struct Asset",
						"name": "nft",
						"type": "tuple"
					},
					{"internalType": "uint128", "name": "price", "type": "uint128"},
					{"internalType": "uint64", "name": "expiry", "type": "uint64"},
					{"internalType": "uint64", "name": "salt", "type": "uint64"}
				],
				"indexed": false,
				"internalType": "struct Order",
				"name": "offer",
				"type": "tuple"
			},
			{"indexed": false, "internalType": "uint128", "name": "fillPrice", "type": "uint128"}
		],
		"name": "OrderMatched",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "internalType": "OrderKey", "name": "orderKey", "type": "bytes32"},
			{"indexed": true, "internalType": "address", "name": "maker", "type": "address"}
		],
		"name": "OrderCancelled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": false, "internalType": "OrderKey", "name": "orderKey", "type": "bytes32"},
			{"indexed": true, "internalType": "uint8", "name": "side", "type": "uint8"},
			{"indexed": true, "internalType": "uint8", "name": "saleKind", "type": "uint8"},
			{"indexed": true, "internalType": "address", "name": "maker", "type": "address"},
			{
				"components": [
					{"internalType": "uint256", "name": "tokenId", "type": "uint256"},
					{"internalType": "address", "name": "collection", "type": "address"},
					{"internalType": "uint96", "name": "amount", "type": "uint96"}
				],
				"indexed": false,
				"internalType": "struct Asset",
				"name": "nft",
				"type": "tuple"
			},
			{"indexed": false, "internalType": "uint128", "name": "price", "type": "uint128"},
			{"indexed": false, "internalType": "uint64", "name": "expiry", "type": "uint64"},
			{"indexed": false, "internalType": "uint64", "name": "salt", "type": "uint64"}
		],
		"name": "OrderCreated",
		"type": "event"
	}
]`

type eventDecoder struct {
	abi                 abi.ABI
	orderCreatedTopic   common.Hash
	orderCancelledTopic common.Hash
	orderMatchedTopic   common.Hash
}

type orderCreatedData struct {
	OrderKey [32]byte
	Nft      struct {
		TokenID    *big.Int       `abi:"tokenId"`
		Collection common.Address `abi:"collection"`
		Amount     *big.Int       `abi:"amount"`
	}
	Price  *big.Int
	Expiry uint64
	Salt   uint64
}

type orderCreatedRecord struct {
	order    model.Order
	item     model.Item
	activity model.Activity
}

type orderMatchedData struct {
	Listing   abiOrder `abi:"listing"`
	Offer     abiOrder `abi:"offer"`
	FillPrice *big.Int `abi:"fillPrice"`
}

type abiOrder struct {
	Side     uint8
	SaleKind uint8
	Maker    common.Address
	Nft      abiAsset
	Price    *big.Int
	Expiry   uint64
	Salt     uint64
}

type abiAsset struct {
	TokenID    *big.Int       `abi:"tokenId"`
	Collection common.Address `abi:"collection"`
	Amount     *big.Int       `abi:"amount"`
}

func newEventDecoder() (*eventDecoder, error) {
	parsed, err := abi.JSON(strings.NewReader(orderbookABI))
	if err != nil {
		return nil, fmt.Errorf("parse orderbook ABI: %w", err)
	}

	return &eventDecoder{
		abi:                 parsed,
		orderCreatedTopic:   parsed.Events["OrderCreated"].ID,
		orderCancelledTopic: parsed.Events["OrderCancelled"].ID,
		orderMatchedTopic:   parsed.Events["OrderMatched"].ID,
	}, nil
}

func (d *eventDecoder) IsOrderCreated(log types.Log) bool {
	return len(log.Topics) > 0 && log.Topics[0] == d.orderCreatedTopic
}

func (d *eventDecoder) IsOrderCancelled(log types.Log) bool {
	return len(log.Topics) > 0 && log.Topics[0] == d.orderCancelledTopic
}

func (d *eventDecoder) IsOrderMatched(log types.Log) bool {
	return len(log.Topics) > 0 && log.Topics[0] == d.orderMatchedTopic
}

func (d *eventDecoder) DecodeOrderCreated(log types.Log, chainID int64) (*orderCreatedRecord, error) {
	if len(log.Topics) < 4 {
		return nil, fmt.Errorf("OrderCreated has %d topics, expected at least 4", len(log.Topics))
	}

	var data orderCreatedData
	if err := d.abi.UnpackIntoInterface(&data, "OrderCreated", log.Data); err != nil {
		return nil, fmt.Errorf("unpack OrderCreated data: %w", err)
	}

	side := uint8(new(big.Int).SetBytes(log.Topics[1].Bytes()).Uint64())
	saleKind := uint8(new(big.Int).SetBytes(log.Topics[2].Bytes()).Uint64())
	maker := common.BytesToAddress(log.Topics[3].Bytes()).Hex()

	orderType, activityType := classifyMake(side, saleKind)
	orderID := "0x" + hex.EncodeToString(data.OrderKey[:])
	tokenID := data.Nft.TokenID.String()
	collection := data.Nft.Collection.Hex()
	amount := data.Nft.Amount.Uint64()
	price := data.Price.String()

	order := model.Order{
		ChainID:           chainID,
		OrderID:           orderID,
		OrderStatus:       orderStatusActive,
		OrderType:         orderType,
		CollectionAddress: collection,
		TokenID:           tokenID,
		Maker:             maker,
		Price:             price,
		QuantityRemaining: amount,
		Size:              amount,
		ExpireTime:        data.Expiry,
		Salt:              data.Salt,
		BlockNumber:       log.BlockNumber,
		TxHash:            log.TxHash.Hex(),
		LogIndex:          log.Index,
	}

	item := model.Item{
		ChainID:           chainID,
		CollectionAddress: collection,
		TokenID:           tokenID,
		Owner:             maker,
		Supply:            amount,
		ListPrice:         price,
		ListTime:          log.BlockNumber,
	}

	activity := model.Activity{
		ChainID:           chainID,
		ActivityType:      activityType,
		OrderID:           orderID,
		CollectionAddress: collection,
		TokenID:           tokenID,
		Maker:             maker,
		Taker:             zeroAddress,
		Price:             price,
		BlockNumber:       log.BlockNumber,
		TxHash:            log.TxHash.Hex(),
		LogIndex:          log.Index,
	}

	return &orderCreatedRecord{
		order:    order,
		item:     item,
		activity: activity,
	}, nil
}

func (d *eventDecoder) DecodeOrderCancelled(log types.Log, chainID int64) (*model.OrderCancelled, error) {
	if len(log.Topics) < 3 {
		return nil, fmt.Errorf("OrderCancelled has %d topics, expected at least 3", len(log.Topics))
	}

	return &model.OrderCancelled{
		ChainID:     chainID,
		OrderID:     log.Topics[1].Hex(),
		Maker:       common.BytesToAddress(log.Topics[2].Bytes()).Hex(),
		BlockNumber: log.BlockNumber,
		TxHash:      log.TxHash.Hex(),
		LogIndex:    log.Index,
	}, nil
}

func (d *eventDecoder) DecodeOrderMatched(log types.Log, chainID int64) (*model.OrderMatched, error) {
	if len(log.Topics) < 4 {
		return nil, fmt.Errorf("OrderMatched has %d topics, expected at least 4", len(log.Topics))
	}

	var data orderMatchedData
	if err := d.abi.UnpackIntoInterface(&data, "OrderMatched", log.Data); err != nil {
		return nil, fmt.Errorf("unpack OrderMatched data: %w", err)
	}

	return &model.OrderMatched{
		ChainID:        chainID,
		ListingOrderID: log.Topics[1].Hex(),
		OfferOrderID:   log.Topics[2].Hex(),
		Taker:          common.BytesToAddress(log.Topics[3].Bytes()).Hex(),
		Listing:        toMatchedOrderSnapshot(data.Listing),
		Offer:          toMatchedOrderSnapshot(data.Offer),
		FillPrice:      data.FillPrice.String(),
		BlockNumber:    log.BlockNumber,
		TxHash:         log.TxHash.Hex(),
		LogIndex:       log.Index,
	}, nil
}

func toMatchedOrderSnapshot(order abiOrder) model.MatchedOrderSnapshot {
	return model.MatchedOrderSnapshot{
		Side:              order.Side,
		SaleKind:          order.SaleKind,
		Maker:             order.Maker.Hex(),
		CollectionAddress: order.Nft.Collection.Hex(),
		TokenID:           order.Nft.TokenID.String(),
		Amount:            order.Nft.Amount.Uint64(),
		Price:             order.Price.String(),
		ExpireTime:        order.Expiry,
		Salt:              order.Salt,
	}
}

func classifyMake(side, saleKind uint8) (orderType string, activityType string) {
	if side == sideOffer {
		if saleKind == saleKindCollection {
			return orderTypeCollBid, activityCollBid
		}
		return orderTypeItemBid, activityItemBid
	}
	return orderTypeListing, activityListing
}
