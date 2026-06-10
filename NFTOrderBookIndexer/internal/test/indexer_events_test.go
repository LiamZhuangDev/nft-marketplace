package test

import (
	"context"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"nft-orderbook-indexer/internal/app"
	"nft-orderbook-indexer/internal/config"
	"nft-orderbook-indexer/internal/indexer"
	"nft-orderbook-indexer/internal/model"
)

const testFutureExpiry = uint64(4102444800)

const testOrderbookABI = `[
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "listingOrderKey", "type": "bytes32"},
			{"indexed": true, "name": "offerOrderKey", "type": "bytes32"},
			{"indexed": true, "name": "taker", "type": "address"},
			{
				"components": [
					{"name": "side", "type": "uint8"},
					{"name": "saleKind", "type": "uint8"},
					{"name": "maker", "type": "address"},
					{
						"components": [
							{"name": "tokenId", "type": "uint256"},
							{"name": "collection", "type": "address"},
							{"name": "amount", "type": "uint96"}
						],
						"name": "nft",
						"type": "tuple"
					},
					{"name": "price", "type": "uint128"},
					{"name": "expiry", "type": "uint64"},
					{"name": "salt", "type": "uint64"}
				],
				"indexed": false,
				"name": "listing",
				"type": "tuple"
			},
			{
				"components": [
					{"name": "side", "type": "uint8"},
					{"name": "saleKind", "type": "uint8"},
					{"name": "maker", "type": "address"},
					{
						"components": [
							{"name": "tokenId", "type": "uint256"},
							{"name": "collection", "type": "address"},
							{"name": "amount", "type": "uint96"}
						],
						"name": "nft",
						"type": "tuple"
					},
					{"name": "price", "type": "uint128"},
					{"name": "expiry", "type": "uint64"},
					{"name": "salt", "type": "uint64"}
				],
				"indexed": false,
				"name": "offer",
				"type": "tuple"
			},
			{"indexed": false, "name": "fillPrice", "type": "uint128"}
		],
		"name": "OrderMatched",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "orderKey", "type": "bytes32"},
			{"indexed": true, "name": "maker", "type": "address"}
		],
		"name": "OrderCancelled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": false, "name": "orderKey", "type": "bytes32"},
			{"indexed": true, "name": "side", "type": "uint8"},
			{"indexed": true, "name": "saleKind", "type": "uint8"},
			{"indexed": true, "name": "maker", "type": "address"},
			{
				"components": [
					{"name": "tokenId", "type": "uint256"},
					{"name": "collection", "type": "address"},
					{"name": "amount", "type": "uint96"}
				],
				"indexed": false,
				"name": "nft",
				"type": "tuple"
			},
			{"indexed": false, "name": "price", "type": "uint128"},
			{"indexed": false, "name": "expiry", "type": "uint64"},
			{"indexed": false, "name": "salt", "type": "uint64"}
		],
		"name": "OrderCreated",
		"type": "event"
	}
]`

type fakeChain struct {
	current uint64
	logs    []types.Log

	fromBlock uint64
	toBlock   uint64
	address   string
}

func (f *fakeChain) CurrentBlock(ctx context.Context) (uint64, error) {
	return f.current, nil
}

func (f *fakeChain) FilterLogs(ctx context.Context, fromBlock, toBlock uint64, address string) ([]types.Log, error) {
	f.fromBlock = fromBlock
	f.toBlock = toBlock
	f.address = address
	return f.logs, nil
}

type fakeCheckpoint struct {
	last  uint64
	saved uint64
}

func (f *fakeCheckpoint) LastIndexedBlock(ctx context.Context, chainID int64, defaultStart uint64) (uint64, error) {
	if f.last == 0 {
		return defaultStart, nil
	}
	return f.last, nil
}

func (f *fakeCheckpoint) SaveLastIndexedBlock(ctx context.Context, chainID int64, nextBlock uint64) error {
	f.saved = nextBlock
	return nil
}

