// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title RetirementCertificate
 * @author CarbonLedger (TE COMP Mini Project)
 * @notice Soulbound (non-transferable) NFT that proves a carbon credit was permanently retired.
 *
 * The metadata AND artwork are generated fully on-chain (base64 data URI), so a certificate
 * can never be altered or lost. Each certificate records the batch, the tonnage retired,
 * the beneficiary and the stated purpose.
 */
contract RetirementCertificate is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Certificate {
        uint256 id;
        uint256 batchId;
        uint256 projectId;
        uint256 tonnes;
        address beneficiary;
        string purpose;
        uint64 retiredAt;
    }

    uint256 public certificateCount;
    uint256 public totalCertifiedTonnes;

    mapping(uint256 => Certificate) private _certificates;
    mapping(address => uint256[]) private _certificatesByOwner;

    event CertificateMinted(
        uint256 indexed certificateId,
        uint256 indexed batchId,
        address indexed beneficiary,
        uint256 tonnes,
        string purpose
    );

    constructor(address admin) ERC721("Carbon Retirement Certificate", "CRC") {
        require(admin != address(0), "CERT: admin is zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    function mint(
        address to,
        uint256 batchId,
        uint256 projectId,
        uint256 tonnes,
        string calldata purpose
    ) external onlyRole(MINTER_ROLE) returns (uint256 certificateId) {
        require(to != address(0), "CERT: beneficiary is zero");
        require(tonnes > 0, "CERT: zero tonnage");

        certificateId = ++certificateCount;
        totalCertifiedTonnes += tonnes;

        _certificates[certificateId] = Certificate({
            id: certificateId,
            batchId: batchId,
            projectId: projectId,
            tonnes: tonnes,
            beneficiary: to,
            purpose: purpose,
            retiredAt: uint64(block.timestamp)
        });

        _certificatesByOwner[to].push(certificateId);
        _safeMint(to, certificateId);

        emit CertificateMinted(certificateId, batchId, to, tonnes, purpose);
    }

    // ---------------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------------

    /**
     * @dev Certificates may only be created (from == address(0)). Transfers and burns are blocked,
     *      which makes the proof of retirement permanent.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        require(from == address(0), "CERT: non-transferable");
        return from;
    }

    // ---------------------------------------------------------------------
    // Metadata (fully on-chain)
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Certificate memory cert = _certificates[tokenId];

        string memory tonnage = cert.tonnes.toString();

        string[] memory parts = new string[](17);
        parts[0] = '{"name":"Carbon Retirement Certificate #';
        parts[1] = tokenId.toString();
        parts[2] = '","description":"On-chain proof that ';
        parts[3] = tonnage;
        parts[4] = ' tonnes of CO2e were permanently retired on the CarbonLedger registry.","attributes":[{"trait_type":"Tonnage","value":';
        parts[5] = tonnage;
        parts[6] = '},{"trait_type":"Batch","value":';
        parts[7] = cert.batchId.toString();
        parts[8] = '},{"trait_type":"Project","value":';
        parts[9] = cert.projectId.toString();
        parts[10] = '},{"trait_type":"Retired","value":"';
        parts[11] = _dateString(cert.retiredAt);
        parts[12] = '"},{"trait_type":"Purpose","value":"';
        parts[13] = _escapeJSON(cert.purpose);
        parts[14] = '"}],"image":"data:image/svg+xml;base64,';
        parts[15] = Base64.encode(bytes(_svg(cert)));
        parts[16] = '"}';

        string memory json = _cat(parts);

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Small stack-safe concatenation helper (Solidity hits "stack too deep" with 15+ args).
    function _cat(string[] memory parts) internal pure returns (string memory result) {
        result = "";
        for (uint256 i = 0; i < parts.length; i++) {
            result = string.concat(result, parts[i]);
        }
    }

    function _svg(Certificate memory cert) internal pure returns (string memory) {
        string[] memory parts = new string[](3);
        parts[0] = _svgHeader();
        parts[1] = _svgBody(cert.tonnes.toString(), cert.id.toString());
        parts[2] = _svgFooter(
            cert.batchId.toString(),
            cert.projectId.toString(),
            _dateString(cert.retiredAt),
            _shortAddress(cert.beneficiary)
        );
        return _cat(parts);
    }

    function _svgHeader() internal pure returns (string memory) {
        string[] memory parts = new string[](10);
        parts[0] = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">';
        parts[1] = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">';
        parts[2] = '<stop offset="0" stop-color="#0b2a1f"/><stop offset="1" stop-color="#123f2d"/>';
        parts[3] = "</linearGradient></defs>";
        parts[4] = '<rect width="800" height="500" fill="url(#g)"/>';
        parts[5] = '<rect x="26" y="26" width="748" height="448" rx="18" fill="none" stroke="#2f6b4f" stroke-width="2"/>';
        parts[6] = '<circle cx="84" cy="90" r="26" fill="none" stroke="#c8f169" stroke-width="2.5"/>';
        parts[7] = '<path d="M72 92c10-16 22-16 26-2 2 10-10 18-24 16" fill="none" stroke="#c8f169" stroke-width="2.5" stroke-linecap="round"/>';
        parts[8] = '<text x="128" y="86" fill="#c8f169" font-family="Verdana, sans-serif" font-size="15" letter-spacing="4">CARBONLEDGER</text>';
        parts[9] = '<text x="128" y="108" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11" letter-spacing="2">PROOF OF RETIREMENT</text>';
        return _cat(parts);
    }

    function _svgBody(
        string memory tonnes,
        string memory id
    ) internal pure returns (string memory) {
        string[] memory parts = new string[](8);
        parts[0] = '<text x="56" y="210" fill="#eef6f0" font-family="Georgia, serif" font-size="46">';
        parts[1] = tonnes;
        parts[2] = " tCO2e</text>";
        parts[3] = '<text x="56" y="244" fill="#9fc0ae" font-family="Verdana, sans-serif" font-size="13" letter-spacing="2">PERMANENTLY RETIRED</text>';
        parts[4] = '<line x1="56" y1="286" x2="744" y2="286" stroke="#2f6b4f" stroke-width="1"/>';
        parts[5] = '<text x="56" y="322" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11" letter-spacing="1.5">CERTIFICATE</text>';
        parts[6] = '<text x="56" y="348" fill="#eef6f0" font-family="Verdana, sans-serif" font-size="18">#';
        parts[7] = id;
        // close certificate text
        return string.concat(_cat(parts), "</text>");
    }

    function _svgFooter(
        string memory batch,
        string memory project,
        string memory retired,
        string memory beneficiary
    ) internal pure returns (string memory) {
        string[] memory parts = new string[](17);
        parts[0] = '<text x="236" y="322" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11" letter-spacing="1.5">BATCH</text>';
        parts[1] = '<text x="236" y="348" fill="#eef6f0" font-family="Verdana, sans-serif" font-size="18">#';
        parts[2] = batch;
        parts[3] = "</text>";
        parts[4] = '<text x="416" y="322" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11" letter-spacing="1.5">PROJECT</text>';
        parts[5] = '<text x="416" y="348" fill="#eef6f0" font-family="Verdana, sans-serif" font-size="18">#';
        parts[6] = project;
        parts[7] = "</text>";
        parts[8] = '<text x="596" y="322" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11" letter-spacing="1.5">RETIRED</text>';
        parts[9] = '<text x="596" y="348" fill="#eef6f0" font-family="Verdana, sans-serif" font-size="18">';
        parts[10] = retired;
        parts[11] = "</text>";
        parts[12] = '<text x="56" y="420" fill="#7fa893" font-family="Verdana, sans-serif" font-size="11">Beneficiary</text>';
        parts[13] = '<text x="56" y="442" fill="#c8f169" font-family="monospace" font-size="13">';
        parts[14] = beneficiary;
        parts[15] = "</text>";
        parts[16] = '<text x="744" y="442" fill="#4d7a63" font-family="Verdana, sans-serif" font-size="10" text-anchor="end">VERIFIED ON-CHAIN</text></svg>';
        return _cat(parts);
    }

    function _shortAddress(address account) internal pure returns (string memory) {
        bytes memory full = bytes(_toHexString(account));
        bytes memory out = new bytes(13);
        for (uint256 i = 0; i < 6; i++) out[i] = full[i];
        out[6] = ".";
        out[7] = ".";
        out[8] = ".";
        for (uint256 i = 0; i < 4; i++) out[9 + i] = full[full.length - 4 + i];
        return string(out);
    }

    function _toHexString(address account) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 value = bytes20(account);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }

    function _escapeJSON(string memory input) internal pure returns (string memory) {
        bytes memory source = bytes(input);
        bytes memory output = new bytes(source.length * 2);
        uint256 j = 0;
        for (uint256 i = 0; i < source.length; i++) {
            bytes1 char = source[i];
            if (char == '"' || char == "\\") {
                output[j++] = "\\";
            }
            output[j++] = char;
        }
        bytes memory trimmed = new bytes(j);
        for (uint256 i = 0; i < j; i++) trimmed[i] = output[i];
        return string(trimmed);
    }

    function _dateString(uint256 timestamp) internal pure returns (string memory) {
        // Civil-from-days algorithm (Howard Hinnant), UTC.
        uint256 z = timestamp / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;

        return string(abi.encodePacked(_pad(y, 4), "-", _pad(m, 2), "-", _pad(d, 2)));
    }

    function _pad(uint256 value, uint256 width) internal pure returns (string memory) {
        string memory raw = value.toString();
        bytes memory rawBytes = bytes(raw);
        if (rawBytes.length >= width) return raw;

        bytes memory padded = new bytes(width);
        uint256 offset = width - rawBytes.length;
        for (uint256 i = 0; i < offset; i++) padded[i] = "0";
        for (uint256 i = 0; i < rawBytes.length; i++) padded[offset + i] = rawBytes[i];
        return string(padded);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getCertificate(uint256 certificateId) external view returns (Certificate memory) {
        _requireOwned(certificateId);
        return _certificates[certificateId];
    }

    function getCertificatesByOwner(address owner) external view returns (uint256[] memory) {
        return _certificatesByOwner[owner];
    }

    function getCertificates(
        uint256 offset,
        uint256 limit
    ) external view returns (Certificate[] memory list, uint256 total) {
        total = certificateCount;
        if (offset >= total || limit == 0) {
            return (new Certificate[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        list = new Certificate[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = _certificates[i + 1];
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
