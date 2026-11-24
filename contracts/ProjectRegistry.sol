// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ProjectRegistry
 * @author CarbonLedger (TE COMP Mini Project)
 * @notice On-chain registry of carbon-offset projects and their verification status.
 *
 * Lifecycle of a project:
 *   1. A developer registers a project (name, location, methodology, document hash, annual capacity).
 *   2. A VERIFIER verifies the project. Only verified + active projects may issue credits.
 *   3. The CarbonCreditToken contract records every issuance against the project's annual capacity.
 *
 * The registry never stores the methodology document itself - only a keccak256 hash of it,
 * which keeps the design privacy-preserving and cheap on gas.
 */
contract ProjectRegistry is AccessControl, Pausable {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant CREDIT_TOKEN_ROLE = keccak256("CREDIT_TOKEN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Project {
        uint256 id;
        address developer;
        string name;
        string location;
        string methodology;
        bytes32 methodologyHash;
        uint256 annualCapacityTonnes;
        uint256 issuedTonnes;
        bool verified;
        bool active;
        uint64 createdAt;
        uint64 verifiedAt;
    }

    uint256 public projectCount;
    uint256 public verifiedActiveCount;

    mapping(uint256 => Project) private _projects;
    mapping(address => uint256[]) private _projectsByDeveloper;
    mapping(bytes32 => bool) public documentHashUsed;

    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed developer,
        string name,
        bytes32 methodologyHash
    );
    event ProjectVerified(uint256 indexed projectId, address indexed verifier, uint64 verifiedAt);
    event VerificationRevoked(uint256 indexed projectId, address indexed verifier);
    event ProjectStatusChanged(uint256 indexed projectId, bool active);
    event IssuanceRecorded(
        uint256 indexed projectId,
        uint256 tonnes,
        uint256 totalIssuedTonnes
    );

    modifier existingProject(uint256 projectId) {
        require(_projects[projectId].id != 0, "REG: project does not exist");
        _;
    }

    constructor(address admin) {
        require(admin != address(0), "REG: admin is zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Project lifecycle
    // ---------------------------------------------------------------------

    /**
     * @notice Register a new carbon-offset project. The caller becomes the developer.
     * @param methodologyHash keccak256 hash of the off-chain methodology document.
     * @param annualCapacityTonnes maximum CO2e tonnes the project may issue per year.
     */
    function registerProject(
        string calldata name,
        string calldata location,
        string calldata methodology,
        bytes32 methodologyHash,
        uint256 annualCapacityTonnes
    ) external whenNotPaused returns (uint256 projectId) {
        require(bytes(name).length >= 3 && bytes(name).length <= 80, "REG: invalid name");
        require(bytes(location).length >= 2 && bytes(location).length <= 80, "REG: invalid location");
        require(
            bytes(methodology).length >= 3 && bytes(methodology).length <= 120,
            "REG: invalid methodology"
        );
        require(methodologyHash != bytes32(0), "REG: empty document hash");
        require(!documentHashUsed[methodologyHash], "REG: document already registered");
        require(annualCapacityTonnes > 0, "REG: capacity is zero");
        require(annualCapacityTonnes <= 1_000_000_000, "REG: capacity too large");

        documentHashUsed[methodologyHash] = true;
        projectId = ++projectCount;

        _projects[projectId] = Project({
            id: projectId,
            developer: msg.sender,
            name: name,
            location: location,
            methodology: methodology,
            methodologyHash: methodologyHash,
            annualCapacityTonnes: annualCapacityTonnes,
            issuedTonnes: 0,
            verified: false,
            active: false,
            createdAt: uint64(block.timestamp),
            verifiedAt: 0
        });

        _projectsByDeveloper[msg.sender].push(projectId);

        emit ProjectRegistered(projectId, msg.sender, name, methodologyHash);
    }

    /// @notice Verify a project. Only VERIFIER_ROLE may call this.
    function verifyProject(
        uint256 projectId
    ) external onlyRole(VERIFIER_ROLE) existingProject(projectId) {
        Project storage project = _projects[projectId];
        require(!project.verified, "REG: already verified");

        project.verified = true;
        project.active = true;
        project.verifiedAt = uint64(block.timestamp);
        verifiedActiveCount++;

        emit ProjectVerified(projectId, msg.sender, project.verifiedAt);
    }

    /// @notice Revoke verification. The project can no longer issue new credits.
    function revokeVerification(
        uint256 projectId
    ) external onlyRole(VERIFIER_ROLE) existingProject(projectId) {
        Project storage project = _projects[projectId];
        require(project.verified, "REG: not verified");

        project.verified = false;
        project.active = false;
        verifiedActiveCount--;

        emit VerificationRevoked(projectId, msg.sender);
    }

    /// @notice Enable or disable a verified project.
    function setProjectActive(
        uint256 projectId,
        bool active
    ) external onlyRole(VERIFIER_ROLE) existingProject(projectId) {
        Project storage project = _projects[projectId];
        require(project.verified, "REG: project not verified");
        require(project.active != active, "REG: status unchanged");

        project.active = active;
        if (active) verifiedActiveCount++;
        else verifiedActiveCount--;
        emit ProjectStatusChanged(projectId, active);
    }

    /**
     * @notice Called exclusively by the CarbonCreditToken when credits are issued.
     * @dev Enforces the annual issuance cap on-chain.
     */
    function recordIssuance(
        uint256 projectId,
        uint256 tonnes
    ) external onlyRole(CREDIT_TOKEN_ROLE) whenNotPaused existingProject(projectId) {
        Project storage project = _projects[projectId];
        require(project.verified && project.active, "REG: project not active");
        require(tonnes > 0, "REG: zero tonnes");
        require(
            project.issuedTonnes + tonnes <= project.annualCapacityTonnes,
            "REG: annual capacity exceeded"
        );

        project.issuedTonnes += tonnes;

        emit IssuanceRecorded(projectId, tonnes, project.issuedTonnes);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getProject(uint256 projectId) external view returns (Project memory) {
        require(_projects[projectId].id != 0, "REG: project does not exist");
        return _projects[projectId];
    }

    function projectExists(uint256 projectId) external view returns (bool) {
        return _projects[projectId].id != 0;
    }

    function isVerified(uint256 projectId) external view returns (bool) {
        Project storage project = _projects[projectId];
        return project.verified && project.active;
    }

    function getProjects(
        uint256 offset,
        uint256 limit
    ) external view returns (Project[] memory list, uint256 total) {
        total = projectCount;
        if (offset >= total || limit == 0) {
            return (new Project[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        list = new Project[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = _projects[i + 1];
        }
    }

    function getProjectsByDeveloper(
        address developer
    ) external view returns (uint256[] memory) {
        return _projectsByDeveloper[developer];
    }

    function getVerifiedProjectCount() external view returns (uint256) {
        return verifiedActiveCount;
    }

    // ---------------------------------------------------------------------
    // Emergency controls
    // ---------------------------------------------------------------------

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
