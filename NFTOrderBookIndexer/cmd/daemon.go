package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"nft-orderbook-indexer/internal/app"
	appconfig "nft-orderbook-indexer/internal/config"
)

// This defines a "daemon" subcommand for the CLI application. When the user runs "nft-orderbook-indexer daemon", this command will be executed.
var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Run the orderbook indexer daemon",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := appconfig.Load(cfgFile)
		if err != nil {
			return err
		}

		result, err := app.RunCheckpointBatch(cmd.Context(), cfg)
		if err != nil {
			return err
		}

		fmt.Println("config loaded successfully")
		fmt.Printf("mysql connected: %s:%d/%s\n", cfg.DB.Host, cfg.DB.Port, cfg.DB.Database)
		fmt.Printf("redis connected: %s db=%d\n", cfg.Redis.Host, cfg.Redis.DB)
		fmt.Printf("chain connected: %s chain_id=%d\n", cfg.Chain.Name, cfg.Chain.ID)
		if result.Batch.NoBlocksReady {
			fmt.Printf("no blocks ready: checkpoint=%d safe_block=%d current_block=%d\n",
				result.Batch.FromBlock,
				result.Batch.SafeBlock,
				result.Batch.CurrentBlock,
			)
			fmt.Printf("order expiry events processed: %d orders_expired=%d\n",
				result.OrderExpiryEventsProcessed,
				result.OrdersExpired,
			)
			fmt.Printf("floor price events processed: %d\n", result.FloorPriceEventsProcessed)
			return nil
		}
		fmt.Printf("fetched logs: from_block=%d to_block=%d count=%d order_created_count=%d order_cancelled_count=%d order_matched_count=%d order_expiry_events_scheduled=%d order_expiry_events_processed=%d orders_expired=%d floor_price_events_enqueued=%d floor_price_events_processed=%d next_checkpoint=%d safe_block=%d\n",
			result.Batch.FromBlock,
			result.Batch.ToBlock,
			result.Batch.LogCount,
			result.Batch.OrderCreatedCount,
			result.Batch.OrderCancelledCount,
			result.Batch.OrderMatchedCount,
			result.Batch.OrderExpiryEventCount,
			result.OrderExpiryEventsProcessed,
			result.OrdersExpired,
			result.Batch.FloorPriceEventCount,
			result.FloorPriceEventsProcessed,
			result.Batch.NextBlock,
			result.Batch.SafeBlock,
		)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
