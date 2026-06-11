const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with account:", deployer.address);

  const wethAddress = process.env.WETH_ADDRESS;
  if (!wethAddress) {
    throw new Error("WETH_ADDRESS env var is required");
  }

  const NFTEscrowVault = await hre.ethers.getContractFactory("NFTEscrowVault");
  const vault = await NFTEscrowVault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log("NFTEscrowVault deployed to:", vaultAddress);

  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(vaultAddress, deployer.address, wethAddress);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();

  console.log("OrderBook deployed to:", orderBookAddress);
  console.log("ERC20 payment token:", wethAddress);

  const tx = await vault.setOrderBook(orderBookAddress);
  await tx.wait();

  console.log("Vault orderBook set to:", orderBookAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
