// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract ERC721WithURI is ERC721Enumerable, Ownable {
    string private _tokenURI;

    mapping(uint256 => string) private _tokenURIs;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        string memory mapURI = _tokenURIs[tokenId];
        if (keccak256(bytes(mapURI)) == keccak256(bytes(""))) {
            return _tokenURI;
        }
        return _tokenURI;
    }

    function setTokenURI(string memory newTokenURI) external onlyOwner {
        _tokenURI = newTokenURI;
    }

    function setTokenURI(uint256 tokenId, string memory newTokenURI) external onlyOwner {
        _tokenURIs[tokenId] = newTokenURI;
    }
}