type fakeOrderbookStore struct {
	created   []model.Order
	items     []model.Item
	cancelled []model.OrderCancelled
	matched   []model.OrderMatched

	orders              map[string]model.Order
	collectionFloors    map[string]string
	activeListingCounts map[string]uint64
}

func (f *fakeOrderbookStore) SaveOrderCreated(ctx context.Context, order model.Order, item model.Item) error {
	f.created = append(f.created, order)
	f.items = append(f.items, item)
	f.ensureState()
	f.orders[order.OrderID] = order
	return nil
}

func (f *fakeOrderbookStore) SaveOrderCancelled(ctx context.Context, event model.OrderCancelled) (string, error) {
	f.cancelled = append(f.cancelled, event)
	f.ensureState()

	order := f.orders[event.OrderID]
	order.OrderStatus = "cancelled"
	order.QuantityRemaining = 0
	f.orders[event.OrderID] = order
	return order.CollectionAddress, nil
}

func (f *fakeOrderbookStore) SaveOrderMatched(ctx context.Context, event model.OrderMatched) error {
	f.matched = append(f.matched, event)
	f.ensureState()

	listing := f.orders[event.ListingOrderID]
	listing.OrderStatus = "filled"
	listing.QuantityRemaining = 0
	f.orders[event.ListingOrderID] = listing
	return nil
}

func (f *fakeOrderbookStore) ExpireOrder(ctx context.Context, event model.OrderExpiryEvent, now uint64) (*model.Order, bool, error) {
	f.ensureState()

	order := f.orders[event.OrderID]
	if order.OrderStatus != "active" || order.ExpireTime == 0 || order.ExpireTime > now {
		return &order, false, nil
	}

	order.OrderStatus = "expired"
	order.QuantityRemaining = 0
	f.orders[event.OrderID] = order
	return &order, true, nil
}

func (f *fakeOrderbookStore) UpdateCollectionFloorPrice(ctx context.Context, event model.FloorPriceEvent) error {
	f.ensureState()

	now := uint64(time.Now().Unix())
	var floor *big.Int
	var activeCount uint64
	for _, order := range f.orders {
		if order.ChainID != event.ChainID ||
			order.CollectionAddress != event.CollectionAddress ||
			order.OrderType != "listing" ||
			order.OrderStatus != "active" ||
			order.QuantityRemaining == 0 ||
			(order.ExpireTime != 0 && order.ExpireTime <= now) {
			continue
		}

		price, ok := new(big.Int).SetString(order.Price, 10)
		if !ok {
			continue
		}
		if floor == nil || price.Cmp(floor) < 0 {
			floor = price
		}
		activeCount++
	}

	if floor == nil {
		delete(f.collectionFloors, event.CollectionAddress)
		f.activeListingCounts[event.CollectionAddress] = 0
		return nil
	}

	f.collectionFloors[event.CollectionAddress] = floor.String()
	f.activeListingCounts[event.CollectionAddress] = activeCount
	return nil
}

func (f *fakeOrderbookStore) ensureState() {
	if f.orders == nil {
		f.orders = make(map[string]model.Order)
	}
	if f.collectionFloors == nil {
		f.collectionFloors = make(map[string]string)
	}
	if f.activeListingCounts == nil {
		f.activeListingCounts = make(map[string]uint64)
	}
}

type fakeFloorQueue struct {
	events []model.FloorPriceEvent
}

func (f *fakeFloorQueue) Enqueue(ctx context.Context, event model.FloorPriceEvent) error {
	f.events = append(f.events, event)
	return nil
}

func (f *fakeFloorQueue) Dequeue(ctx context.Context) (*model.FloorPriceEvent, bool, error) {
	if len(f.events) == 0 {
		return nil, false, nil
	}

	event := f.events[0]
	f.events = f.events[1:]
	return &event, true, nil
}

type fakeExpiryQueue struct {
	events []model.OrderExpiryEvent
}

