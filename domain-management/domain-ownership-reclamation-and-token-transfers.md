# Domain Ownership, Reclamation, and Token Transfers

### Ownership

Ownership of ZNS domains is split between two entities: the domain's Registry record and the Domain Token. Each of these components can be assigned to the same address, or to two (but no more than two) different addresses:

* **Owner of the Name** - `owner` value in the record stored in `ZNSRegistry`. This value is used for access control in important domain management functions.
* **Owner of the Token** - `ownerOf(tokenId)` in the `ZNSDomainToken` contract. This is a standard ERC-721 token ownership pattern, and represents ownership of the domain token's associated NFT.

This bipartition is done by ZNS to support smart contract systems on top of ZNS domains. Owners of any level of domain can implement their own smart contracts that manage subdomain distribution or any number of other functions. Owners can split ownership by setting a domain record owner in `ZNSRegistry` to a specific contract, while keeping the domain's NFT in a wallet. This can also be done with other accounts (like wallets) to allow separate entities or users to manage important domain functions -- as in a DAO structure -- without risking actual ownership of the domain. See [Broken link](broken-reference "mention")for more details.

In the case of domain with split ownership of its record and NFT,  the domain's record ownership can be reclaimed by the owner of the domain's ERC-721 token at any time using the `reclaimDomain` call. This can happen at the contract level, or can take place in the UI layer of applications like ZERO's native Explorer. When a domain's token owner reclaims its record, the owner of the record in `ZNSRegistry` will be set to the wallet that owns the NFT.  See [#reclamation](domain-ownership-reclamation-and-token-transfers.md#reclamation "mention")below for more information on this process.

There are certain domain functions that can only be performed by a user who owns both the domain's token and it's record. These are:

* Domain revocation (see [Broken link](broken-reference "mention"))
* Self-registrations of subdomains for free (see [Broken link](broken-reference "mention"))

The requirement to own both tokens in these cases is intended to curtail potential abuse of domains by delegate record owners.

### Reclamation

The domain reclamation flow is critical for the reestablishment of full ownership of a domain by a single party in instances where a domain has different owners of its token and its record. ZNS domain reclamation occurs via logic related to `ZNSDomainToken`, but starts in `ZNSRootRegistrar`.

Ownership of a specific `tokenId` verified in a call to ensure the caller is the domain token owner. Once this is verified as true, `ZNSRootRegistrar` calls `ZNSRegistry` to set the `owner` field in the Registry Record to the address of the caller (the token owner).

<figure><img src="broken-reference" alt="" width="563"><figcaption><p>The core domain reclaim flow</p></figcaption></figure>

Note that reclamation is not necessary if the current delegation of ownership is beneficial to all parties involved; rather, the reclamation flow is intended as a simple means of restoring ownership to a single entity in the event that a domain token owner desires to restore 'full' ownership function to their individual account. Any user holding a ZNS domain token in their account is able to reclaim the domain's record from its owner at any time.

{% hint style="info" %}
Only the account that owns/holds the domain's ERC-721 (NFT) token can reclaim the full domain. Owners of the domain's record in `ZNSRegistry` cannot reclaim a domain.
{% endhint %}

### Domain Token Sales, Purchases and Transfers

ZNS domain tokens are standard ERC-721 tokens -- NFTs -- meaning they are salable and transferrable like any other NFT on platforms and exchanges that support the ERC-721 standard. Both purchased and received (as from a transfer) ZNS domain tokens will need to be reclaimed (see above) by their new owners. In this context, reclamation can be thought of as "registration" for new owners. In the event that the domain in question was registered via ZERO's stake-to-mint paradigm, the new owner will also inherit ownership of the stake.&#x20;

{% hint style="warning" %}
It bears repeating: purchasing (as through a secondary marketplace) or receiving (as through transfer) a domain's ERC-721 token does not make the new owner of the token the full owner of the domain. Until they go through the reclamation flow at the contract or application -- like ZERO's Explorer -- level, they remain the domain's token owner only.

New owners of a domain's NFT acquired via means outside direct minting are required to undergo domain reclamation to become the domain's 'full' owner, enabling them to change subdomain distribution rules or perform other domain management functionalities.
{% endhint %}

Domains owners that have acquired a new domain via purchase or transfer will inherit all subdomain distribution rules from its previous owner, as well as pricing and payment configs and Resolver records. New subdomain owners can and should change these rules if desired; though existing children domains are fully emancipated and will remain unaffected by altering these configs, future child subdomains will. Please note that new owners of a parent domain will only be paid for new child subdomain registrations under their domain after they have reclaimed the domain's record from its previous owner (see [Broken link](broken-reference "mention")). &#x20;

{% hint style="danger" %}
Until reclamation has occurred, new owners of a domain's token after secondary purchase or NFT transfer will not own the domain's record in `ZNSRegistry`. Instead, the previous owner (and associated operators, see [Broken link](broken-reference "mention")) will still have access to some domain management functionality, including subdomains distribution rules under that parent domain.

**New domain token owners should reclaim their domain's record from the previous owner immediately after purchase or transfer if they wish access domain management functions and sell subdomains!**
{% endhint %}
