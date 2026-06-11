// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "./libraries/OrderTypes.sol";

// This contract tracks the filled amount of orders and their cancellation status.
// filledAmount[key] == 0                  -> open, not filled
// filledAmount[key] > 0                   -> partially/fully filled
// filledAmount[key] == type(uint256).max  -> cancelled
contract OrderState {
    uint256 private constant CANCELLED = type(uint256).max;
    mapping(OrderKey => uint256) public filledAmount; // orderKey => filledAmount, mutable order execution state
    mapping(address => uint256) public userNonce; // maker => current signed-order nonce

    function _getFilledAmount(OrderKey orderKey) internal view returns (uint256 amount) {
        amount = filledAmount[orderKey];
        require(amount != CANCELLED, "order cancelled");
    }

    function _updateFilledAmount(OrderKey orderKey, uint256 amount) internal {
        require(filledAmount[orderKey] != CANCELLED, "order cancelled");
        require(amount != CANCELLED, "invalid filled amount");
        filledAmount[orderKey] = amount;
    }

    function _cancelOrder(OrderKey orderKey) internal {
        filledAmount[orderKey] = CANCELLED;
    }

    function _isCancelled(OrderKey orderKey) internal view returns (bool) {
        return filledAmount[orderKey] == CANCELLED;
    }

    function _incrementUserNonce(address user) internal returns (uint256 newNonce) {
        newNonce = userNonce[user] + 1;
        userNonce[user] = newNonce;
    }
}
