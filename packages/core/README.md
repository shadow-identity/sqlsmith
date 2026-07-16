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

// Parse, validate, build the graph, and compute the final order once
const plan = merger.planDirectory('./schemas', 'postgresql');

// Emit without repeating analysis
const merged = merger.merge(plan, {
  addComments: true,
  includeHeader: true,
  separateStatements: true
});

console.log(merged); // Merged SQL content
console.log(plan.diagnostics); // Structured external/raw diagnostics
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

Main class for SQL merging operations. `planDirectory` and `planFiles` return
a readonly `MergePlan` containing files, recognized statements, the dependency
graph, final statement order, and diagnostics. `merge(plan)` is pure emission.

The constructor accepts normal options plus optional narrow typed dependencies:

```ts
const merger = new SqlMerger(options, {
  fileParser,
  dependencyAnalyzer,
  topologicalSorter,
  fileMerger
})
```

`ServiceContainer` and the old parse/analyze/validate/merge convenience methods
were removed; callers render `MergePlan` data at their application boundary.

### Processors

- `CreateTableProcessor` - Handles CREATE TABLE statements
- `CreateSequenceProcessor` - Handles CREATE SEQUENCE statements  
- `CreateViewProcessor` - Handles CREATE VIEW statements

#### Processor interface

```ts
import type { AST } from 'node-sql-parser'
import type { SqlStatement } from './types/sql-statement'

export interface StatementProcessor {
  getHandledTypes(): string[]
  canProcess(statement: AST): boolean
  extractStatements(ast: AST | AST[], filePath: string): SqlStatement[]
}
```

Note: pre-release change — the `extractStatements` method no longer receives a `dialect` parameter. If you need dialect-specific behavior in a custom processor, pass it via the constructor or configuration when creating the processor.

### Extension points

Custom statement processors (`new SqlMerger({ processors: [...] })`) and
`Logger` remain public. Pipeline collaborators
are injected structurally through `SqlMergerDependencies`; concrete internal
analyzer/sorter/parser/emitter classes are not part of the package root API.

## License

MIT
