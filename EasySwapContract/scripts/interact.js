const { ethers, upgrades } = require("hardhat")
const { Side, SaleKind } = require("../test/common")
const { toBn } = require("evm-bn")

/**  * 2024/12/22 in sepolia testnet
 * esVault contract deployed to: 0x75EC7448bC37c1FB484520C45b40F1564eBd0d19
     esVault ImplementationAddress: 
     esVault AdminAddress: 
   esDex contract deployed to: 0x5560e1c2E0260c2274e400d80C30CDC4B92dC8ac
      esDex ImplementationAddress: 
      esDex AdminAddress: 
 */

const esDex_name = "EasySwapOrderBook";
const esDex_address = "0x9424b9622B04b0c838e615673eF0c34fED9A2Da1"

const esVault_name = "EasySwapVault";
const esVault_address = "0x6dae8a9b002cda987e79c0fa7e99283720c3e97a"
const ORDERBOOK_VAULT_SLOT = 155

const erc721_name = "TestERC721"
const erc721_address = "0xCe0967A73cB2d25b4B1A1ee431bA7cb1F27C0ac6"
const BOOTSTRAP_ERC721 = process.env.BOOTSTRAP_ERC721 !== "false"
const ORDER_START_TOKEN_ID = Number(process.env.ORDER_START_TOKEN_ID || 1)
const ORDER_END_TOKEN_ID = Number(process.env.ORDER_END_TOKEN_ID || 19)

let esDex, esVault, testERC721
let deployer
let erc721Address = erc721_address
let vaultAddress = esVault_address
async function main() {
    [deployer, trader] = await ethers.getSigners()
    console.log("deployer: ", deployer.address)
    console.log("trader: ", trader.address)

    esDex = await (
        await ethers.getContractFactory(esDex_name)
    ).attach(esDex_address)

    vaultAddress = await resolveVaultAddressFromOrderBook();
    esVault = await (
        await ethers.getContractFactory(esVault_name)
    ).attach(vaultAddress)
    console.log("OrderBook vault:", vaultAddress)

    if (BOOTSTRAP_ERC721) {
        await deployAndMintERC721();
    } else {
        testERC721 = await (
            await ethers.getContractFactory(erc721_name)
        ).attach(erc721Address)
        console.log("Use existing ERC721:", erc721Address)
    }


    // 1. setApprovalForAll
    await approvalForVault();

    // 2. make order
    // await testMakeOrder();

    for (let i = ORDER_START_TOKEN_ID; i <= ORDER_END_TOKEN_ID; i++) {
        console.log(`make order ${i}`);
        await testMakeOrder(i);
    }

    // 3. cancel order
    // let orderKeys = [];
    // await testCancelOrder(orderKeys);

    // let orderKeys1 = ["0xa48c77f5aa25cd7b0d207b491cf7a0ef5cc5cf15e3c1f9534b6791ef856f0dbe"]
    // let orderKeys2 = ["0x2f01e4ef5cbea217934b2bb27a73fac35032a75ffb030dea41fdb995c55f3069",
    //     "0x3450ada942fc2595d7d12bd6385cf3f1b03a614b9076bb23adaf808205e49d3b"]

    // await testCancelOrder(orderKeys1);
    // await testCancelOrder(orderKeys2);


    // 4. match order 
    // await testMatchOrder();

    // let orderKeys = ["0x98e25dd9a45bbf79100ebe3b1b311b2b6702a28c9fca5ee317feb0049893faa5",
    //     "0x0c78b81d5da49fe7fd13832aac4aba9f79f31d25453b61ed09ec3ce941adca70",
    //     "0x201dc11898ad0213485b4b34b9702beedc8f3bbcc71b2e38512508adb59c8ea9"];

    // for (let i = 0; i < 2; i++) {
    //     let info = await getOrderInfo(orderKeys[i]);
    //     let sellOrder = info.order;
    //     // console.log("sellOrder: ", sellOrder);
    //     let buyOrder = {
    //         side: Side.Bid,
    //         saleKind: SaleKind.FixedPriceForItem,
    //         maker: trader.address,
    //         nft: sellOrder.nft,
    //         price: sellOrder.price,
    //         expiry: sellOrder.expiry,
    //         salt: sellOrder.salt,
    //     }

    //     let tx = await esDex.connect(trader).matchOrder(sellOrder, buyOrder, { value: toBn("0.002") });
    //     let txRec = await tx.wait();
    //     console.log("matchOrder tx: ", tx.hash);
    // }

    // 5. else
    // await withdrawProtocolFee();
    // await testBatchTransferERC721();
}

async function approvalForVault() {
    const isApproved = await testERC721.isApprovedForAll(deployer.address, vaultAddress);
    if (isApproved) {
        console.log(`Already approved for vault: ${vaultAddress}`);
        return;
    }
    const tx = await testERC721.setApprovalForAll(vaultAddress, true);
    await tx.wait();
    console.log(`Approval tx for ${vaultAddress}:`, tx.hash);
}

