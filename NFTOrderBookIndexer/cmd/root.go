package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "nft-orderbook-indexer",
	Short: "Index NFT orderbook events from an EVM chain",
	Long:  "NFTOrderBookIndexer indexes orderbook contract events into local marketplace state.",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	// Adds a global flag:
	// --config ./path/to/config.toml
	// -c ./path/to/config.toml (shorthand)
	// Because it is a persistent flag, subcommands can use this flag too.
	rootCmd.PersistentFlags().StringVarP(
		&cfgFile,
		"config",
		"c",
		"./config/config.toml.example",
		"path to TOML config file",
	)
}
