# Payments

Payment config can be provided during the registration process or can be set by the domain owner or operator at any time later.

There are two options for the differing types of payment management in ZNS.

* The first of which is `DIRECT` payment that just transfers the price of a domain registration to the `beneficiary` address set by the parent domain owner in its payment configuration + protocol fee to Zero that is burned upon reception.
* The second is `STAKE`payment, which stakes the calculated price of the domain registration in the `ZNSTreasury` and likewise transfers the staking fee, if one is specified, to the beneficiary specified by the payment configuration + also protocol fee that is burned. In this case, the user then has an option to unstake the payment and get the funds back if they call to revoke their domain. Upon revocation, the protocol fee will be taken again.

The payment configuration requires specifying just two fields:

* **Payment Token**: Address of the token chosen for the payments by the parent domain owner who distributes subdomains. By default, this is the MEOW token.
* **Beneficiary**: Address which will receive funds from the purchase of a domain.

Users are also able to call `revoke` on their domain after they've purchased with a direct payment, but they are not refunded any amount in this case.

All of the above data can be set repeatedly at any time by either the owner of the domain or an allowed operator of it.

An additional protocol fee exists on any of the above transactions for any non-zero priced domain to be sent to the beneficiary specified in the configuration for the `0x0` domain hash. This is a value we set as a small fee for enabling the domain system protocol.
