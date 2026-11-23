// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CarbonMarketplace
 * @author CarbonLedger (TE COMP Mini Project)
 * @notice Fixed-price marketplace for carbon credits, settled in native ETH (Sepolia).
 *
 * Security pattern used:
 *   - Credits are escrowed in the contract when listed.
 *   - Buyers pay the exact price; seller proceeds are credited to an internal balance
 *     (pull-payment pattern) and withdrawn separately. This removes reentrancy and
 *     gas-griefing risks from the buy path.
 *   - Every state-changing function that moves value is nonReentrant and pausable.
 */
contract CarbonMarketplace is AccessControl, Pausable, ReentrancyGuard, IERC1155Receiver {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_FEE_BPS = 1_000; // 10% hard cap
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        uint256 id;
        address seller;
        uint256 batchId;
        uint256 amount;
        uint256 remaining;
        uint256 pricePerTonne;
        bool active;
        uint64 createdAt;
    }

    IERC1155 public immutable credits;
    address public treasury;
    uint256 public feeBps;

    uint256 public listingCount;
    uint256 public accruedFees;

    mapping(uint256 => Listing) private _listings;
    mapping(address => uint256) public proceeds;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed batchId,
        uint256 amount,
        uint256 pricePerTonne
    );
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPaid,
        uint256 fee
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller, uint256 returned);
    event ProceedsWithdrawn(address indexed seller, uint256 amount);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event FeeUpdated(uint256 previousFeeBps, uint256 newFeeBps);
    event TreasuryUpdated(address previousTreasury, address newTreasury);

    constructor(address admin, address credits_, address treasury_) {
        require(admin != address(0), "MKT: admin is zero");
        require(credits_ != address(0), "MKT: credits is zero");
        require(treasury_ != address(0), "MKT: treasury is zero");

        credits = IERC1155(credits_);
        treasury = treasury_;
        feeBps = 250; // 2.5%

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Selling
    // ---------------------------------------------------------------------

    /**
     * @notice List `amount` tonnes of a batch at `pricePerTonne` wei per tonne.
     * @dev The credits are moved into escrow immediately. Requires setApprovalForAll first.
     */
    function listCredits(
        uint256 batchId,
        uint256 amount,
        uint256 pricePerTonne
    ) external nonReentrant whenNotPaused returns (uint256 listingId) {
        require(amount > 0, "MKT: zero amount");
        require(pricePerTonne > 0, "MKT: zero price");
        require(credits.balanceOf(msg.sender, batchId) >= amount, "MKT: insufficient credits");

        listingId = ++listingCount;

        _listings[listingId] = Listing({
            id: listingId,
            seller: msg.sender,
            batchId: batchId,
            amount: amount,
            remaining: amount,
            pricePerTonne: pricePerTonne,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        credits.safeTransferFrom(msg.sender, address(this), batchId, amount, "");

        emit Listed(listingId, msg.sender, batchId, amount, pricePerTonne);
    }

    /// @notice Cancel a listing and return the unsold credits to the seller.
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.active, "MKT: listing inactive");
        require(listing.seller == msg.sender, "MKT: not seller");

        uint256 returned = listing.remaining;
        listing.remaining = 0;
        listing.active = false;

        if (returned > 0) {
            credits.safeTransferFrom(address(this), msg.sender, listing.batchId, returned, "");
        }

        emit ListingCancelled(listingId, msg.sender, returned);
    }

    // ---------------------------------------------------------------------
    // Buying
    // ---------------------------------------------------------------------

    /**
     * @notice Buy `amount` tonnes from a listing. Partial fills are supported.
     * @dev msg.value must equal amount * pricePerTonne exactly.
     */
    function buyCredits(
        uint256 listingId,
        uint256 amount
    ) external payable nonReentrant whenNotPaused {
        Listing storage listing = _listings[listingId];
        require(listing.active, "MKT: listing inactive");
        require(amount > 0, "MKT: zero amount");
        require(amount <= listing.remaining, "MKT: amount exceeds listing");

        uint256 totalPaid = amount * listing.pricePerTonne;
        require(msg.value == totalPaid, "MKT: incorrect payment");

        // Effects
        listing.remaining -= amount;
        if (listing.remaining == 0) {
            listing.active = false;
        }

        uint256 fee = (totalPaid * feeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = totalPaid - fee;

        proceeds[listing.seller] += sellerAmount;
        accruedFees += fee;

        // Interaction (buyer may be a contract, but nonReentrant guards this function).
        credits.safeTransferFrom(address(this), msg.sender, listing.batchId, amount, "");

        emit Purchased(
            listingId,
            msg.sender,
            listing.seller,
            amount,
            totalPaid,
            fee
        );
    }

    /// @notice Withdraw accumulated sale proceeds (pull payment).
    function withdrawProceeds() external nonReentrant {
        uint256 amount = proceeds[msg.sender];
        require(amount > 0, "MKT: nothing to withdraw");

        proceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "MKT: transfer failed");

        emit ProceedsWithdrawn(msg.sender, amount);
    }

    /// @notice Withdraw accumulated platform fees to the treasury.
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = accruedFees;
        require(amount > 0, "MKT: no fees");

        accruedFees = 0;

        (bool success, ) = payable(treasury).call{value: amount}("");
        require(success, "MKT: transfer failed");

        emit FeesWithdrawn(treasury, amount);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setFeeBps(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeeBps <= MAX_FEE_BPS, "MKT: fee above cap");
        uint256 previous = feeBps;
        feeBps = newFeeBps;
        emit FeeUpdated(previous, newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "MKT: treasury is zero");
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    function getListings(
        uint256 offset,
        uint256 limit
    ) external view returns (Listing[] memory list, uint256 total) {
        total = listingCount;
        if (offset >= total || limit == 0) {
            return (new Listing[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        list = new Listing[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = _listings[i + 1];
        }
    }

    function activeListingCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= listingCount; i++) {
            if (_listings[i].active) count++;
        }
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver (escrow)
    // ---------------------------------------------------------------------

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, IERC165) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
