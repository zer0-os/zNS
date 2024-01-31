# Names and Hashing

### Names and Hierarchies

ZNS denominates domain name hierarchies in a left-to-right, top-down fashion, e.g., for the domain _0://hello.goodbye_, _hello_ is the top-level domain and _goodbye_ is a subdomain of that domain. While this model of organization universally comprises analog and digital filing systems around the world, it differs from traditional domain naming. In traditional Web2 and Web3 domain name services, the domain _hello.goodbye.com_ comprises three levels: the leftmost item, _hello_, third-level domain and a subdomain of the second-level domain in the structure, _goodbye_. The rightmost element in the name is the top-level domain, _.com._&#x20;

ZNS has chosen to break with DNS tradition and utilize left-right, top-down hierarchies for several reasons:

* Left-right, top-down is the standard organizational paradigm for the world’s digital file systems (Windows, Linux, Mac, etc.) and analog indexing systems (Dewey Decimal or Universal Decimal Classification, Harvard-Yenching Classification, etc.).
* Left-right, top-down follows the word order and directional reading practiced by the majority of the world and world’s languages.
* Finally, Left-right, top down accommodates infinite extensibility of ZNS domains (a subdomain of a subdomain of a subdomain of a subdomain…) in a manner that is intuitively parseable by humans. This feature is glaringly absent from current Web2/Web3 domain nomenclature.

As a result of this, ZNS can accommodate broader routing and indexing functions than traditional DNS systems, making ZNS far more versatile than existing Web3 domain options today.

### Name Hashing and Token IDs

ZNS smart contracts do not work with string representation of domains beyond the initial hashing. Every domain in the protocol is represented by its namehash. Namehash is an algorithm of recursive string hashing where a label of the top-level domain is hashed, then appended to the hash of the child label and hashed again, repeating the process for every level of the full domain string. [<mark style="color:red;">(TODO: add links to namehash from ENS or to what they link).</mark>](#user-content-fn-1)[^1]<mark style="color:red;">St.</mark> To communicate with ZNS smart contracts, a domain's hash is needed. This can be acquired through the ZERO Explorer application, or through ZNS Subgraphs.

As every domain in ZNS is represented with a hash, any given domain's hash is used in ZNS to create `tokenId` for each individual Domain Token NFT created during registration process.\
Token ID is represented as a unsigned integer version of the domain hash: `tokenId = uint256(domainHash)`. This means that any hex converter can be used to parse a domain's hash knowing only its Token ID, and vice versa.

[^1]: 
