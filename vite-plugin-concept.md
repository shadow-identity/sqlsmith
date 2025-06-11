# SQLsmith Vite Plugin Concept

## Package Structure

```
@sqlsmith/vite-plugin/
├── src/
│   ├── index.ts          # Main plugin export
│   ├── plugin.ts         # Vite plugin implementation  
│   ├── watcher.ts        # File watching logic
│   └── types.ts          # Plugin-specific types
├── package.json
├── README.md
└── tsconfig.json
```

## Plugin API Design

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { sqlsmith } from '@sqlsmith/vite-plugin'

export default defineConfig({
  plugins: [
    sqlsmith({
      // Required
      input: './src/schemas',           // SQL files directory
      output: './src/generated/schema.sql', // Output file
      
      // Optional
      dialect: 'postgresql',           // SQL dialect
      watch: true,                     // Enable file watching (default: true in dev)
      includeComments: true,           // Add file comments (default: true)
      includeHeader: true,             // Add generation header (default: true)
      
      // Advanced options
      allowReorderDropComments: false, // Allow statement reordering
      onSuccess: (outputPath) => {     // Success callback
        console.log(`✅ Schema updated: ${outputPath}`)
      },
      onError: (error) => {            // Error callback
        console.error('❌ Schema merge failed:', error)
      }
    })
  ]
})
```

## Plugin Features

### 1. **Development Mode**
- File watching with automatic regeneration
- HMR integration (triggers reload when schema changes)
- Error overlay integration with Vite's error handling

### 2. **Build Mode** 
- One-time generation during build
- Validates schema before build completion
- Integration with build pipeline

### 3. **Error Handling**
- Pretty error display in Vite's dev server
- Detailed error messages with file locations
- Non-blocking errors (dev server continues running)

## Implementation Details

```typescript
// src/plugin.ts
import type { Plugin } from 'vite'
import { SqlMerger } from 'sqlsmith'
import { watch } from 'chokidar'
import { resolve, relative } from 'path'

export interface SqlsmithPluginOptions {
  input: string
  output: string
  dialect?: 'postgresql' | 'mysql' | 'sqlite' | 'bigquery'
  watch?: boolean
  includeComments?: boolean
  includeHeader?: boolean
  allowReorderDropComments?: boolean
  onSuccess?: (outputPath: string) => void
  onError?: (error: Error) => void
}

export function sqlsmith(options: SqlsmithPluginOptions): Plugin {
  const merger = new SqlMerger()
  let watcher: any
  
  return {
    name: 'sqlsmith',
    
    configResolved(config) {
      // Adjust options based on Vite config
      if (options.watch === undefined) {
        options.watch = config.command === 'serve'
      }
    },
    
    buildStart() {
      // Initial merge
      generateSchema()
      
      // Set up watching in dev mode
      if (options.watch) {
        setupWatcher()
      }
    },
    
    buildEnd() {
      // Clean up watcher
      if (watcher) {
        watcher.close()
      }
    }
  }
  
  async function generateSchema() {
    try {
      const sqlFiles = merger.findSqlFiles(options.input)
      const parsed = sqlFiles.map(file => merger.parseSqlFiles(file, options.dialect))
      
      const merged = merger.mergeFiles(parsed, {
        addComments: options.includeComments ?? true,
        includeHeader: options.includeHeader ?? true,
        outputPath: options.output
      })
      
      options.onSuccess?.(options.output)
      
    } catch (error) {
      options.onError?.(error as Error)
      // In dev mode, don't throw - just log the error
      if (options.watch) {
        console.error('SQLsmith merge failed:', error)
      } else {
        throw error
      }
    }
  }
  
  function setupWatcher() {
    watcher = watch(options.input + '/**/*.sql', {
      ignoreInitial: true
    })
    
    watcher.on('change', generateSchema)
    watcher.on('add', generateSchema)
    watcher.on('unlink', generateSchema)
  }
}
```

## Package.json for @sqlsmith/vite-plugin

```json
{
  "name": "@sqlsmith/vite-plugin",
  "version": "1.0.0",
  "description": "Vite plugin for SQLsmith - automatic SQL schema merging",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist/**/*",
    "README.md"
  ],
  "keywords": [
    "vite",
    "plugin", 
    "sql",
    "schema",
    "merge",
    "sqlsmith"
  ],
  "peerDependencies": {
    "vite": "^4.0.0 || ^5.0.0"
  },
  "dependencies": {
    "sqlsmith": "^2.0.0",
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

## Usage Examples

### 1. **Basic Setup**
```typescript
// vite.config.ts
import { sqlsmith } from '@sqlsmith/vite-plugin'

export default defineConfig({
  plugins: [
    sqlsmith({
      input: './database/schemas',
      output: './src/database/schema.sql'
    })
  ]
})
```

### 2. **Advanced Configuration**
```typescript
// vite.config.ts with custom callbacks
export default defineConfig({
  plugins: [
    sqlsmith({
      input: './sql',
      output: './generated/schema.sql',
      dialect: 'postgresql',
      onSuccess: (path) => {
        // Trigger additional processing
        console.log(`Schema updated at ${path}`)
      },
      onError: (error) => {
        // Custom error handling
        console.error('Schema merge failed:', error.message)
      }
    })
  ]
})
```

### 3. **Multiple Environments**
```typescript
// Different configs for different modes
export default defineConfig(({ mode }) => ({
  plugins: [
    sqlsmith({
      input: './schemas',
      output: mode === 'production' 
        ? './dist/schema.sql' 
        : './dev/schema.sql',
      includeComments: mode !== 'production'
    })
  ]
}))
```

## Benefits

1. **Zero Config** - Works out of the box with sensible defaults
2. **File Watching** - Automatic regeneration during development  
3. **HMR Integration** - Triggers reloads when schema changes
4. **Error Handling** - Beautiful error display in Vite dev server
5. **Build Integration** - Validates schema as part of build process
6. **TypeScript Support** - Full type safety and IntelliSense 