// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderKey, OrderTypes} from "../libraries/OrderTypes.sol";

interface INFTEscrowVault {
    function depositNFT(OrderKey orderKey, address from, address collection, uint256 tokenId) external;

    function withdrawNFT(OrderKey orderKey, address to, address collection, uint256 tokenId) external;

    function depositETH(OrderKey orderKey, uint256 amount) external payable;

    function withdrawETH(OrderKey orderKey, uint256 amount, address to) external;

    function transferNFT(address from, address to, address collection, uint256 tokenId) external;
}
