# Test cases

Run:

```bash
npm test
```

Expected result: **31 passing** (Hardhat + Chai, ethers v6).

The suite uses `loadFixture`, so every scenario runs on a fresh snapshot (no shared state).

---

## A. ProjectRegistry (10 tests)

| # | Test | Input / action | Expected result |
| --- | --- | --- | --- |
| 1 | Deployer receives roles | Deploy | `DEFAULT_ADMIN_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE` all true for deployer |
| 2 | Register project | Valid name/location/methodology/hash/capacity | `ProjectRegistered` event; `projectCount = 1`; project stored, `verified = false` |
| 3 | Duplicate document | Register a second project with the same hash | Revert `REG: document already registered` |
| 4 | Input validation | Name length < 3 / zero hash / capacity 0 | Reverts `REG: invalid name`, `REG: empty document hash`, `REG: capacity is zero` |
| 5 | Only verifier verifies | Outsider calls `verifyProject` | Revert `AccessControlUnauthorizedAccount`; after granting role, verification succeeds |
| 6 | No double verification | Call `verifyProject` twice | Second call reverts `REG: already verified` |
| 7 | Revocation disables issuance | Revoke, then issue a batch | `isVerified = false`; issuance reverts `TOKEN: project not verified` |
| 8 | Pagination | 5 projects, `getProjects(1, 3)` | `total = 5`, page length 3, ids 2–4 |
| 9 | Verified count | 1 verified + 1 pending | `getVerifiedProjectCount() = 1` |
| 10 | Pause | Pause registry, register | Revert `EnforcedPause`; after unpause, registration succeeds |

## B. CarbonCreditToken (11 tests)

| # | Test | Input / action | Expected result |
| --- | --- | --- | --- |
| 11 | Issue batch | Verified project, `1000 t`, vintage 2025 | `BatchIssued`; balance 1000; `totalIssuedTonnes = 1000`; batch stored |
| 12 | Only minter | Outsider calls `issueBatch` | Revert `AccessControlUnauthorizedAccount` |
| 13 | Unverified project | Issue against unverified project | Revert `TOKEN: project not verified` |
| 14 | Duplicate serial + bad vintage | Reuse serial; vintage 1800 | Revert `TOKEN: serial already issued`; `TOKEN: invalid vintage` |
| 15 | Capacity cap | Issue 5000 t when only 4000 t remain | Revert `REG: annual capacity exceeded` |
| 16 | Retirement | Retire 250 t to buyer | Credits burned (750 left); certificate minted; `totalRetiredTonnes = 250`; event args correct |
| 17 | Partial retirement | Retire 100 t then 150 t | `retiredTonnes = 250`, balance 750 |
| 18 | Invalid retirement | Over-balance / zero / zero beneficiary | Reverts `TOKEN: insufficient credits`, `TOKEN: zero tonnage`, `TOKEN: beneficiary is zero` |
| 19 | Soulbound | Certificate owner calls `transferFrom` | Revert `CERT: non-transferable` |
| 20 | On-chain metadata | Read `tokenURI` | Starts with `data:application/json;base64,`; JSON parses; image is an SVG data URI |
| 21 | Transfer + pause | Transfer 400 t; then pause and transfer | Transfer succeeds; paused transfer reverts `EnforcedPause` |

## C. CarbonMarketplace (10 tests)

| # | Test | Input / action | Expected result |
| --- | --- | --- | --- |
| 22 | Listing escrow | List 500 t | Marketplace holds 500 t; seller holds 500 t; listing active |
| 23 | Approval required | List without `setApprovalForAll` | Revert `ERC1155MissingApprovalForAll` |
| 24 | Buy partial | Buy 200 t | Buyer receives 200 t; seller proceeds = cost − 2.5%; fee accrued; 300 t remaining |
| 25 | Full fill closes listing | Buy all 500 t | `remaining = 0`, `active = false` |
| 26 | Payment validation | Underpay; over-buy | Revert `MKT: incorrect payment`; `MKT: amount exceeds listing` |
| 27 | Cancel | Non-seller cancels; seller cancels | Non-seller reverts `MKT: not seller`; seller gets 500 t back; listing inactive |
| 28 | Withdrawals | Withdraw proceeds; admin withdraws fees | Events emitted; balances reset to 0; ETH transferred |
| 29 | Fee cap / access | Non-admin sets fee; set 10.01%; set 5% | Unauthorized revert; `MKT: fee above cap`; fee becomes 500 bps |
| 30 | Zero / over-balance listing | Amount 0; amount 10 000 | Revert `MKT: zero amount`; `MKT: insufficient credits` |
| 31 | Capacity + pagination coverage | Combined fixture flows | All helper views return consistent totals |

> Tests 1–31 are automated. The extra checks below are performed manually during the demo.

---

## D. Manual negative tests (demo)

| Case | Steps | Expected |
| --- | --- | --- |
| Unauthorised verification | Account B calls `verifyProject` in Remix | `AccessControlUnauthorizedAccount` |
| Duplicate serial | Re-issue with the same serial reference | `TOKEN: serial already issued` |
| Over-capacity | Issue more than remaining project capacity | `REG: annual capacity exceeded` |
| Over-retirement | Retire more than the holder's balance | `TOKEN: insufficient credits` |
| Soulbound transfer | `transferFrom` on a certificate | `CERT: non-transferable` |
| Wrong payment | `buyCredits` with insufficient ETH | `MKT: incorrect payment` |
| Paused system | Pause token, then transfer | `EnforcedPause` |
| Unauthorised role grant | Non-admin calls `grantRole` | `AccessControlUnauthorizedAccount` |

---

## E. What each test proves (mapping to the rubric)

| Rubric area | Covered by |
| --- | --- |
| Smart contract design | 2, 11, 16, 22, 24 (structs, mappings, events, modifiers) |
| Security & validation | 3–7, 12–15, 18–19, 26–30 |
| Blockchain integration | Full suite runs against EVM; deployment + seed scripts exercise Sepolia/local |
| Testing depth | 31 automated cases including invalid inputs and unauthorised calls |
| Working demo | Seed script creates realistic projects, batches, certificates and listings |
