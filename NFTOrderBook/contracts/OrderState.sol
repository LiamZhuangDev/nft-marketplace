// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "./libraries/OrderTypes.sol";

// This contract tracks the filled amount of orders and their cancellation status.
// filledAmount[key] == 0                  -> open, not filled
// filledAmount[key] > 0                   -> partially/fully filled
// filledAmount[key] == type(uint256).max  -> cancelled
contract OrderState {
    uint256 private constant CANCELLED = type(uint256).max;
    mapping(OrderKey => uint256) public filledAmount;

    function _getFilledAmount(OrderKey orderKey) internal view returns (uint256 amount) {
        amount = filledAmount[orderKey];
        require(amount != CANCELLED, "order cancelled");
    }

    function _updateFilledAmount(OrderKey orderKey, uint256 amount) internal {
        require(amount != CANCELLED, "order cancelled");
        filledAmount[orderKey] = amount;
    }

    function _cancelOrder(OrderKey orderKey) internal {
        filledAmount[orderKey] = CANCELLED;
    }
}