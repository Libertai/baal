# API Testing

Test REST APIs using curl and jq via the bash tool.

## Basic Requests

```bash
# GET with auth
curl -s -H "Authorization: Bearer TOKEN" https://api.example.com/users | jq .

# POST JSON
curl -s -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}' | jq .

# PUT / PATCH
curl -s -X PUT https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}' | jq .

# DELETE
curl -s -X DELETE https://api.example.com/users/1 -w "\nHTTP %{http_code}\n"
```

## Inspecting Responses

```bash
# Status code only
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)\n" https://api.example.com/health

# Headers and body
curl -si https://api.example.com/users/1
```

## Parsing JSON with jq

```bash
# Extract field
curl -s https://api.example.com/users | jq '.[0].name'

# Filter array
curl -s https://api.example.com/users | jq '[.[] | select(.active == true)]'

# Multiple fields
curl -s https://api.example.com/users | jq '.[] | {name, email}'

# Count results
curl -s https://api.example.com/users | jq 'length'
```

## Chaining Requests

```bash
# Create then fetch
ID=$(curl -s -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}' | jq -r '.id')
curl -s https://api.example.com/users/$ID | jq .
```

## Testing Error Cases

```bash
# 404
curl -s -w "\nHTTP %{http_code}\n" https://api.example.com/users/99999

# Validation error (empty body)
curl -s -X POST https://api.example.com/users \
  -H "Content-Type: application/json" -d '{}' | jq .

# Auth failure
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer invalid" https://api.example.com/protected
```

## Tips
- Use `-s` to suppress progress bars
- Use `-w "\nHTTP %{http_code}\n"` to print status codes
- Use `jq -r` for raw strings without quotes
- Use `--max-time 10` to set request timeouts
- Pipe to `jq .` for pretty-printed JSON output
