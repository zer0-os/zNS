# Contract Upgradeability

Most of the contracts in zNS (except `ZNSAccessController`) are upgradeable UUPS Proxies. We understand the limitations it entails, so please consider the following:

1. We decided to go with upgradeable pattern for zNS to ensure we are able to fix any potential problems that may arise in the system with usage. We also wanted to have an ability to evolve system over time with the help of user feedback and possibly add features that our users might find necessary.
2. Upgradability of contracts will be managed by the Zero DAO, which will directly control all aspects of zNS over time. The control will start with a Zero 6 of 12 multisig and slowly evolve into a full fledged DAO which will gain more and more control over time as the system logic finalizes.
3. All upgradeable proxies are of UUPS kind. One of the main reasons to use UUPS here is to introduce a way to remove upgradability with time after the system is fully finalized and proven to be bug free or if the Zero DAO decides to do it themselves.
4. Since Zero is an open-source platform, all smart contract changes coming with proxy upgrades will be public and available for anyone to see and analyze. In addition to that, any significant logic changes to existing contracts or addition of new contracts will be audited before they are deployed to Ethereum mainnet. When the DAO is fully functional, only the DAO will be able to approve a mainnet contract upgrade.

