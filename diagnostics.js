import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as glob from 'glob';

const REPORT_FILE = 'diagnostics-report.json';
const ROOT_DIR = process.cwd();

const report = {
  timestamp: new Date().toISOString(),
  unresolvedImports: [],
  circularDependencies: [],
  largeFiles: [],
  illegalAnyUsage: [],
  envDirectAccess: [],
  boundaryViolations: [],
  initOrderWarnings: [],
  potentialHardcode: []
};

// 1. Madge for Circular Dependencies
console.log('🔍 Checking for circular dependencies...');
try {
  const madgeOutput = execSync('npx -y madge --circular --json .').toString();
  report.circularDependencies = JSON.parse(madgeOutput);
} catch (e) {
  console.warn('⚠️ Madge failed or found cycles:', e.message);
}

// 2. Scan Files
const files = glob.sync('apps/**/*.{ts,tsx,js,jsx}', { ignore: ['**/node_modules/**', '**/dist/**'] });

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const stats = fs.statSync(file);
  const lines = content.split('\n');

  // Large Files
  if (lines.length > 400) {
    report.largeFiles.push({ file, lines: lines.length });
  }

  // Any usage / ts-ignore
  const anyCount = (content.match(/:\s*any/g) || []).length;
  const ignoreCount = (content.match(/@ts-ignore/g) || []).length;
  if (anyCount > 0 || ignoreCount > 0) {
    report.illegalAnyUsage.push({ file, anyCount, ignoreCount });
  }

  // process.env usage (should be in config.ts)
  if (!file.includes('config.ts') && !file.includes('index.ts') && content.includes('process.env.')) {
    report.envDirectAccess.push({ file });
  }

  // Boundary Violations (Web importing Backend)
  if (file.includes('apps/web') && (content.includes('apps/backend') || content.includes('@sori/backend'))) {
    report.boundaryViolations.push({ file, type: 'web -> backend' });
  }

  // 3. Simple AST-like checks for Hardcode using Regex (Fallack for AST)
  // Check for hardcoded API URLs, Ports, or Secrets
  const hardcodePatterns = [
    { pattern: /const\s+\w+\s*=\s*"http:\/\/localhost/g, label: 'Hardcoded Localhost URL' },
    { pattern: /secret:\s*"[^"]{10,}"/g, label: 'Potential Hardcoded Secret' },
  ];

  hardcodePatterns.forEach(p => {
    if (p.pattern.test(content)) {
      report.potentialHardcode.push({ file, issue: p.label });
    }
  });
});

// 4. Init Order Analysis (Specific to Sori)
const backendIndex = 'apps/backend/src/index.ts';
if (fs.existsSync(backendIndex)) {
  const content = fs.readFileSync(backendIndex, 'utf8');
  const lines = content.split('\n');
  
  const initSocketLine = lines.findIndex(l => l.includes('initSocket('));
  const dbImportLine = lines.findIndex(l => l.includes('./db/index.js'));
  const seedLine = lines.findIndex(l => l.includes('seed()'));

  if (initSocketLine !== -1 && dbImportLine !== -1 && initSocketLine < dbImportLine) {
    report.initOrderWarnings.push('Socket initialized before DB import (risky singleton state)');
  }
}

fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
console.log(`✅ Diagnostics complete. Report saved to ${REPORT_FILE}`);
