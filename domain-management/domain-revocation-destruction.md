# Domain Revocation (Destruction)

When a domain is revoked, any of its subdomains still exist within ZNS and are not abandoned. Instead, that space exists for any future minting of a domain with the same name. In the interim, that domain hash is assigned the access type _Locked,_ as specified above. This means no new subdomains can be minted for the burned domain. When a new domain is minted with the same name, the new owner will be able to reset the access type and any other data if they wish.
