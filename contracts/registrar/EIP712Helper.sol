// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;


import  { IEIP712Helper } from "./IEIP712Helper.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// interface?
contract EIP712Helper is EIP712, IEIP712Helper {

	// TODO make this real, not the HH rootOwner
    address constant COUPON_SIGNER = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;

	// do we need to keep this?
    bytes32 private constant COUPON_TYPEHASH = keccak256(
        "Coupon(bytes32 parentHash,address registrantAddress,uint256 couponNumber)"
    );

	constructor(
        string memory name,
        string memory version
    ) EIP712(name, version) {}

	// TODO more accurate as "hashCoupon"
    function createCoupon(Coupon memory coupon) public view override returns (bytes32) {
		return 
			_hashTypedDataV4(
				keccak256(
					abi.encode(
						COUPON_TYPEHASH,
						coupon.parentHash,
						coupon.registrantAddress,
						coupon.couponNumber
					)
				)
			);
	}

	function recoverSigner(Coupon memory coupon, bytes memory signature) public view override returns (address) {
		bytes32 hash = createCoupon(coupon);
		return ECDSA.recover(
			hash,
			signature
		);
	}

	function isCouponSigner(Coupon memory coupon, bytes memory signature) public view override returns (bool) {
		bytes32 hash = createCoupon(coupon);
		address signer = ECDSA.recover(hash, signature);
		return signer == COUPON_SIGNER;
	}
}