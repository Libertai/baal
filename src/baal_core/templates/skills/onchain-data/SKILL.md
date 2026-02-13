# Onchain Data

Query blockchain data via public explorer APIs and RPC endpoints.

## Etherscan-Style APIs

Most EVM chains have Etherscan-compatible APIs. Replace the base URL for other chains:
- Ethereum: `api.etherscan.io`
- Polygon: `api.polygonscan.com`
- Arbitrum: `api.arbiscan.io`
- Base: `api.basescan.org`

### Account Balance
```
web_fetch: url=https://api.etherscan.io/api?module=account&action=balance&address=<address>&tag=latest
  prompt=Show the ETH balance in both wei and ETH
```

### Token Balances (ERC-20)
```
web_fetch: url=https://api.etherscan.io/api?module=account&action=tokentx&address=<address>&page=1&offset=20&sort=desc
  prompt=List recent token transfers: token name, amount, from/to, and timestamp
```

### Transaction History
```
web_fetch: url=https://api.etherscan.io/api?module=account&action=txlist&address=<address>&startblock=0&endblock=99999999&page=1&offset=10&sort=desc
  prompt=Show recent transactions: hash, from, to, value in ETH, gas used, and status (success/fail)
```

### Transaction Details
```
web_fetch: url=https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=<tx-hash>
  prompt=Parse the receipt: status, gas used, logs count, and any token transfer events
```

### Contract ABI
```
web_fetch: url=https://api.etherscan.io/api?module=contract&action=getabi&address=<contract-address>
  prompt=List all function signatures with their parameters and return types
```

## Gas Prices

### Current Gas
```
web_fetch: url=https://api.etherscan.io/api?module=gastracker&action=gasoracle
  prompt=Show current gas prices: slow, standard, fast in gwei, and base fee
```

### Gas via Public RPC
```
bash: curl -s -X POST https://eth.llamarpc.com -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_gasPrice","id":1}' | python3 -c "import sys,json; r=json.load(sys.stdin); print(f'{int(r[\"result\"],16)/1e9:.2f} gwei')"
```

## Event Logs

### Query Contract Events
```
web_fetch: url=https://api.etherscan.io/api?module=logs&action=getLogs&address=<contract>&fromBlock=<start>&toBlock=latest&topic0=<event-signature-hash>&page=1&offset=10
  prompt=Decode and list the events with their parameters and block numbers
```

Common event topic0 hashes:
- Transfer (ERC-20): `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
- Approval (ERC-20): `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`
- Transfer (ERC-721): same topic0 as ERC-20 but with 3 indexed params

## Block Data

### Latest Block
```
bash: curl -s -X POST https://eth.llamarpc.com -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}' | python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))"
```

### Block Details
```
bash: curl -s -X POST https://eth.llamarpc.com -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' | python3 -m json.tool
```

## Tips

- Etherscan free tier: 5 calls/sec. Add `&apikey=<key>` if available for higher limits
- Public RPCs (llamarpc.com, cloudflare-eth.com) have rate limits -- add small delays between calls
- For address analysis: combine balance + txlist + tokentx for a full picture
- Wei to ETH: divide by 1e18. Gwei to ETH: divide by 1e9
- Block timestamps are Unix epoch -- convert with `python3 -c "from datetime import datetime; print(datetime.utcfromtimestamp(<ts>))"`
