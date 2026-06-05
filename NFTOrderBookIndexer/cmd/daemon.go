package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

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

		pretty, err := json.MarshalIndent(cfg, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println("config loaded successfully")
		fmt.Println(string(pretty))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
