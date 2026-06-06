package store

import (
	"database/sql"
	"fmt"
	"net/url"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"nft-orderbook-indexer/internal/config"
)

func OpenDB(cfg config.DBConfig) (*sql.DB, error) {
	dsn := mysqlDSN(cfg)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	return db, nil
}

func mysqlDSN(cfg config.DBConfig) string {
	values := url.Values{}
	values.Set("parseTime", "true")
	values.Set("charset", "utf8mb4")
	values.Set("loc", "Local")

	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?%s",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.Database,
		values.Encode(),
	)
}
