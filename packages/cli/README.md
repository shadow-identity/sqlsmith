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
- `--no-comments` - Disable file comments in output
- `--no-header` - Disable header comment in output
- `--quiet` - Reduce console output
- `--verbose` - Increase console output

## License

MIT 