func (f *fakeExpiryQueue) Schedule(ctx context.Context, event model.OrderExpiryEvent) error {
	f.events = append(f.events, event)
	return nil
}

type testAsset struct {
	TokenID    *big.Int       `abi:"tokenId"`
	Collection common.Address `abi:"collection"`
	Amount     *big.Int       `abi:"amount"`
}

type testOrder struct {
	Side     uint8          `abi:"side"`
	SaleKind uint8          `abi:"saleKind"`
	Maker    common.Address `abi:"maker"`
	Nft      testAsset      `abi:"nft"`
	Price    *big.Int       `abi:"price"`
	Expiry   uint64         `abi:"expiry"`
	Salt     uint64         `abi:"salt"`
}

// This test verifies that SyncNextBatch correctly processes OrderCreated, OrderCancelled, and OrderMatched events from the chain logs, updates the orderbook store, enqueues floor price events, and schedules order expiry events.
// The fake chain current block is 20, and the logs are from blocks 10, 11, and 12. The test checks that the correct number of events are processed, the checkpoint is updated to 20, and the orderbook store and queues receive the expected data.
func TestSyncNextBatchHandlesOrderEventsFromFakeChainLogs(t *testing.T) {
	parsed, err := abi.JSON(strings.NewReader(testOrderbookABI))
	if err != nil {
		t.Fatalf("parse test ABI: %v", err)
	}

	listingKey := testHash(0x11)
	activeListingKey := testHash(0x12)
	offerKey := testHash(0x22)
	seller := common.HexToAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	buyer := common.HexToAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	collection := common.HexToAddress("0x1111111111111111111111111111111111111111")

	logs := []types.Log{
		buildOrderCreatedLog(t, parsed, listingKey, seller, collection, 42, 1000, 10, 1, 0xaa),
		buildOrderCreatedLog(t, parsed, activeListingKey, seller, collection, 43, 700, 11, 2, 0xab),
		buildOrderCancelledLog(parsed, listingKey, seller),
		buildOrderMatchedLog(t, parsed, listingKey, offerKey, seller, buyer, collection),
	}

	chain := &fakeChain{current: 20, logs: logs}
	checkpoint := &fakeCheckpoint{}
	orderbook := &fakeOrderbookStore{}
	floorPrice := &fakeFloorQueue{}
	expiry := &fakeExpiryQueue{}
	cfg := &config.Config{
		Chain: config.ChainConfig{
			ID:                     11155111,
			StartBlock:             10,
			SafeBlockConfirmations: 1,
			MaxBlockRange:          10,
		},
		Contract: config.ContractConfig{
			OrderbookAddress: "0x9999999999999999999999999999999999999999",
		},
	}

	svc, err := indexer.New(cfg, chain, checkpoint, orderbook, floorPrice, expiry)
	if err != nil {
		t.Fatalf("create indexer: %v", err)
	}

	result, err := svc.SyncNextBatch(context.Background())
	if err != nil {
		t.Fatalf("SyncNextBatch returned error: %v", err)
	}

	if result.LogCount != 4 || result.OrderCreatedCount != 2 || result.OrderCancelledCount != 1 || result.OrderMatchedCount != 1 {
		t.Fatalf("unexpected batch counts: %+v", result)
	}
	if result.FloorPriceEventCount != 4 {
		t.Fatalf("floor price events = %d, want 4", result.FloorPriceEventCount)
	}
	if result.OrderExpiryEventCount != 2 {
		t.Fatalf("order expiry events = %d, want 2", result.OrderExpiryEventCount)
	}
	if chain.fromBlock != 10 || chain.toBlock != 19 || checkpoint.saved != 20 {
		t.Fatalf("unexpected range/checkpoint: from=%d to=%d saved=%d", chain.fromBlock, chain.toBlock, checkpoint.saved)
	}

	if len(orderbook.created) != 2 {
		t.Fatalf("created orders = %d, want 2", len(orderbook.created))
	}
	created := orderbook.created[0]
	if created.OrderID != listingKey.Hex() || created.OrderType != "listing" || created.Maker != seller.Hex() || created.Price != "1000" {
		t.Fatalf("unexpected created order: %+v", created)
	}
	if created.CollectionAddress != collection.Hex() || created.TokenID != "42" || created.QuantityRemaining != 1 || created.ExpireTime != testFutureExpiry {
		t.Fatalf("unexpected created order fields: %+v", created)
	}

	if len(orderbook.cancelled) != 1 || orderbook.cancelled[0].OrderID != listingKey.Hex() || orderbook.cancelled[0].Maker != seller.Hex() {
		t.Fatalf("unexpected cancelled events: %+v", orderbook.cancelled)
	}

	if len(orderbook.matched) != 1 {
		t.Fatalf("matched events = %d, want 1", len(orderbook.matched))
	}
	matched := orderbook.matched[0]
	if matched.ListingOrderID != listingKey.Hex() || matched.OfferOrderID != offerKey.Hex() || matched.Taker != buyer.Hex() {
		t.Fatalf("unexpected matched event keys: %+v", matched)
	}
	if matched.Listing.Maker != seller.Hex() || matched.Offer.Maker != buyer.Hex() || matched.FillPrice != "1000" {
		t.Fatalf("unexpected matched order snapshots: %+v", matched)
	}

	if len(floorPrice.events) != 4 {
		t.Fatalf("floor price queue events = %d, want 4", len(floorPrice.events))
	}
	if floorPrice.events[0].Reason != "order_created" ||
		floorPrice.events[1].Reason != "order_created" ||
		floorPrice.events[2].Reason != "order_cancelled" ||
		floorPrice.events[3].Reason != "order_matched" {
		t.Fatalf("unexpected floor price event reasons: %+v", floorPrice.events)
	}
	if len(expiry.events) != 2 || expiry.events[0].OrderID != listingKey.Hex() || expiry.events[0].ExpireTime != testFutureExpiry {
		t.Fatalf("unexpected expiry events: %+v", expiry.events)
	}

	processed, err := app.ProcessFloorPriceEvents(context.Background(), floorPrice, orderbook, 10)
	if err != nil {
		t.Fatalf("ProcessFloorPriceEvents returned error: %v", err)
	}
	if processed != 4 {
		t.Fatalf("floor price events processed = %d, want 4", processed)
	}
	if orderbook.collectionFloors[collection.Hex()] != "700" {
		t.Fatalf("collection floor price = %q, want 700", orderbook.collectionFloors[collection.Hex()])
	}
	if orderbook.activeListingCounts[collection.Hex()] != 1 {
		t.Fatalf("active listing count = %d, want 1", orderbook.activeListingCounts[collection.Hex()])
	}
}

