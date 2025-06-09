#!/usr/bin/env node

import { SqlMerger } from '../dist/sql-merger.js';
import { writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const merger = new SqlMerger();

const dialects = ['postgresql', 'sqlite'];
const testScenariosBase = resolve(__dirname, '../test/fixtures');

console.log('🚀 Generating expected output files for all scenarios...\n');

dialects.forEach(dialect => {
  console.log(`📝 Processing ${dialect} dialect...`);
  
  const dialectPath = resolve(testScenariosBase, dialect, 'correct');
  const scenarios = readdirSync(dialectPath).filter(item => 
    statSync(resolve(dialectPath, item)).isDirectory()
  );
  
  scenarios.forEach(scenario => {
    try {
      console.log(`  ✅ ${scenario}`);
      
      const scenarioPath = resolve(dialectPath, scenario);
      const sqlFiles = merger.parseSqlFile(scenarioPath, dialect);
      const mergedOutput = merger.mergeFiles(sqlFiles, { 
        addComments: false, 
        includeHeader: false 
      });
      
      // Write expected output file
      const expectedPath = resolve(dialectPath, `${scenario}.expected.sql`);
      writeFileSync(expectedPath, mergedOutput.trim() + '\n');
      
    } catch (error) {
      console.error(`  ❌ Error processing ${scenario}: ${error.message}`);
    }
  });
  
  console.log('');
});

console.log('✅ All expected output files generated successfully!'); 