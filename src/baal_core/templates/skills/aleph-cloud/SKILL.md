# Aleph Cloud

Manage Aleph Cloud resources: instances, storage, programs, and network status.

## Overview

Aleph Cloud is a decentralized cloud computing platform. The native token is $ALEPH, used for storage fees and compute credits. Resources are managed via the `aleph` CLI and REST APIs.

## CLI Basics

### Installation and Account
```
bash: pip install aleph-sdk-python
bash: aleph account show                         # display wallet address and balance
bash: aleph account export-private-key           # export current private key
```

### Instance Management
```
bash: aleph instance create --name my-vm --cpu 1 --memory 2048 --rootfs-size 20000
bash: aleph instance list                        # list all your instances
bash: aleph instance list --json | python3 -c "import sys,json; [print(f'{i[\"item_hash\"][:12]}  {i.get(\"metadata\",{}).get(\"name\",\"unnamed\")}') for i in json.load(sys.stdin)]"
bash: aleph instance stop <item-hash>            # stop a running instance
bash: aleph instance delete <item-hash>          # delete permanently
bash: aleph instance logs <item-hash>            # fetch instance logs
```

### Storage Operations
```
bash: aleph file upload ./data.tar.gz            # upload file, returns item hash
bash: aleph file download <item-hash> -o out.bin # download by hash
bash: aleph file list                            # list uploaded files
bash: aleph file pin <item-hash>                 # pin existing content
```

### Program Deployment
```
bash: aleph program upload ./my-program --entrypoint main:app --runtime python3
bash: aleph program list                         # list deployed programs
bash: aleph program update <item-hash> ./my-program
```

## REST APIs via web_fetch

### Network Status
```
web_fetch: url=https://api2.aleph.im/api/v0/info/public.json
  prompt=Show network stats: total messages, active nodes, storage used
```

### Query Messages (posts, aggregates, programs)
```
web_fetch: url=https://api2.aleph.im/api/v0/messages.json?addresses=<wallet>&pagination=10&page=1
  prompt=List the most recent messages from this address with type and timestamp
```

### Check Aggregate (key-value state)
```
web_fetch: url=https://api2.aleph.im/api/v0/aggregates/<address>.json?keys=profile
  prompt=Extract the profile aggregate data for this address
```

### PAYG Credit Balance
```
web_fetch: url=https://api2.aleph.im/api/v0/aggregates/<address>.json?keys=balance
  prompt=Show the current PAYG credit balance and any recent top-ups
```

### Compute Resource Nodes (CRNs)
```
web_fetch: url=https://api4.aleph.im/api/v0/nodes/compute/list
  prompt=List active compute nodes with their scores, addresses, and resource availability
```

### Core Channel Nodes (CCNs)
```
web_fetch: url=https://api2.aleph.im/api/v0/nodes/core/list
  prompt=Show core channel nodes: status, staked amount, and uptime
```

## Common Tasks

### Check Instance Health
```
web_fetch: url=https://<instance-domain>/vm/<item-hash>
  prompt=Check if this Aleph instance is responding and report its status
```

### Estimate Costs
- Storage: 0.002 ALEPH/MB/month for persistent storage
- Compute: PAYG pricing varies by CRN; check `/api/v0/price/compute` for current rates
- Use `aleph account show` to verify sufficient balance before creating resources

### Debug Deployment Issues
1. `bash: aleph instance list --json` -- check instance status
2. Query CRN list to verify the target node is online
3. Check instance logs for boot errors
4. Verify the instance's network connectivity via its public IPv6

## Tips

- Always check `aleph account show` for balance before creating resources
- Use `--json` flag with CLI commands to get machine-parseable output
- CRN scores indicate reliability -- prefer nodes with scores above 0.8
- Instance item hashes are the primary identifier for all operations
- The API at `api2.aleph.im` is the main public endpoint; `api4.aleph.im` is an alternative
