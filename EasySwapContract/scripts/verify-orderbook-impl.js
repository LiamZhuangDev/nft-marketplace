const { run } = require("hardhat")

async function main() {
  const address = "0xf1c7a069d77a0fc4f2c854d74ee1e890cf050a23"

  await run("verify:verify", {
    address,
    constructorArguments: [],
    contract: "contracts/EasySwapOrderBook.sol:EasySwapOrderBook",
  })

  console.log("EasySwapOrderBook implementation verified:", address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
