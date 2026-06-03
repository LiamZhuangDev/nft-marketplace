// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "./libraries/OrderTypes.sol";
import {OrderHashing} from "./libraries/OrderHashing.sol";
import {IOrderStorage} from "./interfaces/IOrderStorage.sol";

contract OrderStorage is IOrderStorage {
    mapping(OrderKey => OrderTypes.Order) public orders;

    function _addOrder(OrderTypes.Order memory order) internal returns (OrderKey orderKey) {
        orderKey = OrderHashing.hashOrder(order);
        bool orderExist = orders[orderKey].maker != address(0);
        require(!orderExist, "order exist");

        orders[orderKey] = order;
    }

    function _removeOrder(OrderTypes.Order memory order) internal returns (OrderKey orderKey) {
        orderKey = OrderHashing.hashOrder(order);
        bool orderExist = orders[orderKey].maker != address(0);
        require(orderExist, "order not exist");

        delete orders[orderKey];
    }

    function getOrder(OrderKey orderKey) external view returns (OrderTypes.Order memory order) {
        order = orders[orderKey];
        require(order.maker != address(0), "order not exist");
    }

    function getOrders(OrderKey[] memory orderKeys) external view returns (OrderTypes.Order[] memory result) {
        result = new OrderTypes.Order[](orderKeys.length);
        for (uint256 i = 0; i < orderKeys.length; i++) {
            OrderTypes.Order memory order = orders[orderKeys[i]];
            require(order.maker != address(0), "order not exist");
            result[i] = order;
        }
    }
}