// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderTypes, OrderKey} from "./OrderTypes.sol";

library OrderHashing {
    bytes32 public constant ASSET_TYPEHASH = keccak256(
        "Asset(uint256 tokenId,address collection,uint96 amount)"
    );

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(uint8 side,uint8 saleKind,address maker,uint256 userNonce,Asset nft,uint128 price,uint64 expiry,uint64 salt)Asset(uint256 tokenId,address collection,uint96 amount)"
    );

    function hashAsset(OrderTypes.Asset memory asset) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ASSET_TYPEHASH,
                asset.tokenId,
                asset.collection,
                asset.amount
            )
        );
    }

    function hashOrder(OrderTypes.Order memory order) internal pure returns (OrderKey) {
        return OrderKey.wrap(
            keccak256(
                abi.encodePacked(
                    ORDER_TYPEHASH,
                    order.side,
                    order.saleKind,
                    order.maker,
                    order.userNonce,
                    hashAsset(order.nft),
                    order.price,
                    order.expiry,
                    order.salt
                )
            )
        );
    }

    function hashOrderStruct(OrderTypes.Order memory order) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.side,
                order.saleKind,
                order.maker,
                order.userNonce,
                hashAsset(order.nft),
                order.price,
                order.expiry,
                order.salt
            )
        );
    }
}
