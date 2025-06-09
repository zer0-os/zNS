// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSStringResolver } from "./IZNSStringResolver.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { NotAuthorizedForDomain } from "../utils/CommonErrors.sol";


/**
 * @title The specific Resolver for ZNS that maps domain hashes to strings.
 *
 * @notice This Resolver supports ONLY the string type.
 */
contract ZNSStringResolver is
    UUPSUpgradeable,
    AAccessControlled,
    ARegistryWired,
    ERC165,
    IZNSStringResolver {
    /**
     * @notice Mapping of domain hash to string used to bind domains
     * to any kinds of text.
     */
    mapping(bytes32 domainHash => string resolvedString) internal resolvedStrings;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializer for the `ZNSStringResolver` proxy.
     * Note that setter functions are used instead of direct state variable assignments
     * to use access control at deploy time. Only ADMIN can call this function.
     *
     * @param accessController_ The address of the `ZNSAccessController` contract
     * @param registry_ The address of the `ZNSRegistry` contract
     */
    function initialize(address accessController_, address registry_) external override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);
    }

    /**
     * @dev Returns string associated with a given domain name hash.
     *
     * @param domainHash The identifying hash of a domain's name
     */
    function resolveDomainString(
        bytes32 domainHash
    ) external view override returns (string memory) {
        return resolvedStrings[domainHash];
    }

    /**
     * @dev Sets the string for a domain name hash.
     *
     * @param domainHash The identifying hash of a domain's name
     * @param newString The new string to map the domain to
     */
    function setString(
        bytes32 domainHash,
        string calldata newString
    ) external override {
        // only owner or operator of the current domain can set the string
        if (!registry.isOwnerOrOperator(domainHash, msg.sender)) {
            revert NotAuthorizedForDomain(msg.sender, domainHash);
        }

        resolvedStrings[domainHash] = newString;

        emit StringSet(domainHash, newString);
    }

    /**
     * @dev ERC-165 check for implementation identifier
     * Supports interfaces `IZNSStringResolver` and `IERC165`
     *
     * @param interfaceId ID to check, XOR of the first 4 bytes of each function signature
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IZNSStringResolver) returns (bool) {
        return
            interfaceId == getInterfaceId() ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Exposes IZNSStringResolver interfaceId
     */
    function getInterfaceId() public pure override returns (bytes4) {
        return type(IZNSStringResolver).interfaceId;
    }

    /**
     * @dev Sets the address of the `ZNSRegistry` contract that holds all crucial data
     * for every domain in the system. This function can only be called by the ADMIN.
     *
     * @param _registry The address of the `ZNSRegistry` contract
     */
    function setRegistry(address _registry) public override(ARegistryWired, IZNSStringResolver) onlyAdmin {
        _setRegistry(_registry);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     *
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line no-unused-vars
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
