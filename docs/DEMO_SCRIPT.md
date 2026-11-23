# Live demonstration script (~10 minutes)

Goal: show a **working end-to-end DApp** with real Sepolia transactions, events and a soulbound
certificate — and prove that the contract rejects invalid/unauthorised actions.

---

## 0. Pre-demo checklist (do this 15 minutes before)

- [ ] `npm run deploy:sepolia` completed; addresses exported (`npm run export`).
- [ ] Frontend running (`npm run frontend`) or built and hosted.
- [ ] MetaMask unlocked, on **Sepolia**, with two accounts funded from a faucet:
  - **Account A** — deployer (admin + verifier + issuer).
  - **Account B** — buyer / beneficiary.
- [ ] Account A has ~0.05 Sepolia ETH for 6–8 transactions.
- [ ] `deployments/sepolia.json` and `frontend/src/contracts/addresses.json` show the same addresses.
- [ ] Open the Sepolia Etherscan tab for the marketplace contract.
- [ ] Test the whole flow once in private, then reset (or use fresh data).
- [ ] Slide/Notepad ready with the problem statement and architecture diagram
      (`docs/ARCHITECTURE.md`).

> If Sepolia is congested or MetaMask misbehaves, switch the same demo to the local Hardhat flow in
> section 9. The UI is identical.

---

## 1. Problem statement (45 seconds)

> "Carbon credits are easy to double-count. Buyers cannot verify that a credit was issued against a
> real project, that it exists only once, or that it was actually retired. CarbonLedger puts those
> rules on-chain: verified projects issue ERC-1155 credit batches, a marketplace escrows and trades
> them, and retirement burns them forever and mints a soulbound certificate as proof."

Point at the dashboard: projects, issued tonnes, retired tonnes, certificates, listings.

---

## 2. Architecture (45 seconds)

Open `docs/ARCHITECTURE.md` or draw:

```
MetaMask → React + ethers.js → Sepolia
                                 ├── ProjectRegistry
                                 ├── CarbonCreditToken (ERC-1155)
                                 ├── RetirementCertificate (ERC-721, soulbound)
                                 └── CarbonMarketplace
```

Mention: document hashes only (no documents on-chain), role-based access, ERC-1155 for partial
retirement, pull payments in the marketplace.

---

## 3. Show the deployed contracts (30 seconds)

Admin → **Deployment** card:

- click each address chip to copy it, then open it on Etherscan;
- show the contract is verified (if verified) and that transactions exist.

Or show `deployments/sepolia.json`.

---

## 4. Register a project (1 minute) — Account A

1. **Projects → Register project**.
2. Enter:
   - Name: `Sahyadri Reforestation 2026`
   - Location: `Maharashtra, India`
   - Capacity: `8000`
   - Methodology: `Verra VM0047 v1.0 - Afforestation`
   - Upload any small PDF **or** type a reference, e.g. `sahyadri-methodology-2026.pdf`.
3. Point out the locally computed `keccak256` hash.
4. Click **Register on-chain** → confirm in MetaMask.

Say: *"Only the hash is stored. The document never leaves my machine."*

Show the new card **Pending** and the transaction in the activity feed.

---

## 5. Verify the project (45 seconds) — Account A

1. On the pending project card click **Verify** → confirm.
2. Badge changes to **Verified**.
3. Say: *"This call is `onlyRole(VERIFIER_ROLE)`. A normal wallet cannot do it."*

---

## 6. Issue credits (1 minute) — Account A

1. On the verified card click **Issue credits** (opens the Credits page with the project
   preselected).
2. Fill:
   - Vintage: `2026`
   - Tonnage: `800` (must be ≤ remaining capacity)
   - Serial: `SAH-2026-B001`
3. **Mint batch** → confirm.

Show the new row under **My portfolio** and the `BatchIssued` event. Explain the capacity check and
the unique serial hash.

---

## 7. List and buy credits (2 minutes)

