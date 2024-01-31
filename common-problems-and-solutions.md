# Common Problems and Solutions

## My transaction is too expensive

Gas fees associated with Ethereum transactions are an artifact of demand on the network, and so are beyond control of any single protocol. Check gas prices on etherscan and if they're high try waiting to perform your transaction later.

## "Cannot estimate gas" in MetaMask or other web wallet

This is a broad error that generally means "something will revert with the way this transaction is formed right now" but it does not provide the information as to what specifically will fail.&#x20;

For context, when MetaMask tries to form the transaction it can calculate the necessary fees ahead of time based on the expected Solidity opcodes to be used in that contract's code for this transaction. When something will fail, it is unable to do this correctly calculation.

To resolve this, try dissecting each argument you are providing to the function you're trying to execute. Ask yourself, what is the current state of this or other contracts that it will call to? Does my knowledge of what the state of those contracts is match what is true? Am I allowed to give certain values as arguments to this function?
