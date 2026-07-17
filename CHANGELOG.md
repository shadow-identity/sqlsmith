# Changelog

All notable user-visible changes to SQLsmith are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — 2026-07-17

`CREATE INDEX` and `ALTER TABLE` become first-class, dependency-ordered
statements, and raw-passthrough diagnostics gain severities. Published as one
coordinated release of `@sqlsmith/core`, `@sqlsmith/cli` and
`@sqlsmith/vite-plugin` 0.6.0.

### Breaking changes

- **`CREATE INDEX` and `ALTER TABLE` are now first-class statements.** They
  join the dependency graph and topological sort: an index is emitted after
  the table it targets, an alter after the altered table and after every table
  an added FOREIGN KEY references — across files. Consequences:
  - A missing target table now fails with `MISSING_DEPENDENCY` (previously the
    statement passed through verbatim). Escape hatches: `allowExternalReferences: true`
    turns it into an `EXTERNAL_REFERENCE` diagnostic, or disable recognition
    entirely with the new `enableIndexes: false` / `enableAlters: false` options.
  - An `ALTER TABLE`/`CREATE INDEX` placed before its table in the same file is
    now rejected by source-order validation (like FK order for tables).
  - These statements no longer trigger the `RAW_STATEMENTS` diagnostic.
  - Not covered (still raw): `ALTER SEQUENCE`, `ALTER INDEX`; `RENAME TO` is
    ordered after the original table without propagating the new name.
  - Dependencies stay relation-level: a cross-file index or view on a column
    added by `ALTER TABLE` is ordered after the table, not after the alter —
    keep such statements after the alter in the same file.
- **`MergeDiagnostic` gained a required `severity` field** (`'info' | 'warning'`)
  and a new code, `RAW_CROSS_FILE_REFERENCE`. Consumers with an exhaustive
  `switch` over `diagnostic.code` must handle the new variant.
- **`RAW_STATEMENTS` is now informational** (rendered at `info` level, no `⚠️`).
  A warning is reserved for the genuinely order-risky cases: `RAW_ONLY_FILE`
  and the new `RAW_CROSS_FILE_REFERENCE` — a raw statement referencing a
  relation defined in a *different* file (raw statements only preserve
  in-file order).

### Added

- `CreateIndexProcessor` and `AlterTableProcessor` (all dialects: postgresql,
  sqlite, mysql), with `enableIndexes` / `enableAlters` options (default `true`).
- `IdentifierNamespace` (`'relation' | 'index' | 'statement'`) and
  `createSecondaryIdentifier()`: index names live in their own namespace keyed
  by target table (MySQL scopes index names per table), alters and unnamed
  indexes get per-statement synthetic identities.
- Raw statements now expose `referencedRelations` — relations they lexically
  mention (used for cross-file diagnostics; never fed into the graph).
- The identifier lexer recognizes `CREATE [UNIQUE] INDEX … ON`, `ALTER TABLE`
  and `INSERT INTO` positions (new reference kinds `on`, `alter`, `into`).
- The Vite plugin deduplicates `RAW_CROSS_FILE_REFERENCE` diagnostics across
  watch rebuilds by statement and referenced relation.

## [0.5.0] — 2026-07-16

A major overhaul of the core pipeline, CLI and Vite plugin. Published as one
coordinated release of `@sqlsmith/core`, `@sqlsmith/cli` and
`@sqlsmith/vite-plugin` 0.5.0.

### Breaking changes

#### Runtime

- Node.js >= 24 is now required by all packages. Node 20 reached end of life
  in April 2026, and the workspace toolchain (pnpm 11) requires Node >= 22.13.

#### Core API

- The merge pipeline now uses one reusable `MergePlan`:
  `planDirectory()` performs discovery, parsing, validation and ordering;
  `planFiles()` validates and orders already parsed files; `merge(plan)` only
  renders the resulting SQL.
- Removed the old `parseSqlFiles()`, `mergeFiles()`, `analyzeDependencies()` and
  `validateFiles()` convenience methods.
- Removed `ServiceContainer`, `ServiceConfiguration`, `withContainer()` and
  `getContainer()`. Optional pipeline collaborators are now passed through the
  typed second constructor argument of `SqlMerger`.
- `SqlFileMerger`, `SqlFileParser`, `DependencyAnalyzer` and
  `TopologicalSorter` are no longer exported from the package root. Custom
  statement processors and `Logger` remain supported extension points.
- `merge()` and the underlying emitter no longer write files or stdout.
  `MergeOptions.outputPath` was removed; applications must write the returned
  string themselves.
- `SqlMergerOptions.allowReorderDropComments` was replaced by
  `validateSourceOrder`. The corresponding CLI flag is now
  `--no-validate-source-order`.
- Missing foreign-key targets now fail by default with `MISSING_DEPENDENCY`.
  Use `allowExternalReferences` to keep intentional external references as
  diagnostics instead.
- `IdentifierRules` and `createIdentifierRules()` were replaced by
  `DialectRules` and `createDialectRules()`.
- `bigquery` was removed from `SqlDialect`. The verified public dialects are
  now `postgresql`, `sqlite` and `mysql`.

#### CLI

- All human-readable logs and errors now go to stderr. Successful merge output
  on stdout contains SQL only, so `sqlsmith schemas > merged.sql` is safe.
