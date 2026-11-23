# Viva preparation

Short, technically accurate answers. Both team members should be able to answer any of these.

---

## A. Problem and design

**1. What problem does CarbonLedger solve?**
Carbon credits can be double-counted: the same tonne is claimed by a project, sold to several
buyers, or "retired" more than once. CarbonLedger makes issuance, ownership and retirement public
and enforceable, so a credit exists once and retirement is permanent.

**2. Why does this need a blockchain instead of a database?**
A database is controlled by one operator who can silently edit history. Here, verification,
issuance caps, ownership and retirement are rules in immutable code, every action emits an event,
and anyone can verify the state without trusting the operator.

**3. What are the four contracts and why split them?**
`ProjectRegistry` (projects/verification), `CarbonCreditToken` (credits), `RetirementCertificate`
(proof), `CarbonMarketplace` (trading). Separation of concerns keeps each contract small, easier to
audit and easier to explain. The token only trusts the registry for verification and the certificate
for minting.

**4. Which standard is used for credits and why?**
ERC-1155. A batch is fungible within itself (1 tonne = 1 tonne) but distinct from other
projects/vintages. It supports partial retirement natively and both fungible and non-fungible
behaviour in one contract.

**5. Why ERC-721 for certificates?**
Each certificate is a unique proof, so a non-fungible token fits. It is made **soulbound** by
blocking transfers, so it cannot be sold away from the beneficiary.

**6. What is stored on-chain vs off-chain?**
On-chain: project metadata, `keccak256` document hashes, credits, ownership, retirements,
certificates. Off-chain: the actual methodology PDFs and any private company data. Only hashes are
needed to prove integrity.

**7. What is the role of `keccak256`?**
It produces a fixed 32-byte fingerprint. If a document changes by one byte the hash changes, so a
verifier can prove the registered document is the one presented. The hash is also used for unique
serial numbers.

---

## B. Solidity concepts

**8. Where are structs, mappings and arrays used?**
`Project` and `Batch` structs store grouped data; `mapping(uint256 => Project)` and
`mapping(bytes32 => bool) serialHashUsed` give O(1) lookup; dynamic arrays store project ids per
developer and certificate ids per owner.

**9. What do the modifiers do?**
`onlyRole(...)` from OpenZeppelin restricts callers. `whenNotPaused` blocks actions during an
emergency. `existingProject` ensures the id exists. `nonReentrant` prevents reentrant calls.
`projectExists` was renamed to `existingProject` because Solidity does not allow a modifier and a
function with the same name.

**10. Why are events important?**
Events are cheap, searchable logs. The UI rebuilds the entire activity feed and holder portfolios
from events, and Etherscan displays them. They are the transparent audit trail required by the
project brief.

**11. What is `msg.sender` vs `tx.origin`?**
`msg.sender` is the immediate caller (a contract or wallet) and is safe for authorization.
`tx.origin` is the original wallet and is vulnerable to phishing via an intermediate contract, so it
is never used here.

**12. What is checks-effects-interactions?**
Update state (effects) before calling external contracts (interactions). In `retireCredits` we
increase `retiredTonnes`, burn the credits, and only then call the certificate contract. In
`buyCredits` we reduce `remaining` and credit proceeds before transferring tokens.

**13. What is reentrancy and how is it prevented?**
A malicious contract can call back into the function before the first call finishes. We use
OpenZeppelin `ReentrancyGuard` (`nonReentrant`) on every value-moving marketplace function, plus
checks-effects-interactions and pull payments.

**14. What is a pull-payment pattern?**
Instead of sending ETH to a seller inside `buyCredits` (which can fail or re-enter), the contract
credits `proceeds[seller]`. The seller withdraws later with `withdrawProceeds()`. Same for platform
fees.

**15. Why `immutable` for the registry/token addresses?**
`registry` and `credits` never change, so `immutable` stores them in bytecode, saving storage gas and
preventing accidental replacement.

**16. What is the difference between `storage` and `memory`?**
`storage` points to persistent contract state; `memory` is a temporary copy. Structs returned from
view functions are `memory`. Writing to a `storage` pointer modifies state; writing to `memory` does
not.

**17. Why is `uint64` used for timestamps?**
Unix timestamps fit comfortably in 64 bits until the year 584 billion, and packing smaller types can
save storage slots when they are declared together.

**18. What does `payable` mean?**
The function/address can receive ETH. `buyCredits` is `payable`; `withdrawProceeds` casts the seller
to `payable` before sending ETH.

**19. How does Solidity 0.8 handle overflows?**
Arithmetic reverts on overflow/underflow by default, so no `SafeMath` is needed. We still validate
inputs and cap values explicitly.

**20. What is `calldata` vs `memory` for string parameters?**
`calldata` is read-only and cheaper for external function inputs; `memory` is a mutable copy used for
internally built strings (e.g. the certificate SVG).

---

## C. Access control and security

