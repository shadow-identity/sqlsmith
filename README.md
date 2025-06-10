# SQLsmith

A sophisticated tool for merging SQL files with automatic dependency resolution using AST parsing and topological sorting.

## Features

🔍 **Smart Table Dependency Detection** - Automatically analyzes FOREIGN KEY constraints in CREATE TABLE statements to understand table-to-table dependencies  
🔄 **Topological Sorting** - Uses Kahn's algorithm to determine safe execution order  
🛡️ **Circular Dependency Detection** - Prevents invalid schemas with clear error messages  
🚫 **Duplicate Table Validation** - Detects duplicate table names across multiple files  
📋 **Statement Order Validation** - Ensures CREATE TABLE statements within files follow dependency order  
📁 **File & Stdout Output** - Flexible output options for CI/CD and manual workflows  
🎛️ **Configurable Options** - Control comments, headers, formatting, and validation behavior  
🗃️ **Multi-Dialect Support** - PostgreSQL, MySQL, SQLite, and BigQuery  
⚡ **Fast & Reliable** - Built with TypeScript and comprehensive test coverage  

### **Scope & Focus**

SQLsmith is specifically designed for **SQL DDL statements** and focuses on:
- ✅ **Table creation dependencies** via FOREIGN KEY constraints
- ✅ **Table-to-table relationships** and reference chains
- ✅ **Composite foreign keys** and complex table structures
- ✅ **Self-referencing tables** (hierarchical structures)
- ✅ **Sequences** (CREATE SEQUENCE statements that tables depend on)
- ✅ **Views** (CREATE VIEW statements that depend on tables/other views)
- ✅ **Mixed scenarios** combining tables, sequences, and views

