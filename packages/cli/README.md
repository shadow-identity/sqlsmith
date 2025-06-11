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
# Merge SQL files
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
- `-d, --dialect <dialect>` - SQL dialect: postgresql, mysql, sqlite, bigquery
- `--allow-reorder-drop-comments` - Allow reordering statements within files (drops comments)
- `--log-level <level>` - Set log level: error, warn, info, debug (default: info)

## Log Levels

The `--log-level` option controls the verbosity of console output:

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
```

## License

MIT 