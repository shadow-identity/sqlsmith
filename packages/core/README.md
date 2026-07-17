# @sqlsmith/core

Core SQL schema merging engine with dependency resolution.

## Installation

```bash
npm install @sqlsmith/core
```

## Usage

```typescript
import { SqlMerger } from '@sqlsmith/core';

const merger = new SqlMerger({ defaultSchema: 'public' });

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

PostgreSQL relations use canonical `(schema, name)` identity. Unquoted parts
fold to lowercase, quoted parts retain exact case, and unqualified names use
`defaultSchema` (`public` by default). Runtime `SET search_path` statements are
passed through as SQL but are not interpreted; configure `defaultSchema`
explicitly when the effective schema differs.

## Features

- ✅ **Smart dependency detection** - Analyzes FOREIGN KEY constraints
- ✅ **Topological sorting** - Safe execution order using Kahn's algorithm
- ✅ **Circular dependency detection** - Prevents invalid schemas
- ✅ **Verified multi-dialect support** - PostgreSQL, SQLite, MySQL
- ✅ **Sequences & Views** - Handles views in every dialect and PostgreSQL sequences
- ✅ **Indexes & Alters** - `CREATE INDEX` and `ALTER TABLE` join the dependency
  graph: an index orders after its table, an alter after every table it
  references (including `ADD FOREIGN KEY` targets). Opt out with
  `enableIndexes: false` / `enableAlters: false`.
- ✅ **TypeScript support** - Full type safety and IntelliSense

### Diagnostics

`plan.diagnostics` carries structured diagnostics, each with a `severity`:

| Code | Severity | Meaning |
| --- | --- | --- |
| `EXTERNAL_REFERENCE` | `warning` | A dependency is not defined in the input set (`allowExternalReferences`) |
| `RAW_STATEMENTS` | `info` | Unrecognized statements are carried through verbatim |
| `RAW_ONLY_FILE` | `warning` | A file with no recognized statements is appended at the end |
| `RAW_CROSS_FILE_REFERENCE` | `warning` | A raw statement references a relation defined in a different file; its relative order is not guaranteed |

### Dialect capabilities

`SUPPORTED_DIALECTS` and `DIALECT_CAPABILITIES` are the authoritative runtime
registry. A dialect appears here only when its dependency contracts have
executable fixtures.

<!-- dialect-capabilities:start -->
| Dialect | Identifier quotes | Case folding used for graph identity | Default namespace | CREATE TABLE | Foreign keys | Views | Sequences |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `postgresql` | `"name"` | Unquoted → lowercase; quoted preserved | `public` | Yes | Yes | Yes | `CREATE SEQUENCE` |
| `sqlite` | `"name"`, `` `name` `` | Case-insensitive | `main` | Yes | Yes | Yes | None |
| `mysql` | `` `name` `` | Preserved by SQLsmith; server behavior is configuration-dependent | Current database (implicit) | Yes | Yes | Yes | None |
<!-- dialect-capabilities:end -->

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

### View dependencies

View analysis walks JOINs, derived tables, scalar/EXISTS subqueries, CTE
bodies, recursive CTEs, and set-operation branches. CTE aliases are scoped and
never become external relation dependencies; repeated underlying relations are
deduplicated by `RelationKey`.

`collectSelectRelations` is exported for custom processors. It returns both a
key set and identifier metadata. Unknown relation-bearing SELECT/FROM shapes
throw a typed `ProcessingError(PROCESSOR_ERROR)` instead of silently omitting a
dependency.

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
  extractStatements(
    ast: AST | AST[],
    filePath: string,
    context?: StatementProcessorContext
  ): SqlStatement[]
}
```

The optional context provides the original source chunk, dialect, identifier
rules, lexed relation-name tokens, and quote-aware CTE aliases. Existing
two-argument custom processors remain structurally compatible.

### Extension points

Custom statement processors (`new SqlMerger({ processors: [...] })`) and
`Logger` remain public. Pipeline collaborators
are injected structurally through `SqlMergerDependencies`; concrete internal
analyzer/sorter/parser/emitter classes are not part of the package root API.

## License

MIT