func buildOrderCreatedLog(t *testing.T, parsed abi.ABI, orderKey common.Hash, maker common.Address, collection common.Address, tokenID int64, price int64, blockNumber uint64, logIndex uint, txLastByte byte) types.Log {
	t.Helper()

	event := parsed.Events["OrderCreated"]
	data, err := event.Inputs.NonIndexed().Pack(
		hashToBytes32(orderKey),
		testAsset{
			TokenID:    big.NewInt(tokenID),
			Collection: collection,
			Amount:     big.NewInt(1),
		},
		big.NewInt(price),
		testFutureExpiry,
		uint64(7),
	)
	if err != nil {
		t.Fatalf("pack OrderCreated: %v", err)
	}

	return types.Log{
		Topics: []common.Hash{
			event.ID,
			common.BigToHash(big.NewInt(0)),
			common.BigToHash(big.NewInt(0)),
			addressTopic(maker),
		},
		Data:        data,
		BlockNumber: blockNumber,
		TxHash:      testHash(txLastByte),
		Index:       logIndex,
	}
}

func buildOrderCancelledLog(parsed abi.ABI, orderKey common.Hash, maker common.Address) types.Log {
	event := parsed.Events["OrderCancelled"]
	return types.Log{
		Topics: []common.Hash{
			event.ID,
			orderKey,
			addressTopic(maker),
		},
		BlockNumber: 11,
		TxHash:      testHash(0xbb),
		Index:       2,
	}
}

