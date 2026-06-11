// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "../libraries/OrderTypes.sol";

interface IOrderBook {
    event OrderCreated(
        OrderKey orderKey,
        OrderTypes.Side indexed side,
        OrderTypes.SaleKind indexed saleKind,
        address indexed maker,
        OrderTypes.Asset nft,
        uint128 price,
        uint64 expiry,
        uint64 salt
    );

    event OrderCancelled(OrderKey indexed orderKey, address indexed maker);

    event OrderMatched(
        OrderKey indexed listingOrderKey,
        OrderKey indexed offerOrderKey,
        address indexed taker,
        OrderTypes.Order listing,
        OrderTypes.Order offer,
        uint128 fillPrice
    );

    function createOrder(OrderTypes.Order memory order) external payable;

    function hashTypedOrder(OrderTypes.Order memory order) external view returns (bytes32);

    function recoverOrderSigner(OrderTypes.Order memory order, bytes memory signature) external view returns (address);

    function verifyOrderSignature(OrderTypes.Order memory order, bytes memory signature) external view returns (bool);

    function matchOrder(OrderTypes.Order calldata listing, OrderTypes.Order calldata offer) external payable;

    function cancelOrder(OrderKey orderKey) external;
}
