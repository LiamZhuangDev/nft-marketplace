# NFT Order Book

## Overview
This reimplements `EasySwapContract` for practice purpose.

```bash
mkdir NFTOrderBook
cd NFTOrderBook
npm init -y
npm install --save-dev hardhat@^2.22.0
npx hardhat
```
When the prompt appears, choose something like:
```text
Create a JavaScript project
```
That will generate a basic structure like:
```text
NFTOrderBook/
  contracts/
  scripts/
  test/
  hardhat.config.js
  package.json
```
Install OpenZeppelin if not already:
```bash
npm install --save-dev @openzeppelin/contracts
```