// SPDX-License-Identifier: MIT
// Flattened by scripts/flatten.js for Remix IDE - contract: ProjectRegistry
// Compile with Solidity 0.8.24, EVM version: cancun, optimizer ON (200 runs)

// Sources flattened with hardhat v2.29.2 https://hardhat.org


// File @openzeppelin/contracts/access/IAccessControl.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (access/IAccessControl.sol)

pragma solidity >=0.8.4;

/**
 * @dev External interface of AccessControl declared to support ERC-165 detection.
 */
interface IAccessControl {
    /**
     * @dev The `account` is missing a role.
     */
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /**
     * @dev The caller of a function is not the expected one.
     *
     * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
     */
    error AccessControlBadConfirmation();

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted to signal this.
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call. This account bears the admin role (for the granted role).
     * Expected in cases where the role was granted using the internal {AccessControl-_grantRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     */
    function renounceRole(bytes32 role, address callerConfirmation) external;
}


// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/utils/introspection/ERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/ERC165.sol)

pragma solidity ^0.8.20;

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC-165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 */
abstract contract ERC165 is IERC165 {
    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


// File @openzeppelin/contracts/access/AccessControl.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.6.0) (access/AccessControl.sol)

pragma solidity ^0.8.20;



/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```solidity
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```solidity
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it. We recommend using {AccessControlDefaultAdminRules}
 * to enforce additional security measures for this role.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    mapping(bytes32 role => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with an {AccessControlUnauthorizedAccount} error including the required role.
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        return _roles[role].hasRole[account];
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
     * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
     * is missing `role`.
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        if (!hasRole(role, account)) {
            _roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Attempts to revoke `role` from `account` and returns a boolean indicating if `role` was revoked.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        if (hasRole(role, account)) {
            _roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}


// File @openzeppelin/contracts/utils/Pausable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (utils/Pausable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}


// File contracts/ProjectRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;


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

    function getVerifiedProjectCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= projectCount; i++) {
            if (_projects[i].verified && _projects[i].active) count++;
        }
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
