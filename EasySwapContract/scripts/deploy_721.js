const { ethers, upgrades } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("deployer: ", deployer.address)

  let TestERC721 = await ethers.getContractFactory("TestERC721")
  const testERC721 = await TestERC721.deploy()
  await testERC721.deployed()
  console.log("testERC721 contract deployed to:", testERC721.address)

  //mint
  tx = await testERC721.mint(deployer.address, 50)
  await tx.wait()
  console.log("mint tx:", tx.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
