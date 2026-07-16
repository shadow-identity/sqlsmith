# @sqlsmith/vite-plugin

Vite plugin for SQLsmith - automatic SQL schema merging during development.

## Installation

```bash
npm install -D @sqlsmith/vite-plugin
```

Supports Vite 4, 5, and 6; the integration suite runs against Vite 6.4.3.

## Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { sqlsmith } from '@sqlsmith/vite-plugin'

export default defineConfig({
  plugins: [
    sqlsmith({
      input: './src/schemas',     // Directory with SQL files
      output: './src/schema.sql', // Output merged file
      dialect: 'postgresql',      // Optional: SQL dialect
      defaultSchema: 'public',    // Optional: unqualified relation schema
      logLevel: 'info'            // silent | error | warn | info | debug
    })
  ]
})
```

## Options

- `input` (required): Directory containing SQL files
- `output` (required): Output file path for merged schema
- `dialect` (optional): SQL dialect - `postgresql`, `mysql`, `sqlite`, `bigquery` (default: `postgresql`)
- `defaultSchema` (optional): Schema assigned to unqualified relation names (PostgreSQL default: `public`)
- `watch` (optional): Enable file watching (default: auto-detected based on dev/build mode)
- `logLevel` (optional): Shared SQLsmith log level: `silent`, `error`, `warn`, `info`, or `debug` (default: `info`)
- `allowExternalReferences` (optional): Keep references to relations outside the input and emit diagnostics instead of failing

`silent` suppresses SQLsmith logs only; schema generation and Vite error
reporting remain active. The former `normal`/`verbose` aliases were removed in
favor of the shared core levels.

Runtime `SET search_path` statements are preserved but are not interpreted by
dependency analysis; configure `defaultSchema` to match the effective schema.

## Discovery and watch lifecycle

- Discovery is recursive and uses the same `MergePlan` pipeline as core.
- The input root and every discovered SQL file are registered with Vite.
- Create, update, and delete events trigger one full rediscovery and generation.
- A generated output inside the input directory is excluded from discovery and
  watching, preventing self-merge loops.
- Output is written atomically. Invalid SQL leaves the last valid output
  unchanged; production builds fail, while development reports through Vite.

## Features

- ✅ **File watching** - Recursive regeneration on create, update, and delete
- ✅ **Build integration** - Schema validation during build process  
- ✅ **Atomic output** - Invalid updates preserve the last valid schema
- ✅ **Error handling** - Build failures propagate; dev failures use Vite reporting
- ✅ **Zero config** - Works out of the box with sensible defaults

## License

MIT
