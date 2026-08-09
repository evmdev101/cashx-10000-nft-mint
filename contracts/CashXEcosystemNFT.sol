// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.2/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@5.0.2/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts@5.0.2/access/Ownable.sol";
import "@openzeppelin/contracts@5.0.2/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts@5.0.2/utils/Strings.sol";

/// @notice Draft only. Review and test before deployment.
/// @dev A 10,000-token ERC-721 edition with a permanent PLS mint price and no deadline.
contract CashXEcosystemNFT is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant PRICE_PER_NFT = 1_000_000 ether;
    uint256 public constant MAX_MINT_PER_TX = 100;

    address payable public immutable treasury;
    uint256 public totalMinted;
    string public baseURI;

    event Minted(address indexed buyer, uint256 quantity, uint256 firstTokenId);
    event BaseURIUpdated(string newBaseURI);

    constructor(address payable treasury_, string memory baseURI_)
        ERC721("CashX Ecosystem", "CASHXNFT")
        Ownable(msg.sender)
    {
        require(treasury_ != address(0), "treasury is zero address");
        treasury = treasury_;
        baseURI = baseURI_;
    }

    function mint(uint256 quantity) external payable nonReentrant {
        require(quantity > 0, "quantity is zero");
        require(quantity <= MAX_MINT_PER_TX, "quantity exceeds tx limit");
        require(totalMinted + quantity <= MAX_SUPPLY, "sold out");
        require(msg.value == PRICE_PER_NFT * quantity, "wrong PLS amount");

        uint256 firstTokenId = totalMinted + 1;
        for (uint256 i = 0; i < quantity; ++i) {
            _safeMint(msg.sender, ++totalMinted);
        }

        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "PLS transfer failed");

        emit Minted(msg.sender, quantity, firstTokenId);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "token does not exist");
        return string.concat(baseURI, tokenId.toString(), ".json");
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
