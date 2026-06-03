// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "../libraries/OrderTypes.sol";

interface IOrderBook {
    function createOrder(OrderTypes.Order memory order) external payable;

    function matchOrder(OrderTypes.Order calldata listing, OrderTypes.Order calldata offer) external payable;

    function cancelOrder(OrderKey orderKey) external;
}