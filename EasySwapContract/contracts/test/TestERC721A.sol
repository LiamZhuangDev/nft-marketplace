// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract TestERC721 is ERC721Enumerable, Ownable {
    string private _tokenURI;
    using Strings for uint256;

    constructor() ERC721("Troll", "Troll") Ownable(msg.sender) {}

    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }

    mapping(uint256 => string) private _tokenURIs;

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory mapURI = _tokenURIs[tokenId];
        if (bytes(mapURI).length != 0) {
            return mapURI;
        }
        if (bytes(_tokenURI).length == 0) {
            return string(abi.encodePacked("ipfs://test-erc721/", tokenId.toString()));
        }
        return string(abi.encodePacked(_tokenURI, tokenId.toString()));
    }

    function setTokenURI(string memory newTokenURI) external onlyOwner {
        _tokenURI = newTokenURI;
    }

    function setTokenURI(uint256 tokenId, string memory newTokenURI) external onlyOwner {
        _requireOwned(tokenId);
        _tokenURIs[tokenId] = newTokenURI;
    }
}