**Not currently supported:**
- ❌ User-defined types (ENUM, DOMAIN, composite types)
- ❌ Functions and stored procedures
- ❌ Triggers and trigger functions
- ❌ Materialized views  
- ❌ Table inheritance or partitioning dependencies
- ❌ Extensions and extension objects
- ❌ Row Level Security policies
- ❌ Indexes (they don't affect DDL creation order dependencies)

This focused approach ensures reliable, fast processing of the most common schema migration scenario: **creating tables in the correct dependency order**.

## Installation

### Via npm (Recommended)

```bash
# Install globally for CLI usage
npm install -g sqlsmith

# Or install locally in your project
npm install sqlsmith

# Using pnpm
pnpm add sqlsmith

# Using yarn
yarn add sqlsmith
```

### From Source

```bash
# Clone the repository
git clone https://github.com/shadow-identity/sqlsmith.git
cd sqlsmith

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run CLI directly
node dist/cli.js --help

# Or install globally (optional)
npm link
sqlsmith --help
```

## Quick Start

```bash
# After global installation
sqlsmith ./sql-schemas

# Save merged output to a file
sqlsmith ./sql-schemas --output merged.sql

# Analyze dependencies without merging
sqlsmith info ./sql-schemas

# Validate SQL files and check for circular dependencies
sqlsmith validate ./sql-schemas

# If installed locally or running from source
node dist/cli.js ./sql-schemas
```

## CLI Usage

### Main Command (Merge)

```bash
sqlsmith <input-directory> [options]
```

**Arguments:**
- `<input-directory>` - Directory containing SQL files to merge

**Options:**
- `-o, --output <path>` - Output file path (default: stdout)
- `-d, --dialect <dialect>` - SQL dialect: postgresql, mysql, sqlite, bigquery (default: postgresql)
- `--no-comments` - Disable file comments in output
- `--no-header` - Disable header comment in output  
- `--no-separate` - Disable statement separation
- `--allow-reorder-drop-comments` - Allow statement reordering within files (bypasses intra-file validation)
- `--quiet` - Reduce console output
- `--verbose` - Increase console output for debugging

**Examples:**
```bash
# Basic merge to stdout
sqlsmith ./schemas

# Merge with file output
sqlsmith ./schemas --output combined.sql

# MySQL dialect with minimal output
sqlsmith ./schemas --dialect mysql --no-comments --no-header

# Quiet mode for CI/CD
sqlsmith ./schemas --quiet --output production.sql

# Allow statement reordering for files with mixed dependencies
sqlsmith ./legacy-schemas --allow-reorder-drop-comments --output fixed.sql
```

### Info Command

Analyze dependencies without merging files.

```bash
sqlsmith info <input-directory> [options]
```

**Options:**
- `-d, --dialect <dialect>` - SQL dialect (default: postgresql)  
- `--quiet` - Reduce console output

**Example:**
```bash
sqlsmith info ./schemas
```

**Output:**
```
🔍 SQL Dependency Analyzer
==================================================
✅ Analysis complete - no circular dependencies detected
📊 Found 3 SQL files with valid dependencies

📋 Recommended execution order:
  1. users.sql - users (no dependencies)
  2. posts.sql - posts (depends on: users)  
  3. comments.sql - comments (depends on: posts)
```

### Validate Command

Check SQL syntax and dependencies without merging.

```bash
sqlsmith validate <input-directory> [options]
```

**Options:**
- `-d, --dialect <dialect>` - SQL dialect (default: postgresql)
- `--quiet` - Reduce console output

**Example:**
```bash
sqlsmith validate ./schemas
```

**Output:**
```
✅ SQL Validator
==================================================
📁 Found 3 SQL files to validate

✅ users.sql - users
✅ posts.sql - posts  
✅ comments.sql - comments

✅ All 3 SQL files are valid
✅ No circular dependencies detected
✅ Ready for merging
```

## Programmatic API

You can also use SQLsmith programmatically in your Node.js applications:

```typescript
import { SqlMerger } from 'sqlsmith';

const merger = new SqlMerger();

// Parse SQL files from directory
const sqlFiles = merger.parseSqlFile('./schemas', 'postgresql');

// Merge files with options
const merged = merger.mergeFiles(sqlFiles, {
  addComments: true,
  includeHeader: true,
  separateStatements: true,
  outputPath: 'merged.sql' // Optional: write to file
});

console.log(merged); // Merged SQL content
```

## Examples

### Basic Directory Structure

```
schemas/
├── users.sql          # No dependencies
├── posts.sql          # Depends on users
└── comments.sql       # Depends on posts
```

**Input Files:**

`users.sql`:
```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(255) UNIQUE
);
```

`posts.sql`:
```sql
CREATE TABLE posts (
    id INT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

`comments.sql`:
```sql
CREATE TABLE comments (
    id INT PRIMARY KEY,
    post_id INT,
    content TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
```

**Command:**
```bash
sqlsmith schemas --output combined.sql
```

**Output (`combined.sql`):**
```sql
-- SQL Merger Output
-- Generated: 2025-06-06T16:30:00.000Z
-- Files merged: 3
-- Order: users.sql → posts.sql → comments.sql

-- ================================================================
-- File: users.sql (no dependencies)
-- ================================================================
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(255) UNIQUE
);

-- ================================================================
-- File: posts.sql (depends on: users)
-- ================================================================
CREATE TABLE posts (
    id INT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ================================================================
-- File: comments.sql (depends on: posts)
-- ================================================================
CREATE TABLE comments (
    id INT PRIMARY KEY,
    post_id INT,
    content TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
```

### CI/CD Integration

```bash
# In your build pipeline
sqlsmith ./database/schemas --quiet --output deploy/schema.sql

# Validate before deployment
sqlsmith validate ./database/schemas --quiet
if [ $? -eq 0 ]; then
    echo "✅ Schema validation passed"
    psql -f deploy/schema.sql
else
    echo "❌ Schema validation failed"
    exit 1
fi
```

### Pipe to Database

```bash
# Direct execution
sqlsmith ./schemas --quiet --no-header --no-comments | psql mydb

# Or save and execute
sqlsmith ./schemas --output schema.sql
psql mydb -f schema.sql
```

## Advanced Features

### File-Level Validation

SQL Merger performs several validation checks to ensure schema integrity:

**Duplicate Table Detection:**
- Scans all files for table name conflicts
- Prevents schema execution errors
- Works across all SQL dialects

**Statement Order Validation:**
- Ensures CREATE TABLE statements within individual files follow dependency order
- Catches incorrect ordering that could cause execution failures
- Can be bypassed with `--allow-reorder-drop-comments` for legacy schemas

**Circular Dependency Detection:**
- Uses DFS algorithm to detect impossible dependency chains
- Distinguishes between circular dependencies and valid self-references
- Provides clear error messages with the circular path

### Self-Referencing Tables

SQL Merger correctly handles hierarchical structures:

```sql
-- employees.sql - Valid self-reference
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    manager_id INT,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);
```

This is **not** considered a circular dependency since it's a valid hierarchical structure.

### Legacy Schema Support

For legacy schemas with mixed statement ordering:

```bash
# Bypass intra-file validation for problematic files
sqlsmith ./legacy-schemas --allow-reorder-drop-comments

# Note: This may drop comments during reordering
```

## Error Handling

### Circular Dependencies
```bash
$ sqlsmith ./bad-schemas
❌ Error: Circular dependencies detected: users → posts → comments → users
```

### Duplicate Table Names
```bash
$ sqlsmith ./bad-schemas
❌ Error: Duplicate table names detected across multiple files:
  • "users" defined in: users1.sql, users2.sql

Each table should only be defined once across all files in the directory.
```

### Incorrect Statement Order Within Files
```bash
$ sqlsmith ./bad-schemas
❌ Error: File ./schemas/mixed.sql contains CREATE TABLE statements in incorrect dependency order.
Please reorder statements so dependencies come before dependents.
Current order: orders → customers
Required order: customers → orders
```

### Invalid SQL Syntax
```bash
$ sqlsmith validate ./bad-schemas
❌ posts.sql: Failed to parse SQL: syntax error at line 3
```

### Missing Files
```bash
$ sqlsmith ./nonexistent
❌ Error: Input directory does not exist: ./nonexistent
```

## Supported SQL Dialects

- **PostgreSQL** (default) - Full FOREIGN KEY constraint support
- **MySQL** - Supports FOREIGN KEY and REFERENCES syntax  
- **SQLite** - Basic FOREIGN KEY support
- **BigQuery** - Limited constraint support

## Configuration Options

### Merge Options

| Option | Default | Description |
|--------|---------|-------------|
| `addComments` | `true` | Include file and dependency comments |
| `includeHeader` | `true` | Include generation timestamp and file list |
| `separateStatements` | `true` | Add blank lines between files |
| `outputPath` | `undefined` | File path for output (default: stdout) |

### Output Formats

**Full Output (default):**
- Header with timestamp and file order
- File comments with dependencies  
- Original formatting preserved
- Statement separation

**Minimal Output (`--no-header --no-comments --no-separate`):**
- Just the SQL statements
- Perfect for direct database execution
- Minimal file size

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode  
pnpm test:watch

# Build TypeScript
pnpm build

# Development with auto-reload
pnpm dev ./test/fixtures/correct
```

## Testing

The project includes comprehensive test coverage:

- **79 tests** covering all functionality
- **Unit tests** for SQL parsing, dependency extraction, and topological sorting
- **Integration tests** for end-to-end workflows including error scenarios
- **CLI tests** for command-line interface
- **Fixture-based testing** with realistic SQL scenarios
- **Validation tests** for duplicate tables, circular dependencies, and statement ordering

```bash
# Run all tests
pnpm test

# Specific test file
pnpm test sql-merger.test.ts

# CLI tests only
pnpm test cli.test.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`pnpm test`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Architecture

- **AST Parsing**: Uses `node-sql-parser` for robust SQL analysis
- **Dependency Graph**: Builds directed graph of table relationships  
- **Topological Sort**: Kahn's algorithm for dependency resolution
- **Validation Engine**: Multi-layered validation for schema integrity
- **File I/O**: Node.js fs APIs with cross-platform support
- **CLI**: Commander.js for argument parsing and help generation
- **Testing**: Vitest with fixture-based scenarios

---

Built with ❤️ using TypeScript, Node.js, and modern development practices.