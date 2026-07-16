# @sqlsmith/cli

Command-line interface for SQLsmith - SQL schema merging with dependency resolution.

## Installation

```bash
# Global installation
npm install -g @sqlsmith/cli

# Or use with npx
npx @sqlsmith/cli
```

## Usage

```bash
# Merge SQL files (to stdout by default)
sqlsmith ./schemas --output merged.sql

# Analyze dependencies
sqlsmith info ./schemas

# Validate files
sqlsmith validate ./schemas
```

## Commands

### Merge (default)
```bash
sqlsmith <input-directory> [options]
```

### Info
```bash
sqlsmith info <input-directory> [options]
```

### Validate  
```bash
sqlsmith validate <input-directory> [options]
```

## Options

- `-o, --output <path>` - Output file path (default: stdout)
- `-d, --dialect <dialect>` - SQL dialect from core's `SUPPORTED_DIALECTS` registry
- `--default-schema <schema>` - Schema assigned to unqualified names (PostgreSQL default: `public`)
- `--no-validate-source-order` - Skip validation that statements within a file are declared before their dependents
- `--allow-external-references` - Allow foreign keys referencing tables outside the input files
- `--log-level <level>` - Set log level: silent, error, warn, info, debug (default: info)

## Log Levels

The `--log-level` option controls the verbosity of console output:

- `silent` - Suppress all log output (merged SQL still goes to stdout, exit codes are preserved)
- `error` - Only show error messages
- `warn` - Show error and warning messages  
- `info` - Show error, warning, and info messages (default)
- `debug` - Show all messages including debug information

## Examples

```bash
# Merge SQL files to stdout with default settings
sqlsmith ./schemas

# Merge to a specific output file
sqlsmith ./schemas --output merged.sql

# Merge with minimal console output
sqlsmith ./schemas --log-level error --output merged.sql

# Analyze dependencies with debug information
sqlsmith info ./schemas --log-level debug

# Validate with only warnings and errors
sqlsmith validate ./schemas --log-level warn

# Use different SQL dialect
sqlsmith ./schemas --dialect mysql --output merged.sql

# Resolve unqualified PostgreSQL names in a tenant schema
sqlsmith ./schemas --default-schema tenant --output merged.sql
```

`SET search_path` is preserved in merged SQL but does not alter dependency
resolution; use `--default-schema` for the effective schema.

## License

MIT
