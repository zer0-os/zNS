# FAQ

## Why is ownership divided into two pieces?

Ownership of a registered domain exists as the owner of that ERC721 token, as well as the owner of the domain record held within the ZNSRegistry. The reason this divide exists is because it will allow users to own their domain, in the eyes of ZNS, while not having to have that NFT in their wallet. This way they can lend it to other contracts for things like staking etc. without losing the benefits given to them by the protocol.

## What does it mean to reclaim a domain?

To reclaim a domain means to take back ownership listed in the ZNS Registry. This requires you own the ERC721 token and that the owner in the domain record is not already you.

If you receive a domain NFT through a transfer of any kind, it is **imperative** that you call to `reclaim` that domain immediately. If you do not, the prior owner is still listed as the owner in the domain record in the ZNS Registry, and they or their operators will still be able to make modifications to the domain.

## What does it mean to revoke a domain?

To revoke a domain means to forfeit ownership of that domain and burn the associated NFT. When you've staked a subdomain, the staked amount is returned to you when you revoke that domain. Note that associated fees with staking are not refunded.

## What is a domain hash?

A cryptographic hash function of that domain's label, **not** name. For example, the `wilder.world` domain has a name of `wilder.world` but the label is specifically just `world`.&#x20;

For top level domains, or Worlds, there is no parent domain and so the domain hash is calculated as:

```solidity
bytes32 domainHash = keccak256(bytes(name));
```

For subdomains, the parent domain hash exists and so the domain hash is instead calculated as:

<pre class="language-solidity"><code class="lang-solidity"><strong>bytes32 domainHash = keccak256(abi.encodePacked(parentHash,keccak256(bytes(label))));
</strong></code></pre>

## What is a distribution configuration?

A distribution configuration specifies three things. The type of payment this domain accepts (STAKE vs. DIRECT), the accessibility of this domain to have subdomains minted (LOCKED, OPEN, or MINTLIST), and the ZNSPricer contract to use for this domain.

This configuration is given to the domain upon registration through either `registerRootDomain` or `registerSubdomain`

Read more in [Broken link](broken-reference "mention")

## What is a payment configuration?

A payment configuration specifies what ERC20 token the payment for a domain is relative to as well as who the recipient of stakes fees or direct payment will go to for registration of subdomains.

This configuration is given to the domain upon registration through either `registerRootDomain` or `registerSubdomain` or using the `setPaymentConfig`

Read more in [Broken link](broken-reference "mention")

## What is a price configuration?

A price configuration specifies the necessary variables required by the `ZNSPricer` contract used by the registrar. If this contract is one of the two pricing contracts ZNS has created, then the configuration specifies either a single price for each domain regardless of that domain label's length for the FixedPricer, or the base length, maximum length, minimum price, and maximum price of a domain if using the CurvedPricer. More is available on these values and what they mean in  [Broken link](broken-reference "mention")

For simplicity, much of this configuration is handled for you when you register a domain through the dApp.&#x20;

Read more in [Broken link](broken-reference "mention")

## What is an operator?

Operators are specific addresses that you've allowed to modify domains on your behalf. At any time, an owner of a domain is able to grant an operator access to their domains. This is done to be able to allow third-party applications or other users to be able to manage domains for an owner without requiring that the owner forfeit that NFT.

It's important to note that operators are assigned at an owner level, not a domain level. This means that if the domain is transferred to a new owner, both the old owner and their operators will lose access to it.&#x20;

Many of the functions within ZNS use the `onlyOwnerOrOperator` guard to restrict who is able to call that function. As mentioned above, ownership is divided into two portions. If the ERC721 token is transferred to another owner, the old owner will still own the domain record within the registry until the new owner calls to `reclaim` that domain. Because the operator functionality relies on that domain record, an allowed operator of the old domain owner is still able to make modifications to the domain after selling it. Therefore, it's imperative that if you purchase a domain from another user, you call to `reclaim` that domain immediately.

This functionality does not yet exist in the dApp, but is on the roadmap. For now it requires using the contracts directly on Etherscan.

