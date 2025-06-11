#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const PACKAGES = ['core', 'cli', 'vite-plugin'];
const WORKSPACE_ROOT = resolve(import.meta.url.replace('file://', ''), '../..');

const versionType = process.argv[2]; // patch, minor, major
const customVersion = process.argv[3]; // optional custom version

if (!versionType && !customVersion) {
  console.error('Usage: node scripts/version-bump.js [patch|minor|major] [custom-version]');
  console.error('Examples:');
  console.error('  node scripts/version-bump.js patch');
  console.error('  node scripts/version-bump.js minor');
  console.error('  node scripts/version-bump.js major');
  console.error('  node scripts/version-bump.js custom 1.0.0');
  process.exit(1);
}

const incrementVersion = (version, type) => {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch (type) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':  
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown version type: ${type}`);
  }
};

const updatePackageVersion = (packageName, newVersion) => {
  const packagePath = resolve(WORKSPACE_ROOT, `packages/${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  
  writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t') + '\n');
  console.log(`Updated @sqlsmith/${packageName}: ${oldVersion} → ${newVersion}`);
  
  return { oldVersion, newVersion };
};

const updateRootVersion = (newVersion) => {
  const rootPackagePath = resolve(WORKSPACE_ROOT, 'package.json');
  const rootPackageJson = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  
  const oldVersion = rootPackageJson.version;
  rootPackageJson.version = newVersion;
  
  writeFileSync(rootPackagePath, JSON.stringify(rootPackageJson, null, '\t') + '\n');
  console.log(`Updated workspace root: ${oldVersion} → ${newVersion}`);
};

try {
  // Get current version from core package
  const corePackagePath = resolve(WORKSPACE_ROOT, 'packages/core/package.json');
  const corePackage = JSON.parse(readFileSync(corePackagePath, 'utf8'));
  const currentVersion = corePackage.version;
  
  // Calculate new version
  const newVersion = customVersion || incrementVersion(currentVersion, versionType);
  
  console.log(`Bumping version from ${currentVersion} to ${newVersion}`);
  console.log('');
  
  // Update all packages
  const updates = PACKAGES.map(pkg => updatePackageVersion(pkg, newVersion));
  
  // Update root package.json
  updateRootVersion(newVersion);
  
  console.log('');
  console.log('✅ Version bump complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Review the changes');
  console.log('2. Commit the version changes:');
  console.log('   git add -A');  
  console.log(`   git commit -m "chore: bump version to ${newVersion}"`);
  console.log('3. Push to main branch to trigger release:');
  console.log('   git push origin main');
  
} catch (error) {
  console.error('Error updating versions:', error.message);
  process.exit(1);
} 