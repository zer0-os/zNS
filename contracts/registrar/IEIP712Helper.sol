// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;



interface IEIP712Helper {

	struct Coupon {
        bytes32 parentHash;
        address registrantAddress;
        uint256 couponNumber;
    }

	function createCoupon(
		Coupon memory coupon
	) external view returns (bytes32);

	function recoverSigner(
		Coupon memory coupon,	
		bytes memory signature
	) external view returns (address);

	// 	function isCouponSigner(
	// 	Coupon memory coupon,
	// 	bytes memory signature
	// ) external view returns (bool);
}