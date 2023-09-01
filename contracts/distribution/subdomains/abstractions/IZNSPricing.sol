// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


/**
 * @title IZNSPricing
 * @notice Base interface required to be inherited by all Pricing contracts to work with zNS
 */
interface IZNSPricing {
    /**
     * @dev `parentHash` param is here to allow pricing contracts
     *  to have different price configs for different subdomains
     */
    function getPrice(
        bytes32 parentHash,
        string calldata label
    ) external view returns (uint256);

    /**
     * @dev Fees are only supported for PaymentType.STAKE !
     *  This function will NOT be called if PaymentType != PaymentType.STAKE
     *  Instead `getPrice()` will be called.
     */
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label
    ) external view returns (uint256 price, uint256 fee);
}
