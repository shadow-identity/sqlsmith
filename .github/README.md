# CI/CD Setup

This repository uses GitHub Actions for continuous integration and deployment. Here's an overview of the workflows and how to use them.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Trigger**: Push to `main`/`develop` branches, pull requests

**What it does**:
- Runs tests on Node.js 20 and 24
- Lints code with Biome
- Builds all packages
- Runs security audit

**Status**: Runs on every push and PR to ensure code quality.

### 2. Release Workflow (`.github/workflows/release.yml`)

**Trigger**: Push to `main` branch with changes to any `package.json` file

**What it does**:
- Detects which packages have version changes
- Runs full test suite
- Publishes changed packages to NPM
- Creates GitHub release with version info

**Key Features**:
- Only publishes packages that have version changes
- Handles dependency order (core → cli/vite-plugin)
- Creates GitHub releases automatically

### 3. Dependency Updates (`.github/workflows/dependency-update.yml`)

**Trigger**: Weekly schedule (Mondays 9 AM UTC) or manual trigger

**What it does**:
- Updates all dependencies to latest versions
- Runs tests to ensure compatibility
- Creates PR with dependency updates

## Required Secrets

Add these secrets to your GitHub repository settings:

1. **NPM_TOKEN**: Your NPM authentication token
   - Go to npmjs.com → Access Tokens → Generate New Token
   - Choose "Automation" type
   - Add to GitHub repo secrets

2. **GITHUB_TOKEN**: Automatically provided by GitHub
   - Used for creating releases and PRs
   - No setup required

## Publishing Workflow

### Method 1: Using Version Bump Scripts (Recommended)

1. **Bump version**:
   ```bash
   # Patch version (0.2.0 → 0.2.1)
   pnpm version:patch
   
   # Minor version (0.2.0 → 0.3.0)  
   pnpm version:minor
   
   # Major version (0.2.0 → 1.0.0)
   pnpm version:major
   ```

2. **Review and commit**:
   ```bash
   git add -A
   git commit -m "chore: bump version to 0.2.1"
   ```

3. **Push to trigger release**:
   ```bash
   git push origin main
   ```

### Method 2: Manual Version Changes

1. **Edit package.json files manually**:
   - `packages/core/package.json`
   - `packages/cli/package.json`
   - `packages/vite-plugin/package.json`
   - Root `package.json`

2. **Commit and push**:
   ```bash
   git add -A
   git commit -m "chore: bump version to 0.2.1"
   git push origin main
   ```

## Version Strategy

**Answer to your question**: Yes, new versions are triggered by **explicit version changes in package.json files**. Here's how it works:

- The release workflow monitors changes to `packages/*/package.json`
- When you push a commit that changes any package version, it triggers the release
- Only packages with version changes get published
- This gives you full control over when and what gets published

### Recommended Versioning

- **Patch** (`0.2.0` → `0.2.1`): Bug fixes, small improvements
- **Minor** (`0.2.0` → `0.3.0`): New features, non-breaking changes  
- **Major** (`0.2.0` → `1.0.0`): Breaking changes, major rewrites

### Monorepo Versioning

Currently all packages share the same version number, which simplifies:
- Dependency management between packages
- Release coordination
- User understanding

If you want independent versioning later, you can modify the scripts and workflows.

## Node.js Version Requirements

This project uses **Node.js 24** as the latest LTS version:
- **Minimum requirement**: Node.js 24.0.0
- **CI testing**: Node.js 20 and 24
- **Recommended for development**: Node.js 24

### Why Node.js 24?

- Latest stable release with enhanced performance
- Improved ES modules support
- Better TypeScript integration
- Enhanced security features
- Long-term support (LTS) when available

## Development Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test**:
   ```bash
   pnpm test
   pnpm build
   ```

3. **Push and create PR**:
   - CI will run automatically
   - Merge when approved and tests pass

4. **Release when ready**:
   - Use version bump scripts
   - Push to main
   - Release happens automatically

## Troubleshooting

### Failed NPM Publish

1. Check NPM_TOKEN is valid and has publish permissions
2. Ensure package versions are unique (not already published)
3. Check package.json `files` field includes built assets

### Failed Tests in CI

1. Run tests locally: `pnpm test`
2. Check Node.js version compatibility (must be >=24.0.0)
3. Ensure all dependencies are properly declared

### Version Bump Issues

1. Ensure all package.json files are valid JSON
2. Check that workspace dependencies use `workspace:*`
3. Verify git working directory is clean before version bump

### Node.js Version Issues

1. Ensure you're using Node.js 24 or later
2. Update your local Node.js installation if needed
3. Check that CI is using the correct Node.js version in workflows

## Manual Commands

```bash
# Run specific package tests
pnpm --filter @sqlsmith/core test

# Build specific package  
pnpm --filter @sqlsmith/cli build

# Publish specific package (if needed)
pnpm --filter @sqlsmith/core publish

# Check what would be published
pnpm --filter @sqlsmith/core pack --dry-run

# Check Node.js version
node --version
``` 