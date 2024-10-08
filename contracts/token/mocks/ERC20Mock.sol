// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// solhint-disable
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {
    uint256 private _totalSupplyBase = 10000000000000000000000;

    constructor(address owner_, uint256 decimals_) ERC20("TokenMock", "ETM") {
        _mint(owner_, totalSupply());
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupplyBase * 10 ** decimals();
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
