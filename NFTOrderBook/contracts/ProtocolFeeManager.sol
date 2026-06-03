// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProtocolFeeManager is Ownable {
    uint128 public protocolFeeBps; // basis points, e.g. 250 = 2.5%
    uint128 public constant MAX_PROTOCOL_FEE_BPS = 1000;

    constructor() Ownable(msg.sender) {}
    
    function setProtocolFeeBps(uint128 newProtocolFeeBps) external onlyOwner {
        require(newProtocolFeeBps <= MAX_PROTOCOL_FEE_BPS, "ProtocolFeeManager: invalid protocol fee basis points");
        protocolFeeBps = newProtocolFeeBps;
    }
}