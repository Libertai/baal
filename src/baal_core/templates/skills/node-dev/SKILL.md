# Node.js Development

Write, run, and manage Node.js and TypeScript projects using bash, write_file, and edit_file.

## Running Code

### Quick Execution
```
bash: node -e "console.log(JSON.stringify({hello: 'world'}, null, 2))"
bash: node script.js
```

### Write and Run
```
write_file: path=index.js, content="const http = require('http');\n..."
bash: node index.js
```

## Package Management

### npm
```
bash: npm init -y                         # create package.json
bash: npm install express zod             # add dependencies
bash: npm install -D typescript jest      # add dev dependencies
bash: npm install                         # install from package.json
bash: npm run build                       # run script from package.json
bash: npm list --depth=0                  # list top-level packages
```

### pnpm (if available, faster)
```
bash: pnpm install
bash: pnpm add express
bash: pnpm add -D typescript
```

## TypeScript

### Setup
```
bash: npm install -D typescript @types/node
bash: npx tsc --init                     # generate tsconfig.json
```

### Compile and Run
```
bash: npx tsc                            # compile all
bash: npx tsc --noEmit                   # type-check only, no output
bash: npx tsx script.ts                  # run directly (if tsx installed)
bash: npx ts-node script.ts             # run directly (if ts-node installed)
```

### Minimal tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## package.json Scripts

Read existing scripts:
```
bash: node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join('\n'))"
```

Common scripts to add via `edit_file`:
```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "tsx watch src/index.ts",
  "test": "jest",
  "lint": "eslint src/"
}
```

## Testing

### Jest
```
bash: npm install -D jest @types/jest ts-jest
bash: npx jest                           # run all tests
bash: npx jest --testPathPattern=auth    # match test files
bash: npx jest --watch                   # re-run on changes
```

### Vitest (for Vite-based projects)
```
bash: npx vitest run                     # run once
bash: npx vitest run src/utils.test.ts   # specific file
```

## Debugging

When a script fails, read the error:
- `MODULE_NOT_FOUND` -- package not installed or wrong import path
- `SyntaxError` -- check the file at the reported line with `read_file`
- `TypeError: X is not a function` -- wrong import (default vs named) or undefined variable
- `EADDRINUSE` -- port already in use: `bash: kill $(lsof -t -i:3000)`

Debug cycle:
```
bash: node script.js
# Fails at line 25:
read_file: path=script.js, offset=20, limit=15
edit_file: path=script.js, old_string="broken code", new_string="fixed code"
bash: node script.js
```

## Common Patterns

### HTTP Server (Express)
```javascript
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(3000, () => console.log('Listening on :3000'));
```

### Fetch Data
```javascript
const resp = await fetch('https://api.example.com/data');
const data = await resp.json();
```

### File I/O
```javascript
const fs = require('fs/promises');
const data = await fs.readFile('config.json', 'utf-8');
await fs.writeFile('output.json', JSON.stringify(result, null, 2));
```

## Tips

- Check versions: `bash: node --version && npm --version`
- Use `npx` to run local binaries without global install
- ESM vs CJS: check `"type": "module"` in package.json for import/export style
- Node 18+ has native `fetch`, `crypto.randomUUID()`, and test runner
- Use `--experimental-strip-types` (Node 22+) to run TypeScript directly
