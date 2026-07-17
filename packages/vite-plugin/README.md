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
- `dialect` (optional): SQL dialect from core's `SUPPORTED_DIALECTS` registry (default: `postgresql`)
- `defaultSchema` (optional): Schema assigned to unqualified relation names (PostgreSQL default: `public`)
- `watch` (optional): Enable file watching (default: auto-detected based on dev/build mode)
- `logLevel` (optional): Shared SQLsmith log level: `silent`, `error`, `warn`, `info`, or `debug` (default: `info`)
- `allowExternalReferences` (optional): Keep references to relations outside the input and emit diagnostics instead of failing

`silent` suppresses SQLsmith logs only; schema generation and Vite error
reporting remain active. The former `normal`/`verbose` aliases were removed in
favor of the shared core levels.

## Debug output and warning deduplication

At `logLevel: 'debug'` every generation additionally reports the discovered
SQL files, the dependency graph and the recommended execution order — the
same renderers the CLI `info` command uses.

At `warn` and `info`, diagnostics (external references, raw passthrough
statements, cross-file raw references) are deduplicated across watch rebuilds:

- the first build prints every diagnostic in full;
- subsequent rebuilds print only new or changed diagnostics and collapse the
  rest into a single line: `SQLsmith: N known warning(s) — set logLevel:
  'debug' to see all`;
- a diagnostic that disappears and later returns is printed in full again;
- a failed rebuild keeps the known set of the last successful generation,
  matching the preserved last-good output;
- `debug` disables deduplication and always prints everything.

The known set lives in plugin memory, so restarting the dev server prints all
diagnostics in full again.

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