func buildOrderMatchedLog(t *testing.T, parsed abi.ABI, listingKey common.Hash, offerKey common.Hash, seller common.Address, buyer common.Address, collection common.Address) types.Log {
	t.Helper()

	event := parsed.Events["OrderMatched"]
	listing := testOrder{
		Side:     0,
		SaleKind: 0,
		Maker:    seller,
		Nft: testAsset{
			TokenID:    big.NewInt(42),
			Collection: collection,
			Amount:     big.NewInt(1),
		},
		Price:  big.NewInt(1000),
		Expiry: 999999,
		Salt:   7,
	}
	offer := testOrder{
		Side:     1,
		SaleKind: 1,
		Maker:    buyer,
		Nft: testAsset{
			TokenID:    big.NewInt(42),
			Collection: collection,
			Amount:     big.NewInt(1),
		},
		Price:  big.NewInt(1200),
		Expiry: 999999,
		Salt:   8,
	}

	data, err := event.Inputs.NonIndexed().Pack(listing, offer, big.NewInt(1000))
	if err != nil {
		t.Fatalf("pack OrderMatched: %v", err)
	}

	return types.Log{
		Topics: []common.Hash{
			event.ID,
			listingKey,
			offerKey,
			addressTopic(buyer),
		},
		Data:        data,
		BlockNumber: 12,
		TxHash:      testHash(0xcc),
		Index:       3,
	}
}

func testHash(lastByte byte) common.Hash {
	var hash common.Hash
	hash[31] = lastByte
	return hash
}

func hashToBytes32(hash common.Hash) [32]byte {
	var out [32]byte
	copy(out[:], hash.Bytes())
	return out
}

func addressTopic(address common.Address) common.Hash {
	return common.BytesToHash(address.Bytes())
}

type fakeWorkers struct {
	expiryEvents []model.OrderExpiryEvent
	floorEvents  []model.FloorPriceEvent

	expireResults map[string]fakeExpireResult

	enqueuedFloor []model.FloorPriceEvent
	updatedFloor  []model.FloorPriceEvent
}

type fakeExpireResult struct {
	order   *model.Order
	expired bool
}

func (f *fakeWorkers) DequeueDue(ctx context.Context, now uint64) (*model.OrderExpiryEvent, bool, error) {
	if len(f.expiryEvents) == 0 {
		return nil, false, nil
	}

	event := f.expiryEvents[0]
	f.expiryEvents = f.expiryEvents[1:]
	return &event, true, nil
}

func (f *fakeWorkers) Enqueue(ctx context.Context, event model.FloorPriceEvent) error {
	f.enqueuedFloor = append(f.enqueuedFloor, event)
	return nil
}

func (f *fakeWorkers) Dequeue(ctx context.Context) (*model.FloorPriceEvent, bool, error) {
	if len(f.floorEvents) == 0 {
		return nil, false, nil
	}

	event := f.floorEvents[0]
	f.floorEvents = f.floorEvents[1:]
	return &event, true, nil
}

func (f *fakeWorkers) ExpireOrder(ctx context.Context, event model.OrderExpiryEvent, now uint64) (*model.Order, bool, error) {
	result := f.expireResults[event.OrderID]
	return result.order, result.expired, nil
}

func (f *fakeWorkers) UpdateCollectionFloorPrice(ctx context.Context, event model.FloorPriceEvent) error {
	f.updatedFloor = append(f.updatedFloor, event)
	return nil
}

