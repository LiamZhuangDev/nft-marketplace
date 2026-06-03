// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OrderKey, OrderTypes} from "./libraries/OrderTypes.sol";
import {OrderValidator} from "./libraries/OrderValidator.sol";
import {OrderHashing} from "./libraries/OrderHashing.sol";
import {INFTEscrowVault} from "./interfaces/INFTEscrowVault.sol";
import {OrderStorage} from "./OrderStorage.sol";
import {OrderState} from "./OrderState.sol";

contract OrderBook is OrderStorage, OrderState {
    address public nftEscrowVault;

    constructor(address _nftEscrowVault) {
        require(_nftEscrowVault != address(0), "NFTEscrowVault: zero address");
        nftEscrowVault = _nftEscrowVault;
    }

    function createOrder(OrderTypes.Order memory order) external payable {
        // validate ord_validateOrder
        OrderValidator._validateOrder(order, false);

        // move asset to escrow
        if (order.side == OrderTypes.Side.List) {
            INFTEscrowVault(nftEscrowVault).depositNFT(
                OrderHashing.hashOrder(order),
                order.maker,
                order.nft.collection,
                order.nft.tokenId
            );
        } else if (order.side == OrderTypes.Side.Offer) {
            INFTEscrowVault(nftEscrowVault).depositETH{value: msg.value}(
                OrderHashing.hashOrder(order),
                msg.value
            );
        }

        // save order to storage
        _addOrder(order);
    }

    function matchOrder(OrderTypes.Order calldata listing, OrderTypes.Order calldata offer) external payable{
        OrderValidator._validateOrder(listing, false);
        OrderValidator._validateOrder(offer, false);

        require(listing.side == OrderTypes.Side.List, "listing must be list side");
        require(offer.side == OrderTypes.Side.Offer, "offer must be offer side");
        require(listing.nft.collection == offer.nft.collection, "collection mismatch");
        require(offer.price >= listing.price, "offer price too low");

        if (offer.saleKind == OrderTypes.SaleKind.FixedPriceForItem) {
            require(listing.nft.tokenId == offer.nft.tokenId, "tokenId mismatch");
        }

        OrderKey listingKey = OrderHashing.hashOrder(listing);
        OrderKey offerKey = OrderHashing.hashOrder(offer);
        bool listingExists = orders[listingKey].maker != address(0);
        bool offerExists = orders[offerKey].maker != address(0);
        bool listingCancelled = _isCancelled(listingKey);
        bool offerCancelled = _isCancelled(offerKey);

        if (msg.sender == offer.maker) {
            _buyerAcceptsListing(listing, offer, listingKey, listingExists && !listingCancelled, offerExists);
        } else if (msg.sender == listing.maker) {
            _sellerAcceptsOffer(listing, offer, listingKey, offerKey, listingExists && !listingCancelled, offerExists && !offerCancelled);
        } else {
            revert("sender must be listing maker or offer maker");
        }
    }

    // @dev Buyer accepts listing: listing must exist and not cancelled, offer must not exist, buyer sends fresh ETH equal or above listing price
    function _buyerAcceptsListing(
        OrderTypes.Order calldata listing,
        OrderTypes.Order calldata offer,
        OrderKey listingKey,
        bool listingExistsAndNotCancelled,
        bool offerExists
    ) internal {
        require(listingExistsAndNotCancelled, "listing not found or cancelled");
        require(!offerExists, "stored offer cannot buy listing");
        require(msg.value >= listing.price, "insufficient ETH sent");

        _updateFilledAmount(listingKey, listing.nft.amount);
        _removeOrder(listing);

        payable(listing.maker).transfer(listing.price);
        INFTEscrowVault(nftEscrowVault).withdrawNFT(
            listingKey,
            offer.maker,
            listing.nft.collection,
            listing.nft.tokenId
        );

        if (msg.value > listing.price) {
            payable(offer.maker).transfer(msg.value - listing.price);
        }
    }

    // @dev Seller accepts offer: stored escrowed offer only, seller does not send ETH, supports partial fill of offer
    function _sellerAcceptsOffer(
        OrderTypes.Order calldata listing,
        OrderTypes.Order calldata offer,
        OrderKey listingKey,
        OrderKey offerKey,
        bool listingExistsAndNotCancelled,
        bool offerExistsAndNotCancelled
    ) internal {
        require(offerExistsAndNotCancelled, "offer not found or cancelled");
        require(msg.value == 0, "seller should not send ETH");

        uint256 offerFilledAmount = _getFilledAmount(offerKey);
        require(offerFilledAmount < offer.nft.amount, "offer fully filled");

        if (listingExistsAndNotCancelled) {
            _updateFilledAmount(listingKey, listing.nft.amount);
            _removeOrder(listing);
            INFTEscrowVault(nftEscrowVault).withdrawNFT(
                listingKey,
                offer.maker,
                listing.nft.collection,
                listing.nft.tokenId
            );
        } else {
            INFTEscrowVault(nftEscrowVault).transferNFT(
                listing.maker,
                offer.maker,
                listing.nft.collection,
                listing.nft.tokenId
            );
        }

        uint256 newOfferFilledAmount = offerFilledAmount + listing.nft.amount;
        _updateFilledAmount(offerKey, newOfferFilledAmount);
        if (newOfferFilledAmount == offer.nft.amount) {
            _removeOrder(offer);
        }

        INFTEscrowVault(nftEscrowVault).withdrawETH(
            offerKey,
            offer.price,
            listing.maker
        );
    }

    function cancelOrder(OrderKey orderKey) external {
        // load order from storage
        OrderTypes.Order memory order = orders[orderKey];
        // validate order
        OrderValidator._validateOrder(order, true);
        // mark order as cancelled
        _cancelOrder(orderKey);
        // remove order from storage
        _removeOrder(order);
        // move asset back to maker
        if (order.side == OrderTypes.Side.List) {
            INFTEscrowVault(nftEscrowVault).withdrawNFT(
                orderKey,
                order.maker,
                order.nft.collection,
                order.nft.tokenId
            );
        } else if (order.side == OrderTypes.Side.Offer) {
            INFTEscrowVault(nftEscrowVault).withdrawETH(
                orderKey,
                order.price,
                order.maker
            );
        }
    }
}
