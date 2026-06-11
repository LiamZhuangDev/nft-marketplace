const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

const Side = {
  List: 0,
  Offer: 1,
};

const SaleKind = {
  FixedPriceForCollection: 0,
  FixedPriceForItem: 1,
};

describe("OrderBook", function () {
  async function deployFixture() {
    const [deployer, seller, buyer, feeRecipient] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("NFTEscrowVault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const weth = await TestERC20.deploy();
    await weth.waitForDeployment();

    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy(vault.target, feeRecipient.address, weth.target);
    await orderBook.waitForDeployment();

    await vault.setOrderBook(orderBook.target);

    const TestNFT = await ethers.getContractFactory("TestNFT");
    const nft = await TestNFT.deploy();
    await nft.waitForDeployment();

    await nft.mint(seller.address, 1);
    await nft.mint(seller.address, 2);
    await nft.connect(seller).setApprovalForAll(vault.target, true);
    await weth.mint(buyer.address, ethers.parseEther("10"));
    await weth.connect(buyer).approve(orderBook.target, ethers.MaxUint256);

    await orderBook.setProtocolFeeBps(250);

    return { deployer, seller, buyer, feeRecipient, vault, orderBook, nft, weth };
  }

  function listing({ seller, nft, tokenId, price, salt, userNonce = 0 }) {
    return {
      side: Side.List,
      saleKind: SaleKind.FixedPriceForItem,
      maker: seller.address,
      userNonce,
      nft: {
        tokenId,
        collection: nft.target,
        amount: 1,
      },
      price,
      expiry: 0,
      salt,
    };
  }

  function offer({ buyer, nft, tokenId, price, salt, userNonce = 0 }) {
    return {
      side: Side.Offer,
      saleKind: SaleKind.FixedPriceForItem,
      maker: buyer.address,
      userNonce,
      nft: {
        tokenId,
        collection: nft.target,
        amount: 1,
      },
      price,
      expiry: 0,
      salt,
    };
  }

  async function signingDomain(orderBook) {
    const { chainId } = await ethers.provider.getNetwork();

    return {
      name: "NFTOrderBook",
      version: "1",
      chainId,
      verifyingContract: orderBook.target,
    };
  }

  const orderTypes = {
    Asset: [
      { name: "tokenId", type: "uint256" },
      { name: "collection", type: "address" },
      { name: "amount", type: "uint96" },
    ],
    Order: [
      { name: "side", type: "uint8" },
      { name: "saleKind", type: "uint8" },
      { name: "maker", type: "address" },
      { name: "userNonce", type: "uint256" },
      { name: "nft", type: "Asset" },
      { name: "price", type: "uint128" },
      { name: "expiry", type: "uint64" },
      { name: "salt", type: "uint64" },
    ],
  };

  it("recovers the maker from a signed order", async function () {
    const { seller, buyer, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 11 });
    const domain = await signingDomain(orderBook);

    // `signTypedData` is the wallet-side function that signs an EIP-712 typed message.
    // It means seller signs this exact Order object off-chain.
    const sellerSignature = await seller.signTypedData(domain, orderTypes, sellOrder);
    const buyerSignature = await buyer.signTypedData(domain, orderTypes, sellOrder);

    expect(await orderBook.recoverOrderSigner(sellOrder, sellerSignature)).to.equal(seller.address);
    expect(await orderBook.verifyOrderSignature(sellOrder, sellerSignature)).to.equal(true);
    expect(await orderBook.verifyOrderSignature(sellOrder, buyerSignature)).to.equal(false);
  });

  it("lets a buyer accept a signed listing without pre-escrow", async function () {
    const { seller, buyer, feeRecipient, orderBook, nft, vault } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 12 });
    const buyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 13 });
    const domain = await signingDomain(orderBook);
    const sellerSignature = await seller.signTypedData(domain, orderTypes, sellOrder);

    expect(await nft.ownerOf(1)).to.equal(seller.address);

    const protocolFee = (price * 250n) / 10_000n;
    const sellerAmount = price - protocolFee;

    await expect(
      orderBook.connect(buyer).matchSignedListing(sellOrder, buyIntent, sellerSignature, { value: price })
    ).to.changeEtherBalances(
      [seller, feeRecipient],
      [sellerAmount, protocolFee]
    );

    expect(await nft.ownerOf(1)).to.equal(buyer.address);
    expect(await nft.ownerOf(2)).to.equal(seller.address);
    expect(await ethers.provider.getBalance(vault.target)).to.equal(0);
  });

  it("lets a seller accept a signed ERC20 buyer offer", async function () {
    const { seller, buyer, feeRecipient, orderBook, nft, weth } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellIntent = listing({ seller, nft, tokenId: 1, price, salt: 12 });
    const buyOffer = offer({ buyer, nft, tokenId: 1, price, salt: 13 });
    const domain = await signingDomain(orderBook);
    const buyerSignature = await buyer.signTypedData(domain, orderTypes, buyOffer);
    const protocolFee = (price * 250n) / 10_000n;
    const sellerAmount = price - protocolFee;

    await expect(
      orderBook.connect(seller).matchSignedOffer(sellIntent, buyOffer, buyerSignature)
    ).to.changeTokenBalances(
      weth,
      [buyer, seller, feeRecipient],
      [-price, sellerAmount, protocolFee]
    );

    expect(await nft.ownerOf(1)).to.equal(buyer.address);
  });

  it("rejects a signed ERC20 offer with the wrong signer", async function () {
    const { seller, buyer, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellIntent = listing({ seller, nft, tokenId: 1, price, salt: 14 });
    const buyOffer = offer({ buyer, nft, tokenId: 1, price, salt: 15 });
    const domain = await signingDomain(orderBook);
    const sellerSignature = await seller.signTypedData(domain, orderTypes, buyOffer);

    await expect(
      orderBook.connect(seller).matchSignedOffer(sellIntent, buyOffer, sellerSignature)
    ).to.be.revertedWith("invalid offer signature");
  });

  it("rejects a signed listing with the wrong signer", async function () {
    const { seller, buyer, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 14 });
    const buyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 15 });
    const domain = await signingDomain(orderBook);
    const buyerSignature = await buyer.signTypedData(domain, orderTypes, sellOrder);

    await expect(
      orderBook.connect(buyer).matchSignedListing(sellOrder, buyIntent, buyerSignature, { value: price })
    ).to.be.revertedWith("invalid listing signature");
  });

  it("lets the maker cancel a signed listing before it is matched", async function () {
    const { seller, buyer, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 16 });
    const buyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 17 });
    const domain = await signingDomain(orderBook);
    const sellerSignature = await seller.signTypedData(domain, orderTypes, sellOrder);

    await expect(orderBook.connect(buyer).cancelSignedOrder(sellOrder)).to.be.revertedWith("only maker can cancel");

    await orderBook.connect(seller).cancelSignedOrder(sellOrder);

    await expect(
      orderBook.connect(buyer).matchSignedListing(sellOrder, buyIntent, sellerSignature, { value: price })
    ).to.be.revertedWith("listing cancelled");
  });

  it("lets the maker bulk-cancel old signed listings by incrementing userNonce", async function () {
    const { seller, buyer, feeRecipient, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const oldListing = listing({ seller, nft, tokenId: 1, price, salt: 18, userNonce: 0 });
    const oldBuyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 19 });
    const domain = await signingDomain(orderBook);
    const oldSignature = await seller.signTypedData(domain, orderTypes, oldListing);

    await expect(orderBook.connect(seller).incrementUserNonce())
      .to.emit(orderBook, "UserNonceIncremented")
      .withArgs(seller.address, 1);

    await expect(
      orderBook.connect(buyer).matchSignedListing(oldListing, oldBuyIntent, oldSignature, { value: price })
    ).to.be.revertedWith("invalid user nonce");

    const newListing = listing({ seller, nft, tokenId: 1, price, salt: 20, userNonce: 1 });
    const newBuyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 21 });
    const newSignature = await seller.signTypedData(domain, orderTypes, newListing);
    const protocolFee = (price * 250n) / 10_000n;
    const sellerAmount = price - protocolFee;

    await expect(
      orderBook.connect(buyer).matchSignedListing(newListing, newBuyIntent, newSignature, { value: price })
    ).to.changeEtherBalances(
      [seller, feeRecipient],
      [sellerAmount, protocolFee]
    );

    expect(await nft.ownerOf(1)).to.equal(buyer.address);
  });

  it("requires stored escrow orders to use cancelOrder", async function () {
    const { seller, orderBook, nft } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 22 });

    await orderBook.connect(seller).createOrder(sellOrder);

    await expect(orderBook.connect(seller).cancelSignedOrder(sellOrder)).to.be.revertedWith(
      "use cancelOrder for stored order"
    );
  });

  it("lets a buyer accept an existing listing with fresh ETH", async function () {
    const { seller, buyer, feeRecipient, orderBook, nft, vault } = await loadFixture(deployFixture);
    const price = ethers.parseEther("1");
    const sellOrder = listing({ seller, nft, tokenId: 1, price, salt: 1 });
    const buyIntent = offer({ buyer, nft, tokenId: 1, price, salt: 2 });

    await orderBook.connect(seller).createOrder(sellOrder);
    expect(await nft.ownerOf(1)).to.equal(vault.target);

    const protocolFee = (price * 250n) / 10_000n;
    const sellerAmount = price - protocolFee;

    await expect(
      orderBook.connect(buyer).matchOrder(sellOrder, buyIntent, { value: price })
    ).to.changeEtherBalances(
      [seller, feeRecipient],
      [sellerAmount, protocolFee]
    );

    expect(await nft.ownerOf(1)).to.equal(buyer.address);
  });

  it("lets a seller accept an existing escrowed offer", async function () {
    const { seller, buyer, feeRecipient, orderBook, nft, vault } = await loadFixture(deployFixture);
    const price = ethers.parseEther("0.5");
    const sellIntent = listing({ seller, nft, tokenId: 2, price, salt: 3 });
    const buyOrder = offer({ buyer, nft, tokenId: 2, price, salt: 4 });

    await orderBook.connect(buyer).createOrder(buyOrder, { value: price });
    expect(await ethers.provider.getBalance(vault.target)).to.equal(price);

    const protocolFee = (price * 250n) / 10_000n;
    const sellerAmount = price - protocolFee;

    await expect(
      orderBook.connect(seller).matchOrder(sellIntent, buyOrder)
    ).to.changeEtherBalances(
      [seller, feeRecipient, vault],
      [sellerAmount, protocolFee, -price]
    );

    expect(await nft.ownerOf(2)).to.equal(buyer.address);
  });
});
