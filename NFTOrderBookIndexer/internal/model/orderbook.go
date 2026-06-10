package model

type Order struct {
	ChainID           int64
	OrderID           string
	OrderStatus       string
	OrderType         string
	CollectionAddress string
	TokenID           string
	Maker             string
	Price             string
	QuantityRemaining uint64
	Size              uint64
	ExpireTime        uint64
	Salt              uint64
	BlockNumber       uint64
	TxHash            string
	LogIndex          uint
}

type Item struct {
	ChainID           int64
	CollectionAddress string
	TokenID           string
	Owner             string
	Supply            uint64
	ListPrice         string
	ListTime          uint64
}

type Activity struct {
	ChainID           int64
	OrderType         string
	OrderID           string
	CounterOrderID    string
	CollectionAddress string
	TokenID           string
	Maker             string
	Taker             string
	Price             string
	BlockNumber       uint64
	TxHash            string
	LogIndex          uint
}

type FloorPriceEvent struct {
	ChainID           int64  `json:"chain_id"`
	CollectionAddress string `json:"collection_address"`
	Reason            string `json:"reason"`
}

type OrderExpiryEvent struct {
	ChainID    int64  `json:"chain_id"`
	OrderID    string `json:"order_id"`
	ExpireTime uint64 `json:"expire_time"`
}

type OrderCancelled struct {
	ChainID     int64
	OrderID     string
	Maker       string
	BlockNumber uint64
	TxHash      string
	LogIndex    uint
}

type MatchedOrderSnapshot struct {
	Side              uint8
	SaleKind          uint8
	Maker             string
	CollectionAddress string
	TokenID           string
	Amount            uint64
	Price             string
	ExpireTime        uint64
	Salt              uint64
}

type OrderMatched struct {
	ChainID        int64
	ListingOrderID string
	OfferOrderID   string
	Taker          string
	Listing        MatchedOrderSnapshot
	Offer          MatchedOrderSnapshot
	FillPrice      string
	BlockNumber    uint64
	TxHash         string
	LogIndex       uint
}
