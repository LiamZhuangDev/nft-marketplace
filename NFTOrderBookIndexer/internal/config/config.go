package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	App      AppConfig      `mapstructure:"app" json:"app"`
	Log      LogConfig      `mapstructure:"log" json:"log"`
	DB       DBConfig       `mapstructure:"db" json:"db"`
	Redis    RedisConfig    `mapstructure:"redis" json:"redis"`
	Chain    ChainConfig    `mapstructure:"chain" json:"chain"`
	Contract ContractConfig `mapstructure:"contract" json:"contract"`
}

type AppConfig struct {
	Name        string `mapstructure:"name" json:"name"`
	Environment string `mapstructure:"environment" json:"environment"`
}

type LogConfig struct {
	Level string `mapstructure:"level" json:"level"`
}

type DBConfig struct {
	Host     string `mapstructure:"host" json:"host"`
	Port     int    `mapstructure:"port" json:"port"`
	Database string `mapstructure:"database" json:"database"`
	User     string `mapstructure:"user" json:"user"`
	Password string `mapstructure:"password" json:"password"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host" json:"host"`
	Password string `mapstructure:"password" json:"password"`
	DB       int    `mapstructure:"db" json:"db"`
}

type ChainConfig struct {
	Name                   string `mapstructure:"name" json:"name"`
	ID                     int64  `mapstructure:"id" json:"id"`
	RPCURL                 string `mapstructure:"rpc_url" json:"rpc_url"`
	SafeBlockConfirmations uint64 `mapstructure:"safe_block_confirmations" json:"safe_block_confirmations"`
	StartBlock             uint64 `mapstructure:"start_block" json:"start_block"`
	MaxBlockRange          uint64 `mapstructure:"max_block_range" json:"max_block_range"`
}

type ContractConfig struct {
	OrderbookAddress string `mapstructure:"orderbook_address" json:"orderbook_address"`
	VaultAddress     string `mapstructure:"vault_address" json:"vault_address"`
	EthAddress       string `mapstructure:"eth_address" json:"eth_address"`
	WethAddress      string `mapstructure:"weth_address" json:"weth_address"`
}

func Load(path string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetConfigType("toml")
	v.SetEnvPrefix("NFT_ORDERBOOK_INDEXER")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config %q: %w", path, err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("decode config %q: %w", path, err)
	}
	cfg.ApplyDefaults()

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validate config %q: %w", path, err)
	}

	return &cfg, nil
}

func (c *Config) ApplyDefaults() {
	if c.Chain.MaxBlockRange == 0 {
		c.Chain.MaxBlockRange = 100
	}
}

func (c Config) Validate() error {
	if c.App.Name == "" {
		return fmt.Errorf("app.name is required")
	}
	if c.DB.Host == "" {
		return fmt.Errorf("db.host is required")
	}
	if c.Redis.Host == "" {
		return fmt.Errorf("redis.host is required")
	}
	if c.Chain.Name == "" {
		return fmt.Errorf("chain.name is required")
	}
	if c.Chain.ID == 0 {
		return fmt.Errorf("chain.id is required")
	}
	if c.Chain.RPCURL == "" {
		return fmt.Errorf("chain.rpc_url is required")
	}
	if c.Contract.OrderbookAddress == "" {
		return fmt.Errorf("contract.orderbook_address is required")
	}
	return nil
}