- `--allow-reorder-drop-comments` was removed; use
  `--no-validate-source-order`.
- Exit codes now have stable categories:
  `1` syntax/processing/internal, `2` filesystem, `3` dependency/order and
  `4` configuration errors.

#### Vite plugin

- `logLevel` now accepts `silent`, `error`, `warn`, `info` or `debug`.
  The `normal` and `verbose` aliases were removed.
- `dialect` now uses the core `SqlDialect` type and therefore no longer accepts
  `bigquery`.

### Added

- Statement-level dependency ordering across files. Statements from one file
  can now be interleaved with statements from another file when required by
  their dependencies.
- Lossless passthrough for parsed but unsupported statements such as
  `CREATE INDEX`, `ALTER TABLE` and `INSERT`. They remain next to their source
  statement and produce structured diagnostics.
- `--allow-external-references` and `allowExternalReferences` for the CLI,
  core and Vite plugin.
- Schema-aware relation identity and `defaultSchema` support in the core, CLI
  and Vite plugin. PostgreSQL defaults unqualified relations to `public`.
- Public `SUPPORTED_DIALECTS` and `DIALECT_CAPABILITIES` registries describing
  identifier quoting, case handling, default namespaces, tables, foreign keys,
  views and sequence support.
- The CLI accepts `--log-level silent`: logs are fully suppressed while merged
  SQL still goes to stdout and exit codes are preserved.
- Vite plugin `logLevel: 'debug'` renders the discovered SQL files, the
  dependency graph and the recommended execution order on every generation.
- Merge-plan renderers (`renderDiagnostics`, `renderDependencyGraph`,
  `renderRecommendedOrder`, `renderValidationSummary`, `renderDiscoveredFiles`)
  and `Logger.isLevelEnabled` are exported from `@sqlsmith/core`; the CLI and
  the Vite plugin share one presentation implementation.
- Structured `MergePlan` diagnostics and typed error context including paths,
  statement lines, dependency keys and original causes.
- Vite 6 support in addition to Vite 4 and 5.

### Changed

- Merged output is emitted as per-statement blocks rather than whole-file
  blocks. Generated source comments now identify each statement, and leading
  source comments move with their statement when it is reordered.
- PostgreSQL identifiers now follow database semantics: unquoted parts fold to
  lowercase, quoted parts preserve case, and schema/name pairs form relation
  identity. Tables, views and sequences share one relation namespace.
- SQLite relation identity is case-insensitive and uses `main` as the default
  namespace. MySQL identifiers preserve source case; actual server
  case-sensitivity remains configuration-dependent.
- View dependency analysis now includes joins, derived tables, scalar and
  `EXISTS` subqueries, CTE bodies, recursive CTEs, set-operation branches and
  view-to-view dependencies.
- Core no longer prints progress, dependency graphs or exceptions. CLI and
  plugin boundaries own presentation and log each failure once.
- Vite discovery is recursive and uses the same planning behavior as the core.
  The input root and discovered SQL files are registered with Vite, while a
  generated output located under the input directory is excluded.
- Vite create, update and delete events trigger full rediscovery. Output writes
  are atomic; failed development regeneration preserves the last valid output,
  while production build failures are propagated.
- Vite `silent` mode suppresses SQLsmith logs but still generates output and
  reports failures through Vite.
- Vite watch rebuilds print only new or changed diagnostics; known ones
  collapse into a single `SQLsmith: N known warning(s)` line. The first build
  prints everything, a failed rebuild keeps the last successful set, and
  `debug` disables the deduplication.

### Fixed

- Corrected invalid ordering when dependencies interleave across files.
- `CREATE VIEW` statements, including files containing only views, are no
  longer silently omitted.
- Table-level foreign-key dependencies are no longer reported twice.
- PostgreSQL `GENERATED ... AS IDENTITY` normalization is parse-only; the
  original clause remains in emitted SQL.
- Vite no longer treats sibling paths sharing the input prefix as children and
  no longer reprocesses its own generated output.

### Migration guide

#### Core pipeline

```ts
import { writeFile } from 'node:fs/promises'

// Before
const files = merger.parseSqlFiles('./schemas', 'postgresql')
const sql = merger.mergeFiles(files, { outputPath: './merged.sql' })

// Unreleased
const plan = merger.planDirectory('./schemas', 'postgresql')
const sql = merger.merge(plan)
await writeFile('./merged.sql', sql)
```

Use `plan.files`, `plan.graph`, `plan.orderedStatements` and
`plan.diagnostics` to implement custom info or validation presentation.

#### Source-order and external-reference options

```ts
const merger = new SqlMerger({
  validateSourceOrder: false,
  allowExternalReferences: true,
  defaultSchema: 'tenant'
})
```

Equivalent CLI options are `--no-validate-source-order`,
`--allow-external-references` and `--default-schema tenant`.

#### Vite plugin logging

Replace `logLevel: 'normal'` with `logLevel: 'info'`, and replace
`logLevel: 'verbose'` with `logLevel: 'debug'`.

### Known limitations

- `SET search_path` is preserved in output but is not interpreted during
  dependency analysis; configure `defaultSchema` explicitly.
- `CREATE SEQUENCE` is supported only for PostgreSQL. SQLite and MySQL expose
  no sequence semantics in the capability registry.
- BigQuery remains unsupported until foreign-key parsing and lossless
  `project.dataset.table` identity are implemented.