### Sell — Account A
1. **Credits → My portfolio → Sell** on the new batch.
2. Amount `300`, price `0.0004` ETH/tonne → **List on marketplace**.
3. Approve the marketplace if MetaMask asks (first time only), then confirm the listing.
4. Show `300 t` moved to the marketplace contract address (escrow) under **All batches** /
   Etherscan token transfers.

### Buy — Account B
1. Switch MetaMask to **Account B** (the app reconnects automatically).
2. **Marketplace** → the listing appears.
3. **Buy credits** → amount `100` → shows total `0.04 ETH` and seller proceeds after the 2.5% fee.
4. Confirm. Show the new balance in **Credits → My portfolio**.

Say: *"The buyer pays the exact price; the seller's ETH is credited internally and withdrawn
separately — a pull-payment pattern that removes reentrancy and failed-transfer risk."*

---

## 8. Retire and mint the certificate (1.5 minutes) — Account B

1. **Credits → Retire** on the purchased batch.
2. Tonnage `40`, beneficiary = Account B, purpose `Offsetting student hackathon travel`.
3. **Burn & mint certificate** → confirm.
4. Open **Certificates** → the new card shows the on-chain SVG.
5. Click it: show batch, project, tonnes, date, purpose, beneficiary, contract.
6. Open the transaction on Etherscan; show `CreditsRetired` + `CertificateMinted`.

Say: *"The credits are burned. This certificate is soulbound — `_update` rejects any transfer — and
its image and metadata are generated inside the contract, so the proof cannot be edited or lost."*

---

## 9. Negative tests (1.5 minutes) — the marks are here

### 9.1 Unauthorised verification
1. Stay on **Account B**, open **Projects**.
2. The **Verify** button is absent.
3. To show the actual revert, open the registry in Remix/Etherscan "Write contract", connect
   Account B and call `verifyProject(<id>)`.
4. Expected: `AccessControlUnauthorizedAccount(account, VERIFIER_ROLE)`.

### 9.2 Duplicate serial
1. Switch to Account A → issue a batch with the **same serial** `SAH-2026-B001`.
2. Expected revert: `TOKEN: serial already issued`.

### 9.3 Over-capacity issuance
1. Try to issue more tonnes than the project's remaining capacity.
2. Expected revert: `REG: annual capacity exceeded` (the UI also warns before sending).

### 9.4 Over-retirement
1. As Account B, try to retire more tonnes than the balance (use Remix for the raw call).
2. Expected revert: `TOKEN: insufficient credits`.

### 9.5 Soulbound certificate
1. In Remix, as the certificate owner, call `transferFrom(me, other, certificateId)`.
2. Expected revert: `CERT: non-transferable`.

### 9.6 Wrong payment
1. In Remix, call `buyCredits(listingId, amount)` with less ETH than required.
2. Expected revert: `MKT: incorrect payment`.

Summarise: *"Every one of those rules is enforced by the contract, not by the UI."*

---

## 10. Results and advantages (45 seconds)

| Conventional registry | CarbonLedger |
| --- | --- |
| Central operator can edit records | Append-only on-chain history |
| Manual, slow verification | Verifier role + timestamped approval |
| Double-counting possible | Burn-on-retirement + soulbound proof |
| Opaque trading | Public events + escrowed marketplace |
| Documents must be shared | Only hashes are stored |

Close with the test result: **31/31 Hardhat tests passing**, including access control and negative
cases.

---

## 11. Fallback: local demo

```bash
npm run node            # terminal 1
npm run deploy:local    # terminal 2
npm run seed:local
npm run export
npm run frontend        # terminal 3
```

Add network `http://127.0.0.1:8545`, chain ID `31337`, and import Hardhat account #0 (admin) and
account #3 (buyer) from the keys printed by `npm run node`. Everything else is identical.

---

## 12. Likely examiner questions during the demo

See **[VIVA_QA.md](VIVA_QA.md)** for full answers. The five most likely:

1. Why ERC-1155 instead of ERC-20 or ERC-721?
2. How do you prevent double counting?
3. Where are the documents stored?
4. What stops an admin from misusing their role?
5. How is the marketplace protected against reentrancy?
