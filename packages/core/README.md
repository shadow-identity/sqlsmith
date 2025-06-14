# @sqlsmith/core

Core SQL schema merging engine with dependency resolution.

## Installation

```bash
npm install @sqlsmith/core
```

## Usage

```typescript
import { SqlMerger } from '@sqlsmith/core';

const merger = new SqlMerger();

// Parse SQL files from directory
const sqlFiles = merger.parseSqlFiles('./schemas', 'postgresql');

// Merge files with options
const merged = merger.mergeFiles(sqlFiles, {
  addComments: true,
  includeHeader: true,
  separateStatements: true,
  outputPath: 'merged.sql' // Optional: write to file
});

console.log(merged); // Merged SQL content
```

## Features

- ✅ **Smart dependency detection** - Analyzes FOREIGN KEY constraints
- ✅ **Topological sorting** - Safe execution order using Kahn's algorithm
- ✅ **Circular dependency detection** - Prevents invalid schemas
- ✅ **Multi-dialect support** - PostgreSQL, MySQL, SQLite, BigQuery
- ✅ **Sequences & Views** - Handles CREATE SEQUENCE and CREATE VIEW statements
- ✅ **TypeScript support** - Full type safety and IntelliSense

## API

### SqlMerger

Main class for SQL merging operations.

### Processors

- `CreateTableProcessor` - Handles CREATE TABLE statements
- `CreateSequenceProcessor` - Handles CREATE SEQUENCE statements  
- `CreateViewProcessor` - Handles CREATE VIEW statements

### Services

- `DependencyAnalyzer` - Analyzes statement dependencies
- `TopologicalSorter` - Sorts statements by dependencies
- `SqlFileParser` - Parses SQL files and extracts statements

## License

MIT 