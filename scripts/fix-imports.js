import fs from 'fs';
import path from 'path';

const UNFIXED_LOG = 'unfixed-imports.json';
const results = {
  buildStrategy: { backend: 'unknown', web: 'unknown' },
  moduleResolution: { backend: 'unknown', web: 'unknown' },
  brokenImports: [],
  recommendations: []
};

// Recursive file search
function getFiles(dir, files_ = []) {
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      if (name.includes('node_modules') || name.includes('dist') || name.includes('.git')) continue;
      getFiles(name, files_);
    } else {
      if (name.endsWith('.ts') || name.endsWith('.tsx')) {
        files_.push(name);
      }
    }
  }
  return files_;
}

// 1. Detect Strategy
try {
  const backendPackage = JSON.parse(fs.readFileSync('apps/backend/package.json', 'utf8'));
  results.buildStrategy.backend = backendPackage.scripts.build || 'tsc';
  const backendTsConfig = JSON.parse(fs.readFileSync('apps/backend/tsconfig.json', 'utf8'));
  results.moduleResolution.backend = backendTsConfig.compilerOptions.moduleResolution || 'node';
} catch (e) { console.error('Error reading backend config:', e.message); }

try {
  const webPackage = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
  results.buildStrategy.web = (webPackage.scripts.dev && webPackage.scripts.dev.includes('vite')) ? 'vite' : 'unknown';
  const webTsConfig = JSON.parse(fs.readFileSync('apps/web/tsconfig.json', 'utf8'));
  results.moduleResolution.web = webTsConfig.compilerOptions.moduleResolution || 'node';
} catch (e) { console.error('Error reading web config:', e.message); }

// 2. Audit Imports
console.log('🔍 Auditing imports (safe mode)...');
const files = getFiles('apps');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importLines = content.match(/import\s+.*from\s+['"](.*)['"]/g) || [];

  importLines.forEach(line => {
    const match = line.match(/from\s+['"](.*)['"]/);
    if (!match) return;
    
    const importPath = match[1];
    if (importPath.startsWith('.') ) {
      const dir = path.dirname(file);
      let relativePath = importPath;
      
      // Handle the case where the user might have used .js in the code but files are .ts
      if (relativePath.endsWith('.js')) {
        relativePath = relativePath.slice(0, -3);
      }

      const fullPath = path.resolve(dir, relativePath);
      
      const exists = [
        fullPath,
        fullPath + '.ts',
        fullPath + '.tsx',
        fullPath + '/index.ts',
        fullPath + '/index.tsx'
      ].some(p => fs.existsSync(p));

      if (!exists) {
        results.brokenImports.push({ file, importPath, reason: 'Path not found' });
      }
    }
    
    // Check for alias usage
    if (importPath.startsWith('@/') && !file.includes('apps/web')) {
      results.brokenImports.push({ file, importPath, reason: 'Web alias used in non-web package' });
    }
  });
});

// 3. Recommendations
if (results.moduleResolution.backend === 'NodeNext') {
  results.recommendations.push("Backend uses NodeNext resolution. This strictly requires '.js' extensions in standard Node.js ESM. Recommendation: Verify if 'tsx' or 'esbuild' is being used to bypass this, otherwise you MUST use .js in imports.");
}

if (results.moduleResolution.web === 'bundler') {
  results.recommendations.push("Web uses 'bundler' resolution (Vite). This is correct. No extensions needed.");
}

fs.writeFileSync(UNFIXED_LOG, JSON.stringify(results, null, 2));
console.log(`✅ Audit complete. Found ${results.brokenImports.length} issues. Report: ${UNFIXED_LOG}`);
