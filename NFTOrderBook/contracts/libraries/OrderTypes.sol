// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

type OrderKey is bytes32;

library OrderTypes {
    enum Side {
        List,
        Offer
    }

    enum SaleKind {
        FixedPriceForCollection,
        FixedPriceForItem
    }

    struct Asset {
        uint256 tokenId;
        address collection;
        uint96 amount;
    }

    struct NFTInfo {
        address collection;
        uint256 tokenId;
    }

    struct Order {
        Side side;
        SaleKind saleKind;
        address maker;
        Asset nft;
        uint128 price; // unit price of nft
        uint64 expiry;
        uint64 salt;
    }

    struct DBOrder {
        Order order;
        OrderKey next;
    }

    // @dev Order queue: used to store orders of the same price
    struct OrderQueue {
        OrderKey head;
        OrderKey tail;
    }

    OrderKey public constant ORDERKEY_SENTINEL = OrderKey.wrap(0x0);
}