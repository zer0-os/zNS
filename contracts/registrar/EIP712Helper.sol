// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import  { IEIP712Helper } from "./IEIP712Helper.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


contract EIP712Helper is EIP712, IEIP712Helper {
    using ECDSA for bytes32;

	// TODO make this real, not the HH rootOwner
	// idea around creating signer in `hashCoupon` or similar
	// then storing that data, and in recreation we have to get the address that signed?
	// how do we bulk sign?
    address constant COUPON_SIGNER = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;

    bytes32 private constant COUPON_TYPEHASH = keccak256(
        "Coupon(bytes32 parentHash,address registrantAddress,string domainLabel)"
    );

	constructor(
        string memory name,
        string memory version
    ) EIP712(name, version) {}

    function hashCoupon(Coupon memory coupon) public view override returns (bytes32) {
		return 
			_hashTypedDataV4(
				keccak256(
					abi.encode(
						COUPON_TYPEHASH,
						coupon.parentHash,
						coupon.registrantAddress,
						keccak256(bytes(coupon.domainLabel))
					)
				)
			);
	}

	// TODO natspec on these
	function recoverSigner(Coupon memory coupon, bytes memory signature) public view override returns (address) {
		return _recoverSigner(coupon, signature);
	}

	// TODO `signedByCouponSigner` instead?
	function isCouponSigner(Coupon memory coupon, bytes memory signature) public view override returns (bool) {
		address signer = _recoverSigner(coupon, signature);
		return signer == COUPON_SIGNER;
	}

	function _recoverSigner(Coupon memory coupon, bytes memory signature) internal view returns (address) {
		bytes32 hash = hashCoupon(coupon);
		return hash.recover(signature);
	}
}