**21. How does OpenZeppelin `AccessControl` work?**
Each role is a `bytes32` hash. `_grantRole` stores `mapping(bytes32 => mapping(address => bool))`.
`onlyRole(ROLE)` checks membership and reverts with `AccessControlUnauthorizedAccount`.

**22. Who can do what?**
Admin: roles, fee, treasury, fees withdrawal. Verifier: project approval/revocation. Minter: issue
batches. Pauser: pause/unpause. Any wallet: register projects, transfer, retire, trade.

**23. What stops an admin from abusing power?**
On-chain actions are visible and irreversible, the fee is capped at 10%, and the deployer role can be
transferred to a multi-signature wallet. The demo uses a single admin for simplicity; production
would use a multisig/timelock.

**24. What happens if a project is revoked?**
`isVerified` returns false, so new batches cannot be issued. Existing credits remain valid and
tradeable — revocation is not a retroactive burn.

**25. How is double counting prevented?**
(1) Unique serial hash per batch; (2) capacity cap; (3) retirement burns the credits; (4) the
certificate is soulbound; (5) all events are public and auditable.

**26. Can the same serial be used for two projects?**
No. `serialHashUsed` is global across all projects.

**27. What are the main gas costs?**
Registry registration and batch issuance are the heaviest (storage writes + events). Retiring costs
more because it burns, updates counters, and mints an ERC-721 with on-chain metadata. Marketplace
list/buy are moderate. Reads (`tokenURI`, `getProjects`) are free view calls.

**28. Why is `tokenURI` not a transaction?**
It is a `view` function. Wallets and marketplaces call it off-chain; the SVG/JSON is generated at
read time, so no gas is paid for the artwork.

---

## D. Frontend and integration

**29. How does the frontend talk to the blockchain?**
`ethers.js v6` with `BrowserProvider` for MetaMask writes and `JsonRpcProvider` for reads. ABIs and
addresses are exported from the Hardhat artifacts by `scripts/export-frontend.js`.

**30. How does the app know the user's roles?**
`useRoles` calls `hasRole(roleHash, account)` on each contract. This is only a UX hint; the
contracts enforce the same checks on every write.

**31. How are holdings derived if ERC-1155 has no enumeration?**
`loadHoldings` queries `TransferSingle` logs where the account is sender or receiver, collects the
token ids, then reads live `balanceOf(account, id)` and `getBatch(id)`.

**32. How does the activity feed work?**
`loadActivity` queries the relevant events from the deployment block to the latest block in 45k-block
chunks, normalises them, fetches block timestamps and sorts newest first.

**33. How are errors and pending transactions shown?**
`useTx` wraps every write: it shows a toast with the transaction hash/Etherscan link, waits for the
receipt, shows success or a decoded revert reason, then refreshes the data.

**34. What happens on the wrong network?**
The UI detects the chain id, shows a warning and offers a `wallet_switchEthereumChain` button. If the
network is unknown, it calls `wallet_addEthereumChain` with the RPC details.

**35. How is the UI responsive and accessible?**
CSS grid/flex with breakpoints at 960/640 px, a mobile drawer, semantic buttons, labels, visible
focus rings, `aria-*` attributes on dialogs/tabs, Escape-to-close, and reduced-motion support.

---

## E. Testing and deployment

**36. What do the tests cover?**
31 cases: happy paths, access control, invalid inputs, duplicate serials, capacity limits, partial
retirement, soulbound enforcement, on-chain metadata, marketplace escrow/partial buys/fees/cancels/
withdrawals, and pausing.

**37. Why use `loadFixture`?**
It snapshots the chain after a setup function and restores it for each test, making tests independent
and fast.

**38. How do you deploy?**
Hardhat (`npm run deploy:sepolia`) with the private key in `.env`, or Remix using the flattened files
in `remix/`. Deployment order and role wiring are documented in the README.

**39. What is the role-wiring step after deployment?**
The registry must grant `CREDIT_TOKEN_ROLE` to the token; the certificate must grant `MINTER_ROLE` to
the token; the token must be told the certificate address via `setCertificateContract`.

**40. What would you improve with more time?**
Annual capacity resets by vintage, ERC-20 payment tokens or a DEX for pricing, IPFS/Arweave document
storage with hash verification, a subgraph for indexing instead of log scanning, and a multisig +
timelock for admin roles.

---

## F. Quick definitions

- **DApp** — a frontend plus smart contracts; transactions are signed by the user's wallet.
- **Gas** — a unit of computational work; paid in ETH. Storage writes cost the most.
- **ABI** — the JSON description of a contract's functions and events, used by ethers.js.
- **Testnet** — a public chain using valueless ETH (Sepolia here).
- **Soulbound token** — a non-transferable NFT used as a permanent credential.
- **Escrow** — assets held by a contract until conditions are met.
- **Event log** — an immutable record emitted by a contract, queryable by the frontend.
