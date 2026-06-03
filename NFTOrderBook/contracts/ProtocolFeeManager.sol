// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProtocolFeeManager is Ownable {
    uint128 public protocolShare;
    uint128 public constant MAX_PROTOCOL_SHARE = 1000;

    constructor() Ownable(msg.sender) {}
    
    function setProtocolShare(uint128 newProtocolShare) external onlyOwner {
        require(newProtocolShare <= MAX_PROTOCOL_SHARE, "ProtocolFeeManager: invalid protocol share");
        protocolShare = newProtocolShare;
    }
}