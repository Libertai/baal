# Crypto Research

Fetch token data, DeFi metrics, and protocol analytics using public APIs.

## CoinGecko API (No Key Required)

### Token Price and Market Data
```
web_fetch: url=https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,aleph-zero&vs_currencies=usd&include_24hr_change=true&include_market_cap=true
  prompt=Show each token's price, 24h change, and market cap
```

### Detailed Token Info
```
web_fetch: url=https://api.coingecko.com/api/v3/coins/ethereum
  prompt=Extract: current price, ATH, ATL, market cap rank, 24h volume, circulating supply, description summary
```

### Token Price History
```
web_fetch: url=https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30
  prompt=Summarize the 30-day price trend: high, low, current, and overall direction
```

### Search for Tokens
```
web_fetch: url=https://api.coingecko.com/api/v3/search?query=aleph
  prompt=List matching tokens with their id, symbol, and market cap rank
```

### Trending Tokens
```
web_fetch: url=https://api.coingecko.com/api/v3/search/trending
  prompt=List the top trending tokens with price, 24h change, and market cap
```

## DeFiLlama (No Key Required)

### Protocol TVL Rankings
```
web_fetch: url=https://api.llama.fi/protocols
  prompt=List the top 15 protocols by TVL with chain, category, and TVL amount
```

### Specific Protocol Data
```
web_fetch: url=https://api.llama.fi/protocol/aave
  prompt=Show TVL breakdown by chain, recent TVL trend, and token info
```

### Chain TVL Comparison
```
web_fetch: url=https://api.llama.fi/v2/chains
  prompt=Rank the top 10 chains by TVL and show their percentage of total TVL
```

### Yield/Pool Data
```
web_fetch: url=https://yields.llama.fi/pools
  prompt=Find the top 10 stablecoin yield opportunities above 3% APY, sorted by TVL. Show pool, chain, APY, and TVL.
```

## Ecosystem News

### Project Updates
```
web_search: query=<project-name> announcement 2025
web_fetch: url=<result-url>
  prompt=Summarize the key announcements and their implications
```

## Comparing Tokens

When asked to compare tokens:
1. Fetch both from CoinGecko `/coins/{id}` endpoint
2. Extract: price, market cap, volume, supply, 24h/7d/30d change
3. Fetch TVL from DeFiLlama if applicable
4. Present side-by-side with clear metrics

## Tips

- CoinGecko rate limits: ~10-30 requests/minute without API key
- Use CoinGecko `id` (not symbol) in API calls -- search first if unsure
- DeFiLlama has no rate limits but responses can be large; use specific endpoints
- For historical comparisons, use `/market_chart` with `days` parameter
- Cross-reference CoinGecko market data with DeFiLlama TVL for fuller picture
