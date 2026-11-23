# Mini-Project Submission

## Project details

| Particulars | Details |
| --- | --- |
| Selected Project Title | **CarbonLedger: A Decentralized Carbon Credit Tracking, Trading and Retirement System** |
| Project Number | **23** |
| Technologies Proposed | Solidity 0.8.24, Ethereum Sepolia, Remix IDE / Hardhat, OpenZeppelin Contracts, React.js + Vite, ethers.js v6, MetaMask, GitHub |

## Abstract (150–200 words)

Carbon markets depend on trust: a credit must be issued only once, traded transparently, and retired
permanently so that it cannot be double-counted. Conventional registries are centralised and opaque,
which leaves room for fraud and duplicate claims. This project, CarbonLedger, is a decentralised
application on Ethereum that manages the complete lifecycle of carbon credits through smart
contracts. Projects are registered with a keccak256 hash of their methodology document and verified
by an authorised verifier. Verified projects issue credits as ERC-1155 batches, where each token id
represents a distinct project and vintage and balances are measured in tonnes of CO2e. A
non-custodial marketplace escrows credits, supports partial purchases, charges a configurable fee
and lets sellers withdraw proceeds safely. Retirement irreversibly burns credits and mints a
soulbound ERC-721 certificate whose artwork and metadata are generated fully on-chain. Role-based
access control, pausable contracts, reentrancy protection, issuance caps and duplicate-serial checks
secure the system. The React frontend integrates MetaMask and ethers.js and runs against the Sepolia
testnet. Thirty-one automated tests cover valid flows, access control and negative cases.

## One-line description

A blockchain-based carbon credit registry and marketplace where verified projects issue credits,
companies trade them, and retirement permanently burns them while minting a tamper-proof on-chain
certificate.
