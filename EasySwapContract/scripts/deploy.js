const { ethers, upgrades, run } = require("hardhat")

/**  * 2025/02/15 in sepolia testnet
 * esVault contract deployed to: 0xaD65f3dEac0Fa9Af4eeDC96E95574AEaba6A2834
     esVault ImplementationAddress: 0x5D034EA7F15429Bcb9dFCBE08Ee493F001063AF0
     esVault AdminAddress: 0xe839419C14188F7b79a0E4C09cFaF612398e7795
   esDex contract deployed to: 0xcEE5AA84032D4a53a0F9d2c33F36701c3eAD5895
      esDex ImplementationAddress: 0x17B2d83BFE9089cd1D676dE8aebaDCA561f55c96
      esDex AdminAddress: 0xe839419C14188F7b79a0E4C09cFaF612398e7795
 */

async function verifyImplementation(address, contractFqn, label) {
  try {
    await run("verify:verify", {
      address,
      constructorArguments: [],
      contract: contractFqn,
    })
    console.log(`${label} implementation verified:`, address)
  } catch (error) {
    const message = error?.message || String(error)
    if (message.toLowerCase().includes("already verified")) {
      console.log(`${label} implementation already verified:`, address)
      return
    }
    if (
      message.toLowerCase().includes("network request failed") ||
      message.toLowerCase().includes("client network socket disconnected")
    ) {
      console.warn(`${label} implementation verification skipped:`, message)
      return
    }
    throw error
  }
}

async function verifyProxy(address, implementation, admin, initData, label) {
  try {
    await run("verify:verify", {
      address,
      constructorArguments: [implementation, admin, initData],
      contract:
        "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    })
    console.log(`${label} proxy verified:`, address)
  } catch (error) {
    const message = error?.message || String(error)
    if (message.toLowerCase().includes("already verified")) {
      console.log(`${label} proxy already verified:`, address)
      return
    }
    // Some explorers may fail proxy verification but implementation is still enough for debugging.
    console.warn(`${label} proxy verification skipped:`, message)
  }
}

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("deployer: ", deployer.address)

  let esVault = await ethers.getContractFactory("EasySwapVault")
  esVault = await upgrades.deployProxy(esVault, {
    initializer: "initialize",
    // Ensure every deployment has a fresh implementation that can be verified/debugged.
    redeployImplementation: "always",
  })
  await esVault.deployed()

  console.log("esVault contract deployed to:", esVault.address)
  const esVaultImplementationAddress = await upgrades.erc1967.getImplementationAddress(esVault.address)
  console.log(esVaultImplementationAddress, " esVault getImplementationAddress")

  await verifyImplementation(
    esVaultImplementationAddress,
    "contracts/EasySwapVault.sol:EasySwapVault",
    "EasySwapVault"
  )

  const esVaultAdminAddress = await upgrades.erc1967.getAdminAddress(esVault.address)
  console.log(esVaultAdminAddress, " esVault getAdminAddress")
  const esVaultInitData = esVault.interface.encodeFunctionData("initialize", [])
  await verifyProxy(
    esVault.address,
    esVaultImplementationAddress,
    esVaultAdminAddress,
    esVaultInitData,
    "EasySwapVault"
  )

  const newProtocolShare = 200
  const newESVault = esVault.address
  // newESVault = "0xaD65f3dEac0Fa9Af4eeDC96E95574AEaba6A2834"
  const EIP712Name = "EasySwapOrderBook"
  const EIP712Version = "1"
  let esDex = await ethers.getContractFactory("EasySwapOrderBook")
  esDex = await upgrades.deployProxy(
    esDex,
    [newProtocolShare, newESVault, EIP712Name, EIP712Version],
    {
      initializer: "initialize",
      redeployImplementation: "always",
    }
  )
  await esDex.deployed()

  console.log("esDex contract deployed to:", esDex.address)
  const esDexImplementationAddress = await upgrades.erc1967.getImplementationAddress(esDex.address)
  console.log(esDexImplementationAddress, " esDex getImplementationAddress")

  await verifyImplementation(
    esDexImplementationAddress,
    "contracts/EasySwapOrderBook.sol:EasySwapOrderBook",
    "EasySwapOrderBook"
  )
  const esDexAdminAddress = await upgrades.erc1967.getAdminAddress(esDex.address)
  console.log(esDexAdminAddress, " esDex getAdminAddress")
  const esDexInitData = esDex.interface.encodeFunctionData("initialize", [
    newProtocolShare,
    newESVault,
    EIP712Name,
    EIP712Version,
  ])
  await verifyProxy(
    esDex.address,
    esDexImplementationAddress,
    esDexAdminAddress,
    esDexInitData,
    "EasySwapOrderBook"
  )

  const esDexAddress = esDex.address
  const esVaultAddress = esVault.address
  // esVaultAddress = "0xaD65f3dEac0Fa9Af4eeDC96E95574AEaba6A2834"
  const esVault_ = await (
    await ethers.getContractFactory("EasySwapVault")
  ).attach(esVaultAddress)
  const tx = await esVault_.setOrderBook(esDexAddress)
  await tx.wait()
  console.log("esVault setOrderBook tx:", tx.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
