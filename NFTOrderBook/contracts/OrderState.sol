// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "./libraries/OrderTypes.sol";

contract OrderState {
    uint256 private constant CANCELLED = type(uint256).max;
    mapping(OrderKey => uint256) public filledAmount;

    function getFilledAmount(OrderKey orderKey) internal view returns (uint256 amount) {
        amount = filledAmount[orderKey];
        require(amount != CANCELLED, "order cancelled");
    }

    function updateFilledAmount(OrderKey orderKey, uint256 amount) internal {
        require(amount != CANCELLED, "order cancelled");
        filledAmount[orderKey] = amount;
    }

    function cancelOrder(OrderKey orderKey) internal {
        filledAmount[orderKey] = CANCELLED;
    }
}