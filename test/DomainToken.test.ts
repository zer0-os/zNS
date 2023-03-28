import * as hre from "hardhat";
import { ZNSDomainToken, ZNSDomainToken__factory } from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import { impersonateAddressWithBalance } from "./helper/impersonateAddressWithBalance";

describe("ZNSDomainToken:", () => {
    const TokenName = "ZNSDomainToken";
    const TokenSymbol = "ZDT";

    let deployer: SignerWithAddress
    let caller: SignerWithAddress;
    let callerAddress = "0x628016c31c2EC22fdd901ba6525A5F75B58A0326";
    let domainToken: ZNSDomainToken;

    beforeEach(async () => {
        [deployer] = await hre.ethers.getSigners();
        const deomainTokenFactory = new ZNSDomainToken__factory(deployer);

        domainToken = await deomainTokenFactory.deploy();
        caller = await impersonateAddressWithBalance(callerAddress);
    })

    describe("External functions", () => {
        it("Registers a token", async () => {
            const tx = await domainToken.connect(deployer).register(callerAddress, ethers.BigNumber.from("1"));
            const receipt = await tx.wait(0);
            //Verify Transfer event is emitted
            expect(receipt.events?.[0].event).to.eq("Transfer");
            let balance = await domainToken.balanceOf(callerAddress);
            expect(balance).equals(ethers.BigNumber.from(1));
        });
        it("Revokes a token", async () => {
            //Mint domain
            await domainToken.connect(deployer).register(callerAddress, ethers.BigNumber.from("1"));
            let balance = await domainToken.balanceOf(callerAddress);
            expect(balance).equals(ethers.BigNumber.from(1));

            //Revoke domain
            const tx = await domainToken.connect(caller).revoke(ethers.BigNumber.from("1"));
            const receipt = await tx.wait(0);
            //Verify Transfer event is emitted
            expect(receipt.events?.[0].event).to.eq("Transfer");
            balance = await domainToken.balanceOf(callerAddress);
            //Verify token has been burned
            expect(balance).equals(ethers.BigNumber.from(0));
        });
    });
    describe("Require Statement Validation", () => {
        it("Only owner can revoke a token", async () => {
            //Mint domain
            await domainToken.connect(deployer).register(callerAddress, ethers.BigNumber.from("1"));
            let balance = await domainToken.balanceOf(callerAddress);
            expect(balance).equals(ethers.BigNumber.from(1));

            //Revoke domain
            const tx = domainToken.connect(deployer).revoke(ethers.BigNumber.from("1"));
            await expect(tx).to.be.revertedWith("ZNSDomainToken: Owner of sender does not match Owner of token");
            balance = await domainToken.balanceOf(callerAddress);
            //Verify token has not been burned
            expect(balance).equals(ethers.BigNumber.from(1));
        });
    });
    describe("Contract Configuration", () => {
        it("Verify token name", async () => {
            let name = await domainToken.name();
            expect(name).to.equal(TokenName);
        });
        it("Verify token symbol", async () => {
            let symbol = await domainToken.symbol();
            expect(symbol).to.equal(TokenSymbol);
        });
    });
})