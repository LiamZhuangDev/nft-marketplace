// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "../libraries/OrderTypes.sol";

interface IOrderStorage{
    function getOrder(OrderKey orderKey) external view returns (OrderTypes.Order memory order);
    function getOrders(OrderKey[] memory orderKeys) external view returns (OrderTypes.Order[] memory orders);
}