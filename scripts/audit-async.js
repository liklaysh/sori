import fs from 'fs';
import path from 'path';

const results = {
  missingLocalErrorHandler: [],
  potentialDanglingPromises: []
};

function getFiles(dir, files_ = []) {
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      if (name.includes('node_modules') || name.includes('dist')) continue;
      getFiles(name, files_);
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files_.push(name);
    }
  }
  return files_;
}

const files = getFiles('apps/backend/src');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Simple heuristic for Hono/Socket handlers
  lines.forEach((line, index) => {
    // Check if line contains async route/socket handler
    if ((line.includes('async (c) =>') || line.includes('async (socket) =>')) && !content.includes('try {', index)) {
      // Check if there is a try block in the next few lines
      let foundTry = false;
      for (let i = index; i < Math.min(index + 5, lines.length); i++) {
        if (lines[i].includes('try {')) foundTry = true;
      }
      if (!foundTry) {
        results.missingLocalErrorHandler.push({ file, line: index + 1, snippet: line.trim() });
      }
    }

    // Check for common async calls without await/then
    if (line.includes('db.') && !line.includes('await') && !line.includes('return') && !line.includes('.then')) {
        results.potentialDanglingPromises.push({ file, line: index + 1, snippet: line.trim() });
    }
  });
});

fs.writeFileSync('async-audit-report.json', JSON.stringify(results, null, 2));
console.log(`✅ Async audit complete. Report: async-audit-report.json`);
