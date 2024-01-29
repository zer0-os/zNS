// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "./IZNSSubRegistrar.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { MerkleProofUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

/**
 * @title ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.
 * @dev This contract has the entry point for registering subdomains, but calls
 * the ZNSRootRegistrar back to finalize registration. Common logic for domains
 * of any level is in the `ZNSRootRegistrar.coreRegister()`.
*/
contract ZNSSubRegistrar is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSSubRegistrar {
    using StringUtils for string;

    /**
     * @notice State var for the ZNSRootRegistrar contract that finalizes registration of subdomains.
    */
    IZNSRootRegistrar public rootRegistrar;

    /**
     * @notice Mapping of domainHash to distribution config set by the domain owner/operator.
     * These configs are used to determine how subdomains are distributed for every parent.
     * @dev Note that the rules outlined in the DistributionConfig are only applied to direct children!
    */
    mapping(bytes32 domainHash => DistributionConfig config) public override distrConfigs;

    /**
     * @notice Mapping of domainHash to mintlist merkleRoot set by the domain owner/operator.
     */
    mapping(bytes32 parentHash => bytes32 merkleRoot) private merkleRoots;

    /**
     * @notice Map how many domains have been minted by a user for a specific merkle tree
     */
    mapping(bytes32 merkleRoot => mapping(address user => uint256 count)) private subdomainsRegistered;

    struct Mintlist {
        mapping(uint256 idx => mapping(address candidate => bool allowed)) list;
        uint256 ownerIndex;
    }

    // New idea must allow for 
    // small and large additions
    // small and large removals
    // total reset with single tx

    // The id of the current mintlist being used
    // domains are not allowed more than one mintlist concurrently
    // ID is unique globally
    mapping(bytes32 domainHash => bytes32 mintlistId) private mintlistIds;

    // List of users per mintlist
    mapping(bytes32 mintlistId => address[] userList) private userLists;
    
    // User index on that domain's mintlist
    mapping(bytes32 mintlistId => mapping(address user => uint256 userIndex)) private userIndices;
    
    // what an individual users is allowed on a specific mintlist
    // how do we do domainHash => mintListId => user => amount
    mapping(bytes32 mintlistId => mapping(address user => uint256 amount)) private allowedPerDomain;

    function insertOne(bytes32 domainHash, address user, uint256 amount) public {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );
        // Get the id of the mintlist currently in use by that domain
        bytes32 id = mintlistIds[domainHash];
        
        // First addition to mintlist
        if (id == 0) {
            // TODO a domain is only allowed one mintlist at a time
            // is there an issue here if they try to create two in the same block?
            id = keccak256(abi.encodePacked(domainHash, block.timestamp));
            mintlistIds[domainHash] = id;
        }

        // Give the user the amount allowed
        allowedPerDomain[id][user] = amount;

        // Log that user as on the list
        userLists[id].push(user);

        // Store that users index in the list
        userIndices[id][user] = userLists[id].length - 1;

        // emit UserInserted
        // insert many is just copy of this func with array types
    }

    function getMintlistIdForDomain(bytes32 domainHash) public view returns(bytes32) {
        return mintlistIds[domainHash];
    }

    // get the index on the mintlist of a specific domain where that user exists
    function getUserIndexForMintlist(bytes32 domainHash, address user) public view returns (uint256) {
        bytes32 id = mintlistIds[domainHash];
        return userIndices[id][user];
    }

    function getAllowedAmountForUser(bytes32 domainHash, address user) public view returns (uint256) {
        bytes32 id = mintlistIds[domainHash];
        uint256 amount = allowedPerDomain[id][user];

        return amount;
    }

    // remove one user from current mintlist
    function removeUser(bytes32 domainHash, address user) public {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );
        // bulk tx remove many is loop delete
        bytes32 id = mintlistIds[domainHash];
        delete allowedPerDomain[id][user];
        // emit UserRemoved
    }

    /**
     * @notice Mapping of domainHash to mintlist set by the domain owner/operator.
     * These configs are used to determine who can register subdomains for every parent
     * in the case where parent's DistributionConfig.AccessType is set to AccessType.MINTLIST.
    */
    mapping(bytes32 domainHash => Mintlist mintStruct) public mintlist;

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender)
            || accessController.isRegistrar(msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar
    ) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    /**
     * @notice Entry point to register a subdomain under a parent domain specified.
     * @dev Reads the `DistributionConfig` for the parent domain to determine how to distribute,
     * checks if the sender is allowed to register, check if subdomain is available,
     * acquires the price and other data needed to finalize the registration
     * and calls the `ZNSRootRegistrar.coreRegister()` to finalize.
     * @param parentHash The hash of the parent domain to register the subdomain under
     * @param label The label of the subdomain to register (e.g. in 0://zero.child the label would be "child").
     * @param domainAddress (optional) The address to which the subdomain will be resolved to
     * @param tokenURI (required) The tokenURI for the subdomain to be registered
     * @param distrConfig (optional) The distribution config to be set for the subdomain to set rules for children
     * @param paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx
     *  > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,
     *  but all the parameters inside are required.
    */
    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig,
        MerkleProof calldata merkleProof // can be zero, TODO update natspec
    ) external override returns (bytes32) {
        // Confirms string values are only [a-z0-9-]
        label.validate();

        bytes32 domainHash = hashWithParent(parentHash, label);
        require(
            !registry.exists(domainHash),
            "ZNSSubRegistrar: Subdomain already exists"
        );

        // We load the various data into a single object
        // because doing so reduces the number of SLOADs
        SubdomainConfig memory config = SubdomainConfig({
            parentOwner: registry.getDomainOwner(parentHash),
            parentOwnsBoth: false,
            isOperatorForParentOwner: false,
            distrConfig: distrConfigs[parentHash],
            paymentConfig: paymentConfig,
            merkleProof: merkleProof
        });

        config.parentOwnsBoth = rootRegistrar.isOwnerOf(parentHash, config.parentOwner, IZNSRootRegistrar.OwnerOf.BOTH);
        config.isOperatorForParentOwner = registry.isOperatorFor(msg.sender, config.parentOwner);

        if (config.distrConfig.accessType == AccessType.LOCKED) {
            require(
                // Require that the parent owns both the token and the domain name
                // as well as that the caller either is the parent owner, or an allowed operator
                config.parentOwnsBoth && (config.isOperatorForParentOwner || address(msg.sender) == config.parentOwner),
                "ZNSSubRegistrar: Parent domain's distribution is locked"
            );
        }

        if (config.distrConfig.accessType == AccessType.MINTLIST) {
            // If not owner of both token, or not either a valid operator or owner of parent, require mintlist
            if (!config.parentOwnsBoth || !(config.isOperatorForParentOwner || address(msg.sender) == config.parentOwner)) {
                // TODO should parent owner be required to own both to skip the mintlist checks?
                // if we don't enforce this they can skip mintlist checks after selling
                bytes32 parentMerkleRoot = merkleRoots[parentHash];

                require(
                    parentMerkleRoot != bytes32(0),
                    "ZNSSubRegistrar: Mintlist merkle root not set for parent domain"
                );

                require(
                    subdomainsRegistered[parentMerkleRoot][msg.sender] < merkleProof.amount,
                    "ZNSSubRegistrar: Mintlist limit reached or not allowed to mint"
                );

                // Require the registering user is both listed in the mintlist and has not exceeded their limit
                verifyMerkleProofForDomain(
                    parentHash,
                    msg.sender,
                    merkleProof.amount,
                    merkleProof.proof
                );

                subdomainsRegistered[parentMerkleRoot][msg.sender]++;
            }
        }

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: parentHash,
            domainHash: domainHash,
            label: label,
            registrant: msg.sender,
            price: 0,
            stakeFee: 0,
            domainAddress: domainAddress,
            tokenURI: tokenURI,
            isStakePayment: config.distrConfig.paymentType == PaymentType.STAKE,
            paymentConfig: paymentConfig
        });

        // If parent owns both and caller is either parent or an operator, mint for free
        // If parent does not own both or the caller is not an operator or the owner, pay to mint
        if (!config.parentOwnsBoth || !(config.isOperatorForParentOwner || address(msg.sender) == config.parentOwner)) {
            if (coreRegisterArgs.isStakePayment) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(config.distrConfig.pricerContract))
                    .getPriceAndFee(
                        parentHash,
                        label,
                        true
                    );
            } else {
                coreRegisterArgs.price = IZNSPricer(address(config.distrConfig.pricerContract))
                    .getPrice(
                        parentHash,
                        label,
                        true
                    );
            }
        }

        rootRegistrar.coreRegister(coreRegisterArgs);

        // ! note that the config is set ONLY if ALL values in it are set, specifically,
        // without pricerContract being specified, the config will NOT be set
        if (address(distrConfig.pricerContract) != address(0)) {
            setDistributionConfigForDomain(coreRegisterArgs.domainHash, distrConfig);
        }

        return domainHash;
    }

    /**
     * @notice Helper function to hash a child label with a parent domain hash.
    */
    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) public pure override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(label))
            )
        );
    }

    /**
     * 
     * @param domainHash The domain hash to set this merkle root for
     * @param root The merkle tree root
     */
    function setMerkleRootForDomain(bytes32 domainHash, bytes32 root) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Cannot set merkle root for domain"
        );

        merkleRoots[domainHash] = root;
        // update user counts
    }

    /**
     * 
     * @param domainHash The domain hash to delete the merkle root for
     */
    function deleteMerkleRootForDomain(bytes32 domainHash) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Cannot unset merkle root for domain"
        );

        delete merkleRoots[domainHash];
    }

    // Get count a user has registered under a specific merkle root
    function getCount(bytes32 domainHash, address user) public view returns(uint256) {
        bytes32 domainMerkleRoot = merkleRoots[domainHash];
        return subdomainsRegistered[domainMerkleRoot][user];
    }

    /**
     * 
     * @param parentHash The domain that specifies the merkle root to verify against
     * @param candidate The registering user
     * @param amount The amount of registrations the user is allowed
     * @param proof The cryptographic proof generated by that merkle tree for this user
     */
    function verifyMerkleProofForDomain(
        bytes32 parentHash,
        address candidate,
        uint256 amount,
        bytes32[] calldata proof
    ) public view override {
        bytes32 node = keccak256(bytes.concat(keccak256(abi.encode(candidate, amount))));

        bytes32 rootForDomain = merkleRoots[parentHash];

        require(MerkleProofUpgradeable.verify(proof, rootForDomain, node), "ZNSSubRegistrar: Invalid proof");
    }

    /**
     * @notice Setter for `distrConfigs[domainHash]`.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * @dev This config can be changed by the domain owner/operator at any time or be set
     * after registration if the config was not provided during the registration.
     * Fires `DistributionConfigSet` event.
     * @param domainHash The domain hash to set the distribution config for
     * @param config The new distribution config to set (for config fields see `IDistributionConfig.sol`)
    */
    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(config.pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash] = config;

        emit DistributionConfigSet(
            domainHash,
            config.pricerContract,
            config.paymentType,
            config.accessType
        );
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `pricerContract` field of the struct.
     * Made to be able to set the pricer contract for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PricerContractSet` event.
     * @param domainHash The domain hash to set the pricer contract for
     * @param pricerContract The new pricer contract to set
    */
    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricer pricerContract
    ) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        require(
            address(pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash].pricerContract = pricerContract;

        emit PricerContractSet(domainHash, address(pricerContract));
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `paymentType` field of the struct.
     * Made to be able to set the payment type for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PaymentTypeSet` event.
     * @param domainHash The domain hash to set the payment type for
     * @param paymentType The new payment type to set
    */
    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        distrConfigs[domainHash].paymentType = paymentType;

        emit PaymentTypeSet(domainHash, paymentType);
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `accessType` field of the struct.
     * Made to be able to set the access type for a domain without setting the whole config.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * Fires `AccessTypeSet` event.
     * @param domainHash The domain hash to set the access type for
     * @param accessType The new access type to set
    */
    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        distrConfigs[domainHash].accessType = accessType;
        emit AccessTypeSet(domainHash, accessType);
    }

    /**
     * @notice Setter for `mintlist[domainHash][candidate]`. Only domain owner/operator can call this function.
     * Adds or removes candidates from the mintlist for a domain. Should only be used when the domain's owner
     * wants to limit subdomain registration to a specific set of addresses.
     * Can be used to add/remove multiple candidates at once. Can only be called by the domain owner/operator.
     * Fires `MintlistUpdated` event.
     * @param domainHash The domain hash to set the mintlist for
     * @param candidates The array of candidates to add/remove
     * @param allowed The array of booleans indicating whether to add or remove the candidate
    */
    function updateMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        Mintlist storage mintlistForDomain = mintlist[domainHash];
        uint256 ownerIndex = mintlistForDomain.ownerIndex;

        for (uint256 i; i < candidates.length; i++) {
            mintlistForDomain.list[ownerIndex][candidates[i]] = allowed[i];
        }

        emit MintlistUpdated(domainHash, ownerIndex, candidates, allowed);
    }

    function isMintlistedForDomain(
        bytes32 domainHash,
        address candidate
    ) external view override returns (bool) {
        uint256 ownerIndex = mintlist[domainHash].ownerIndex;
        return mintlist[domainHash].list[ownerIndex][candidate];
    }

    /*
     * @notice Function to completely clear/remove the whole mintlist set for a given domain.
     * Can only be called by the owner/operator of the domain or by `ZNSRootRegistrar` as a part of the
     * `revokeDomain()` flow.
     * Emits `MintlistCleared` event.
     * @param domainHash The domain hash to clear the mintlist for
     */
    function clearMintlistForDomain(bytes32 domainHash)
    public
    override
    onlyOwnerOperatorOrRegistrar(domainHash) {
        mintlist[domainHash].ownerIndex = mintlist[domainHash].ownerIndex + 1;

        emit MintlistCleared(domainHash);
    }

    function clearMintlistAndLock(bytes32 domainHash)
    external
    override
    onlyOwnerOperatorOrRegistrar(domainHash) {
        setAccessTypeForDomain(domainHash, AccessType.LOCKED);
        clearMintlistForDomain(domainHash);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSSubRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Setter for `rootRegistrar`. Only admin can call this function.
     * Fires `RootRegistrarSet` event.
     * @param registrar_ The new address of the ZNSRootRegistrar contract
    */
    function setRootRegistrar(address registrar_) public override onlyAdmin {
        require(registrar_ != address(0), "ZNSSubRegistrar: _registrar can not be 0x0 address");
        rootRegistrar = IZNSRootRegistrar(registrar_);

        emit RootRegistrarSet(registrar_);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
