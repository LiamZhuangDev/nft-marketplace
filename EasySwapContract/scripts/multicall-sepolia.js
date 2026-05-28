const { ethers } = require("hardhat")
const { Side, SaleKind } = require("../test/common")

const ORDERBOOK_PROXY = "0x5dF9A3b6785017187119C5d41885B4ccc0c63a04"
const VAULT_PROXY = "0x48Ab4A68075b8De0b2961cE447b1df872865A955"
const TOKEN_URI =
  "https://plum-impressed-meadowlark-978.mypinata.cloud/ipfs/bafkreiepsryzkrurr33wy75f4vlmyp6hsdnvphxbkqskmfwiql54jjyewy"

function nowTs() {
  return Math.floor(Date.now() / 1000)
}

function buildListOrder(maker, collection, tokenId, salt) {
  return {
    side: Side.List,
    saleKind: SaleKind.FixedPriceForItem,
    maker,
    nft: [tokenId, collection, 1],
    price: ethers.utils.parseEther("0.001"),
    expiry: nowTs() + 3600,
    salt,
  }
}

function buildBidOrder(maker, collection, tokenId, salt, priceEth = "0.001") {
  return {
    side: Side.Bid,
    saleKind: SaleKind.FixedPriceForItem,
    maker,
    nft: [tokenId, collection, 1],
    price: ethers.utils.parseEther(priceEth),
    expiry: nowTs() + 3600,
    salt,
  }
}

function assertWithMessage(condition, message) {
  if (!condition) throw new Error(message)
}

function getOrderKeyFromMakeReceipt(esDex, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = esDex.interface.parseLog(log)
      if (parsed.name === "LogMake") {
        return parsed.args.orderKey
      }
    } catch (error) {
      // ignore logs from other contracts
    }
  }
  throw new Error("LogMake not found in receipt")
}

async function expectRevert(promise, reason) {
  try {
    await promise
  } catch (error) {
    const msg = error?.error?.message || error?.reason || error?.message || String(error)
    if (msg.includes(reason)) {
      return
    }
    throw new Error(`Expected revert "${reason}", got: ${msg}`)
  }
  throw new Error(`Expected revert "${reason}", but tx succeeded`)
}

async function main() {
  const [seller, buyer] = await ethers.getSigners()
  console.log("seller:", seller.address)
  console.log("buyer:", buyer.address)
  console.log("orderbook:", ORDERBOOK_PROXY)
  console.log("vault:", VAULT_PROXY)

  const esDex = await (await ethers.getContractFactory("EasySwapOrderBook")).attach(ORDERBOOK_PROXY)
  const esVault = await (await ethers.getContractFactory("EasySwapVault")).attach(VAULT_PROXY)

  const nftFactory = await ethers.getContractFactory("TestERC721")
  const nft = await nftFactory.deploy()
  await nft.deployed()
  console.log("test erc721:", nft.address)

  const tokenIds = [9101, 9102]
  for (const tokenId of tokenIds) {
    await (await nft.mint(seller.address, tokenId)).wait()
    await (await nft["setTokenURI(uint256,string)"](tokenId, TOKEN_URI)).wait()
  }
  console.log("minted tokens:", tokenIds.join(", "))
  console.log("tokenURI sample:", await nft.tokenURI(9101))

  const approved = await nft.isApprovedForAll(seller.address, VAULT_PROXY)
  if (!approved) {
    await (await nft.connect(seller).setApprovalForAll(VAULT_PROXY, true)).wait()
  }
  console.log("seller approved vault for all:", true)

  // Scenario 1:
  // 买家接受卖家高价单子（先挂卖单，再由买家挂更高 bid 并撮合）
  {
    const sellOrder = buildListOrder(seller.address, nft.address, 9101, 21001)
    const sellTx = await esDex.connect(seller).makeOrders([sellOrder])
    const sellRec = await sellTx.wait()
    const sellOrderKey = getOrderKeyFromMakeReceipt(esDex, sellRec)

    const buyOrder = buildBidOrder(buyer.address, nft.address, 9101, 21002, "0.003")
    const buyTx = await esDex.connect(buyer).makeOrders([buyOrder], { value: ethers.utils.parseEther("0.003") })
    const buyRec = await buyTx.wait()
    const buyOrderKey = getOrderKeyFromMakeReceipt(esDex, buyRec)

    const matchData = esDex.interface.encodeFunctionData("matchOrder", [sellOrder, buyOrder])
    const matchTx = await esDex.connect(buyer).multicall([matchData], true)
    await matchTx.wait()

    const owner = await nft.ownerOf(9101)
    const sellFilled = await esDex.filledAmount(sellOrderKey)
    const buyFilled = await esDex.filledAmount(buyOrderKey)
    const buyETHBalance = await esVault.ETHBalance(buyOrderKey)

    assertWithMessage(owner.toLowerCase() === buyer.address.toLowerCase(), "scenario1 nft owner mismatch")
    assertWithMessage(sellFilled.eq(1), "scenario1 sell order not fully filled")
    assertWithMessage(buyFilled.eq(1), "scenario1 buy order filled amount mismatch")
    assertWithMessage(buyETHBalance.eq(0), "scenario1 buy vault balance should be 0")
    console.log("scenario1 ok (buyer accepts seller ask with high bid):", matchTx.hash)
  }

  // Scenario 2:
  // 卖家接受买家低价单子（先挂低价 bid，再由卖家挂单并撮合）
  {
    const lowBidOrder = buildBidOrder(buyer.address, nft.address, 9102, 22001, "0.001")
    const buyTx = await esDex.connect(buyer).makeOrders([lowBidOrder], { value: ethers.utils.parseEther("0.001") })
    const buyRec = await buyTx.wait()
    const buyOrderKey = getOrderKeyFromMakeReceipt(esDex, buyRec)

    const sellOrder = {
      side: Side.List,
      saleKind: SaleKind.FixedPriceForItem,
      maker: seller.address,
      nft: [9102, nft.address, 1],
      // 卖家原本期望更高，但主动接受低价 bid（最终按 bid 价格成交）
      price: ethers.utils.parseEther("0.005"),
      expiry: nowTs() + 3600,
      salt: 22002,
    }

    const matchData = esDex.interface.encodeFunctionData("matchOrder", [sellOrder, lowBidOrder])
    const matchTx = await esDex.connect(seller).multicall([matchData], true)
    await matchTx.wait()

    const owner = await nft.ownerOf(9102)
    const buyFilled = await esDex.filledAmount(buyOrderKey)
    const buyETHBalance = await esVault.ETHBalance(buyOrderKey)

    assertWithMessage(owner.toLowerCase() === buyer.address.toLowerCase(), "scenario2 nft owner mismatch")
    assertWithMessage(buyFilled.eq(1), "scenario2 buy order filled amount mismatch")
    assertWithMessage(buyETHBalance.eq(0), "scenario2 buy vault balance should be 0")
    console.log("scenario2 ok (seller accepts buyer low bid):", matchTx.hash)
  }

  const orderBookOnVault = await esVault.orderBook()
  console.log("vault.orderBook:", orderBookOnVault)
  console.log("all requested scenarios passed")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