func TestProcessOrderExpiryEventsExpiresListing(t *testing.T) {
	workers := &fakeWorkers{
		expiryEvents: []model.OrderExpiryEvent{
			{ChainID: 11155111, OrderID: "0xorder1", ExpireTime: 100},
		},
		expireResults: map[string]fakeExpireResult{
			"0xorder1": {
				order: &model.Order{
					ChainID:           11155111,
					OrderID:           "0xorder1",
					OrderType:         "listing",
					CollectionAddress: "0xcollection",
				},
				expired: true,
			},
		},
	}

	processed, expired, err := app.ProcessOrderExpiryEvents(context.Background(), workers, workers, workers, 10)
	if err != nil {
		t.Fatalf("ProcessOrderExpiryEvents returned error: %v", err)
	}
	if processed != 1 {
		t.Fatalf("processed = %d, want 1", processed)
	}
	if expired != 1 {
		t.Fatalf("expired = %d, want 1", expired)
	}
	if len(workers.enqueuedFloor) != 1 {
		t.Fatalf("enqueued floor events = %d, want 1", len(workers.enqueuedFloor))
	}
}

func TestProcessOrderExpiryEventsIgnoresStaleJob(t *testing.T) {
	workers := &fakeWorkers{
		expiryEvents: []model.OrderExpiryEvent{
			{ChainID: 11155111, OrderID: "0xorder1", ExpireTime: 100},
		},
		expireResults: map[string]fakeExpireResult{
			"0xorder1": {
				order:   &model.Order{OrderID: "0xorder1", OrderType: "listing"},
				expired: false,
			},
		},
	}

	processed, expired, err := app.ProcessOrderExpiryEvents(context.Background(), workers, workers, workers, 10)
	if err != nil {
		t.Fatalf("ProcessOrderExpiryEvents returned error: %v", err)
	}
	if processed != 1 {
		t.Fatalf("processed = %d, want 1", processed)
	}
	if expired != 0 {
		t.Fatalf("expired = %d, want 0", expired)
	}
}

// This test verifies that ProcessFloorPriceEvents correctly computes the floor price when order2 was created.
func TestProcessFloorPriceEventsComputesFloorPriceValue(t *testing.T) {
	floorPrice := &fakeFloorQueue{
		events: []model.FloorPriceEvent{
			{ChainID: 11155111, CollectionAddress: "0xcollection1", Reason: "order_created"},
		},
	}
	orderbook := fakeFloorPriceOrderbook()

	processed, err := app.ProcessFloorPriceEvents(context.Background(), floorPrice, orderbook, 10)
	if err != nil {
		t.Fatalf("ProcessFloorPriceEvents returned error: %v", err)
	}
	if processed != 1 {
		t.Fatalf("processed = %d, want 1", processed)
	}
	if orderbook.collectionFloors["0xcollection1"] != "500" {
		t.Fatalf("collection1 floor price = %q, want 500", orderbook.collectionFloors["0xcollection1"])
	}
	if orderbook.activeListingCounts["0xcollection1"] != 2 {
		t.Fatalf("collection1 active listing count = %d, want 2", orderbook.activeListingCounts["0xcollection1"])
	}
}

func fakeFloorPriceOrderbook() *fakeOrderbookStore {
	return &fakeOrderbookStore{
		orders: map[string]model.Order{
			"0xorder1": {
				ChainID:           11155111,
				OrderID:           "0xorder1",
				OrderStatus:       "active",
				OrderType:         "listing",
				CollectionAddress: "0xcollection1",
				TokenID:           "1",
				Price:             "900",
				QuantityRemaining: 1,
				ExpireTime:        testFutureExpiry,
			},
			"0xorder2": {
				ChainID:           11155111,
				OrderID:           "0xorder2",
				OrderStatus:       "active",
				OrderType:         "listing",
				CollectionAddress: "0xcollection1",
				TokenID:           "2",
				Price:             "500",
				QuantityRemaining: 1,
				ExpireTime:        testFutureExpiry,
			},
		},
	}
}
