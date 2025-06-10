# @sqlsmith/vite-plugin

Vite plugin for SQLsmith - automatic SQL schema merging during development.

## Installation

```bash
npm install -D @sqlsmith/vite-plugin
```

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
      dialect: 'postgresql'       // Optional: SQL dialect
    })
  ]
})
```

## Options

- `input` (required): Directory containing SQL files
- `output` (required): Output file path for merged schema
- `dialect` (optional): SQL dialect - `postgresql`, `mysql`, `sqlite`, `bigquery` (default: `postgresql`)
- `watch` (optional): Enable file watching (default: auto-detected based on dev/build mode)

## Features

- ✅ **File watching** - Automatic regeneration when SQL files change
- ✅ **Build integration** - Schema validation during build process  
- ✅ **Error handling** - Non-blocking errors in dev mode
- ✅ **Zero config** - Works out of the box with sensible defaults

## License

MIT 