async function deployAndMintERC721() {
    const nftFactory = await ethers.getContractFactory(erc721_name);
    testERC721 = await nftFactory.deploy();
    await testERC721.deployed();
    erc721Address = testERC721.address;
    console.log("New ERC721 deployed:", erc721Address);

    for (let tokenId = ORDER_START_TOKEN_ID; tokenId <= ORDER_END_TOKEN_ID; tokenId++) {
        const mintTx = await testERC721.mint(deployer.address, tokenId);
        await mintTx.wait();
    }
    console.log(`Minted token range ${ORDER_START_TOKEN_ID}-${ORDER_END_TOKEN_ID} to deployer`);
}

async function resolveVaultAddressFromOrderBook() {
    const slot = ORDERBOOK_VAULT_SLOT;
    const raw = await ethers.provider.getStorageAt(esDex_address, slot);
    const resolved = ethers.utils.getAddress(`0x${raw.slice(26)}`);
    return resolved;
}

async function canListToken(tokenId) {
    // Token must exist and be owned by maker, otherwise depositNFT will revert.
    let owner;
    try {
        owner = await testERC721.ownerOf(tokenId);
    } catch (error) {
        return {
            ok: false,
            reason: "token does not exist",
            owner: null,
        };
    }

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        return {
            ok: false,
            reason: "token not owned by deployer",
            owner,
        };
    }

    const operatorApproved = await testERC721.isApprovedForAll(deployer.address, vaultAddress);
    if (!operatorApproved) {
        const approved = await testERC721.getApproved(tokenId);
        const approvedLower = approved.toLowerCase();
        if (approvedLower !== vaultAddress.toLowerCase()) {
            return {
                ok: false,
                reason: "vault is not approved for token",
                owner,
            };
        }
    }

    return {
        ok: true,
        reason: "ok",
        owner,
    };
}

async function testMakeOrder(tokenId = 0) {
    const check = await canListToken(tokenId);
    if (!check.ok) {
        console.log(`skip token ${tokenId}: ${check.reason}${check.owner ? ` (owner: ${check.owner})` : ""}`);
        return;
    }

    const now = parseInt(new Date() / 1000, 10) + 100000;
    // Use dynamic salt so repeated runs do not collide with historical orders.
    const salt = now + tokenId;
    const nftAddress = erc721Address;
    // let tokenId = 0;
    const order = {
        side: Side.List,
        saleKind: SaleKind.FixedPriceForItem,
        maker: deployer.address,
        nft: [tokenId, nftAddress, 1],
        price: toBn("0.002"),
        expiry: now,
        salt: salt,
    }

    try {
        await esDex.callStatic.makeOrders([order]);
    } catch (error) {
        console.log(`skip token ${tokenId}: static call failed -> ${error.reason || error.message}`);
        return;
    }

    const tx = await esDex.makeOrders([order]);
    const txRec = await tx.wait();
    console.log(`make order success token ${tokenId}: ${tx.hash} (status: ${txRec.status})`);
}

async function testCancelOrder(orderKeys) {
    const tx = await esDex.cancelOrders(orderKeys);
    const txRec = await tx.wait();
    console.log(txRec);
}

async function testMatchOrder() {
    let now = 1734937947;
    let salt = 1;
    let tokenId = 0;
    let nftAddress = erc721_address;

    let sellOrder = {
        side: Side.List,
        saleKind: SaleKind.FixedPriceForItem,
        maker: deployer.address,
        nft: [tokenId, nftAddress, 1],
        price: toBn("0.002"),
        expiry: now,
        salt: salt,
    }

    // tx = await esDex.makeOrders([sellOrder]);
    // txRec = await tx.wait();
    // console.log("sellOrder tx: ", tx.hash);

    // ====
    let buyOrder = {
        side: Side.Bid,
        saleKind: SaleKind.FixedPriceForCollection,
        maker: trader.address,
        nft: [tokenId, nftAddress, 1],
        price: toBn("0.002"),
        expiry: now,
        salt: salt,
    }

    const tx = await esDex.connect(trader).matchOrder(sellOrder, buyOrder, { value: toBn("0.002") });
    const txRec = await tx.wait();
    console.log("matchOrder tx: ", txRec.hash);
}

async function testBatchTransferERC721() {
    toAddr = "0x7752A564c941f7145AdF8B50AA2eC975cEf58689"
    nftAddr = "0x3c8ac104dcbf03ae12c9ac80aa830e1b39609e97"
    tokenId = 1159
    asset = [nftAddr, tokenId]
    assets = [asset]
    const tx = await esVault.callStatic.batchTransferERC721(toAddr, assets);
    console.log("tx: ", tx);
}

async function getOrderInfo(orderKey) {
    orderInfo = await esDex.orders(orderKey);
    // console.log("orderInfo: ", orderInfo);
    return orderInfo;
}

async function getfillsStat(orderKey) {
    fillStat = await esDex.filledAmount(orderKey);
    // console.log(fillStat);
    return fillStat;
}

async function withdrawProtocolFee() {
    await esDex.withdrawETH(deployer.address, toBn("0.00011"), { gasLimit: 100000 });
    console.log("WithdrawETH succeed.");

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
