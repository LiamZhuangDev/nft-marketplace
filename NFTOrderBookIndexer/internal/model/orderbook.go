package model

type Order struct {
	ChainID           int64
	OrderID           string
	OrderStatus       string
	OrderType         string
	CollectionAddress string
	TokenID           string
	Maker             string
	Taker             string
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
	ActivityType      string
	OrderID           string
	CollectionAddress string
	TokenID           string
	Maker             string
	Taker             string
	Price             string
	BlockNumber       uint64
	TxHash            string
	LogIndex          uint
}

type OrderCancelled struct {
	ChainID     int64
	OrderID     string
	Maker       string
	BlockNumber uint64
	TxHash      string
	LogIndex    uint
}
