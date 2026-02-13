# Smart Contract Reading

Read, analyze, and explain Solidity and Vyper smart contracts.

## Reading Contracts

### Load and Inspect
```
read_file: path=contracts/Token.sol
list_dir: path=contracts/
```

### Identify Contract Structure
When reading a contract, look for and report:
1. **Pragma and imports** -- compiler version, dependencies
2. **Inheritance chain** -- `is ERC20, Ownable, ReentrancyGuard`
3. **State variables** -- storage layout, visibility, types
4. **Constructor** -- initialization parameters and logic
5. **External/public functions** -- the contract's interface
6. **Modifiers** -- access control patterns
7. **Events** -- what the contract logs on-chain

## Common Patterns

### Token Standards
- **ERC-20**: `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`, `totalSupply`
- **ERC-721 (NFT)**: `ownerOf`, `safeTransferFrom`, `tokenURI`, `approve`, `setApprovalForAll`
- **ERC-1155 (Multi-token)**: `balanceOf(address,id)`, `safeBatchTransferFrom`, `uri`
- **ERC-4626 (Vault)**: `deposit`, `withdraw`, `convertToShares`, `convertToAssets`

### Proxy Patterns
- **Transparent Proxy**: admin-only `upgradeTo()`, separate ProxyAdmin contract
- **UUPS**: `upgradeTo()` lives in the implementation, uses `_authorizeUpgrade`
- **Beacon**: multiple proxies share one beacon that points to the implementation
- **Minimal Proxy (Clone)**: EIP-1167, fixed bytecode delegating to a single implementation

When you see `delegatecall` or `fallback()` forwarding, the contract is likely a proxy. The implementation address is usually in a specific storage slot (EIP-1967: `0x360894...`).

### Access Control
- **Ownable**: single `owner`, `onlyOwner` modifier, `transferOwnership`
- **AccessControl**: role-based with `bytes32` role IDs, `grantRole`, `revokeRole`, `hasRole`
- **Timelock**: delayed execution via `schedule` + `execute` after a minimum delay

## Vulnerability Checklist

When reviewing a contract, check for:

### Reentrancy
- External calls before state updates (checks-effects-interactions violation)
- Missing `ReentrancyGuard` / `nonReentrant` on functions that transfer ETH/tokens
- `call{value:}("")` without reentrancy protection

### Integer Issues
- Solidity <0.8: no built-in overflow protection, needs SafeMath
- Solidity >=0.8: built-in checks, but `unchecked {}` blocks bypass them
- Division before multiplication (precision loss)

### Access Control
- Missing `onlyOwner` or role checks on sensitive functions
- Unprotected `selfdestruct` or `delegatecall`
- Default visibility (functions are `public` by default in older Solidity)

### Logic Issues
- Unchecked return values on `transfer` / `transferFrom` (use SafeERC20)
- Front-running vulnerability in approve (use `increaseAllowance` instead)
- Incorrect comparison: `==` where `>=` is needed for thresholds
- Missing zero-address checks on `address` parameters

### Oracle and External Data
- Stale price data (missing freshness check on Chainlink `updatedAt`)
- Single oracle dependency without fallback
- Flash loan manipulation of spot prices (using AMM reserves as oracle)

## Explaining Contracts

When explaining a contract to the user:
1. Start with a one-sentence summary of what the contract does
2. List the main functions and what each does in plain language
3. Note the access control model (who can do what)
4. Highlight any unusual patterns or potential risks
5. If it interacts with other contracts, describe the dependencies

## Tips

- Use `bash: grep -n "function " Contract.sol` to quickly list all functions
- For large codebases, start with the main contract and trace imports with `read_file`
- Check `constructor` and `initialize` (for proxies) to understand setup
- Look at events to understand what state changes the contract considers important
- Storage slot comments often reveal intended upgrade patterns
