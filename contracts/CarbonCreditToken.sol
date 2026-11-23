// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IProjectRegistry {
    function isVerified(uint256 projectId) external view returns (bool);
    function recordIssuance(uint256 projectId, uint256 tonnes) external;
}

interface IRetirementCertificate {
    function mint(
        address to,
        uint256 batchId,
        uint256 projectId,
        uint256 tonnes,
        string calldata purpose
    ) external returns (uint256);
}

/**
 * @title CarbonCreditToken
 * @author CarbonLedger (TE COMP Mini Project)
 * @notice ERC-1155 token where every token id is a verified carbon-credit batch and
 *         balances are measured in tonnes of CO2e.
 *
 * Why ERC-1155?
 *   - A batch is fungible within itself (1 tonne == 1 tonne), so ERC-20-like balances fit.
 *   - Different batches (different project / vintage) remain distinct token ids.
 *   - Partial retirement is native: burn 25 of your 100 tonnes and keep the rest.
 *
 * Retirement is irreversible and mints a soulbound RetirementCertificate to the beneficiary.
 */
contract CarbonCreditToken is ERC1155, AccessControl, Pausable, ReentrancyGuard {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Batch {
        uint256 id;
        uint256 projectId;
        uint16 vintage;
        uint256 tonnes;
        uint256 retiredTonnes;
        bytes32 serialHash;
        address issuer;
        uint64 createdAt;
        bool exists;
    }

    IProjectRegistry public immutable registry;
    address public certificateContract;

    uint256 public batchCount;
    uint256 public totalIssuedTonnes;
    uint256 public totalRetiredTonnes;

    mapping(uint256 => Batch) private _batches;
    mapping(bytes32 => bool) public serialHashUsed;

    string private _baseTokenURI;

    event BatchIssued(
        uint256 indexed batchId,
        uint256 indexed projectId,
        address indexed issuer,
        uint16 vintage,
        uint256 tonnes,
        bytes32 serialHash
    );
    event CreditsRetired(
        uint256 indexed batchId,
        address indexed holder,
        address indexed beneficiary,
        uint256 tonnes,
        uint256 certificateId,
        string purpose
    );
    event CertificateContractSet(address indexed certificate);
    event BaseURIUpdated(string newBaseURI);

    constructor(address admin, address registry_) ERC1155("") {
        require(admin != address(0), "TOKEN: admin is zero");
        require(registry_ != address(0), "TOKEN: registry is zero");

        registry = IProjectRegistry(registry_);
        _baseTokenURI = "ipfs://carbonledger/batches/";

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Issuance
    // ---------------------------------------------------------------------

    /**
     * @notice Issue a new carbon-credit batch for a verified project.
     * @dev The caller receives the full supply of the batch.
     */
    function issueBatch(
        uint256 projectId,
        uint16 vintage,
        uint256 tonnes,
        bytes32 serialHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 batchId) {
        require(registry.isVerified(projectId), "TOKEN: project not verified");
        require(tonnes > 0 && tonnes <= 1_000_000_000, "TOKEN: invalid tonnage");
        require(vintage >= 1990 && vintage <= 2100, "TOKEN: invalid vintage");
        require(serialHash != bytes32(0), "TOKEN: empty serial hash");
        require(!serialHashUsed[serialHash], "TOKEN: serial already issued");

        serialHashUsed[serialHash] = true;
        batchId = ++batchCount;

        _batches[batchId] = Batch({
            id: batchId,
            projectId: projectId,
            vintage: vintage,
            tonnes: tonnes,
            retiredTonnes: 0,
            serialHash: serialHash,
            issuer: msg.sender,
            createdAt: uint64(block.timestamp),
            exists: true
        });

        totalIssuedTonnes += tonnes;

        // Registry enforces the project's annual capacity.
        registry.recordIssuance(projectId, tonnes);

        _mint(msg.sender, batchId, tonnes, "");

        emit BatchIssued(batchId, projectId, msg.sender, vintage, tonnes, serialHash);
    }

    // ---------------------------------------------------------------------
    // Retirement
    // ---------------------------------------------------------------------

    /**
     * @notice Permanently retire credits, offsetting `tonnes` of CO2e for `beneficiary`.
     * @dev Burns the credits and mints a non-transferable proof-of-retirement certificate.
     */
    function retireCredits(
        uint256 batchId,
        uint256 tonnes,
        address beneficiary,
        string calldata purpose
    ) external nonReentrant whenNotPaused returns (uint256 certificateId) {
        require(certificateContract != address(0), "TOKEN: certificate contract not set");
        require(beneficiary != address(0), "TOKEN: beneficiary is zero");
        require(tonnes > 0, "TOKEN: zero tonnage");
        require(balanceOf(msg.sender, batchId) >= tonnes, "TOKEN: insufficient credits");
        require(bytes(purpose).length >= 3 && bytes(purpose).length <= 140, "TOKEN: invalid purpose");
        require(_batches[batchId].exists, "TOKEN: batch does not exist");

        // Effects before external interaction.
        _batches[batchId].retiredTonnes += tonnes;
        totalRetiredTonnes += tonnes;

        _burn(msg.sender, batchId, tonnes);

        certificateId = IRetirementCertificate(certificateContract).mint(
            beneficiary,
            batchId,
            _batches[batchId].projectId,
            tonnes,
            purpose
        );

        emit CreditsRetired(
            batchId,
            msg.sender,
            beneficiary,
            tonnes,
            certificateId,
            purpose
        );
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Wire the certificate contract once, after deployment.
    function setCertificateContract(address certificate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(certificate != address(0), "TOKEN: certificate is zero");
        require(certificateContract == address(0), "TOKEN: certificate already set");
        certificateContract = certificate;
        emit CertificateContractSet(certificate);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
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

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        require(_batches[batchId].exists, "TOKEN: batch does not exist");
        return _batches[batchId];
    }

    function batchExists(uint256 batchId) external view returns (bool) {
        return _batches[batchId].exists;
    }

    function getBatches(
        uint256 offset,
        uint256 limit
    ) external view returns (Batch[] memory list, uint256 total) {
        total = batchCount;
        if (offset >= total || limit == 0) {
            return (new Batch[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        list = new Batch[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = _batches[i + 1];
        }
    }

    function uri(uint256 batchId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseTokenURI, batchId.toString(), ".json"));
    }

    // ---------------------------------------------------------------------
    // Overrides
    // ---------------------------------------------------------------------

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override whenNotPaused {
        super._update(from, to, ids, values);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
