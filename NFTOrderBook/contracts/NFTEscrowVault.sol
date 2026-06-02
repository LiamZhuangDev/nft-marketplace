// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderKey} from "./libraries/OrderTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";

contract NFTEscrowVault is Ownable, IERC721Receiver {
    mapping(OrderKey => uint256) public ETHBalance;
    mapping(OrderKey => uint256) public NFTBalance;
    address public orderBook;

    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "NFTEscrowVault: only order book can call");
        _;
    }

    function setOrderBook(address _orderBook) external onlyOwner {
        require(_orderBook != address(0), "NFTEscrowVault: zero address");
        orderBook = _orderBook;
    }

    function depositETH(OrderKey orderKey, uint256 amount) external payable onlyOrderBook {
        require(msg.value >= amount, "NFTEscrowVault: insufficient ETH sent");
        ETHBalance[orderKey] += amount;
    }

    function withdrawETH(OrderKey orderKey, uint256 amount, address to) external onlyOrderBook {
        require(ETHBalance[orderKey] >= amount, "NFTEscrowVault: insufficient ETH balance");
        ETHBalance[orderKey] -= amount;
        payable(to).transfer(amount);
    }

    function depositNFT(OrderKey orderKey, address from, address collection, uint256 tokenId) external onlyOrderBook {
        IERC721(collection).safeTransferFrom(from, address(this), tokenId);
        NFTBalance[orderKey] = tokenId;
    }

    function withdrawNFT(OrderKey orderKey, address to, address collection, uint256 tokenId) external onlyOrderBook {
        require(NFTBalance[orderKey] == tokenId, "NFTEscrowVault: NFT not in escrow");
        NFTBalance[orderKey] = 0;
        IERC721(collection).safeTransferFrom(address(this), to, tokenId);
    }

    // @dev Implement IERC721Receiver to accept safe transfers of NFTs
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}