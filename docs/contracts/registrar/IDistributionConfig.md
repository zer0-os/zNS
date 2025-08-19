## IDistributionConfig

**IDistributionConfig.sol - An interface containing all types required for
distribution configuration of a domain.**

Types outlined in this config are stored on the `ZNSSubRegistrar` contract and are used to determine
how subdomains are distributed for each parent domain.
Below are docs for the types in this file:
 - `DistributionConfig`: Struct containing the configuration data for a parent domain:
     + `pricerContract`: The address of the pricer contract chosen by the owner of the
         parent domain (IZNSPricer type required!)
     + `paymentType`: The payment type chosen by the owner of the parent domain
     + `accessType`: The access type chosen by the owner of the parent domain
 - `AccessType`: Enum signifying the access type of a parent domain:
     + `LOCKED`: The parent domain is locked which mean no subdomains can be registered
     + `OPEN`: The parent domain is open which means anyone can register a subdomain
     + `MINTLIST`: The parent domain has to approve each individual address for registering a subdomain
 - `PaymentType`: Enum signifying the payment type for a parent domain:
     + `DIRECT`: The subdomains are paid for directly by the user to the beneficiary chosen by the owner
     + `STAKE`: The subdomains are paid for by staking an amount of token chosen by the owner to ZNSTreasury
 - `priceConfig`: Bytes array representation of one config for one of the pricer contracts. Has to be encoded
     from the struct according to the specific pricer rules. Used as a polymorphic type to allow a single
     tx to fully register and setup a domain and to make pricer contracts stateless.

### AccessType

```solidity
enum AccessType {
  LOCKED,
  OPEN,
  MINTLIST
}
```

### PaymentType

```solidity
enum PaymentType {
  DIRECT,
  STAKE
}
```

### DistributionConfig

Struct to define the entirety of the distribution of subdomains for a domain

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |

```solidity
struct DistributionConfig {
  contract IZNSPricer pricerContract;
  enum IDistributionConfig.PaymentType paymentType;
  enum IDistributionConfig.AccessType accessType;
  bytes priceConfig;
}
```

### PaymentTypeSet

```solidity
event PaymentTypeSet(bytes32 domainHash, enum IDistributionConfig.PaymentType paymentType)
```

Emitted when a new `DistributionConfig.paymentType` is set for a domain.

### AccessTypeSet

```solidity
event AccessTypeSet(bytes32 domainHash, enum IDistributionConfig.AccessType accessType)
```

Emitted when a new `DistributionConfig.accessType` is set for a domain.

### DistributionConfigSet

```solidity
event DistributionConfigSet(bytes32 domainHash, contract IZNSPricer pricerContract, bytes pricerConfig, enum IDistributionConfig.PaymentType paymentType, enum IDistributionConfig.AccessType accessType)
```

Emitted when a new full `DistributionConfig` is set for a domain at once.

