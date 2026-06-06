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

		if err := app.CheckDependencies(cmd.Context(), cfg); err != nil {
			return err
		}

		fmt.Println("config loaded successfully")
		fmt.Printf("mysql connected: %s:%d/%s\n", cfg.DB.Host, cfg.DB.Port, cfg.DB.Database)
		fmt.Printf("redis connected: %s db=%d\n", cfg.Redis.Host, cfg.Redis.DB)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
