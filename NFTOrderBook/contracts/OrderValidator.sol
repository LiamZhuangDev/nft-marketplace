// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes} from "./libraries/OrderTypes.sol";

contract OrderValidator {
    function validateOrder(OrderTypes.Order memory order, bool skipExpiry) internal view {
        require(order.maker != address(0), "missing maker");

        if (!skipExpiry) {
            require(order.expiry == 0 || order.expiry > block.timestamp, "order expired");
        }

        require(order.salt != 0, "missing salt");

        if (order.side == OrderTypes.Side.List) {
            require(order.nft.collection != address(0), "missing nft collection");
        } else if (order.side == OrderTypes.Side.Offer) {
            require(order.price > 0, "invalid price");
        }
    }
}