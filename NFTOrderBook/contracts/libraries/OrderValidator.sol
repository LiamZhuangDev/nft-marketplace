// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes} from "./OrderTypes.sol";

library OrderValidator {
    function _validateOrder(OrderTypes.Order memory order, bool skipExpiry) internal view {
        require(order.maker != address(0), "missing maker");

        if (!skipExpiry) {
            require(order.expiry == 0 || order.expiry > block.timestamp, "order expired");
        }

        require(order.salt != 0, "missing salt");
        require(order.price > 0, "invalid price");

        if (order.side == OrderTypes.Side.List) {
            require(order.nft.collection != address(0), "missing nft collection");
            require(order.nft.amount == 1, "Invalid NFT amount for listing");
            require(order.nft.tokenId > 0, "Invalid NFT tokenId");
        }

        if (order.side == OrderTypes.Side.Offer) {
            if (order.saleKind == OrderTypes.SaleKind.FixedPriceForItem) {
                require(order.nft.amount == 1, "Invalid NFT amount for item offer");
            } else if (order.saleKind == OrderTypes.SaleKind.FixedPriceForCollection) {
                require(order.nft.amount >= 1, "Invalid NFT amount for collection offer");
            } else {
                revert("invalid sale kind");
            }
        }
    }
}