# CashX Ecosystem NFT — working brief

## Confirmed from the latest customer message

- Network: PulseChain
- Supply: 10,000 NFTs
- Artwork: the same CashX Ecosystem image for every NFT
- Price: 1,000,000 PLS per NFT
- Mint deadline: none
- Site direction: reuse the clear mint flow, stats, tabs, and dark neon visual language from `cashmoney-mint` and `degenNFT`

## Needed before a live launch

1. Final NFT collection name and ticker/symbol.
2. Treasury wallet address.
3. Final full-resolution artwork file (the current site extracts the image from the supplied chat screenshot).
4. Final metadata name, description, and IPFS URI.
5. Confirmation that ERC-721 is desired even though all tokens share one image. ERC-1155 is a more gas-efficient alternative for identical editions.
6. Maximum mint quantity per transaction.
7. Final decision and contracts for staking/reward utility.
8. Contract review, testnet deployment, and end-to-end wallet testing before enabling payments.

## Safety rule

The preview intentionally does not connect a wallet or request PLS. Wallet writes should only be enabled after the deployed contract, treasury, price, supply, and metadata have all been verified on PulseChain.
