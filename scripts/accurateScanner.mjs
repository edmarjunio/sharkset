import fs from 'fs';
import path from 'path';

const hookRegex = /\buse[A-Z][a-zA-Z0-9_]*(?:<[^>\n]*>)?\s*\(/;

function scan(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let insideComponent = false;
  let componentName = '';
  let componentBraceDepth = 0;
  let earlyReturnLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Detect component start
    const compMatch = line.match(/(?:export\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)/);
    if (compMatch && (line.includes('React.FC') || line.includes('Props') || line.includes('()') || line.includes('({') || line.includes('function'))) {
      insideComponent = true;
      componentName = compMatch[1];
      componentBraceDepth = 0;
      earlyReturnLine = -1;
    }

    if (insideComponent) {
      for (const char of line) {
        if (char === '{') componentBraceDepth++;
        if (char === '}') componentBraceDepth--;
      }

      // Check if this line is an early return inside the component
      if (earlyReturnLine === -1 && componentBraceDepth === 2 && (/^\s*if\s*\(.*?\)\s*return\b/.test(line) || /^\s*if\s*\([^)]+\)\s*\{\s*return\b/.test(line))) {
        earlyReturnLine = i + 1;
      }

      // Check for hook call
      if (hookRegex.test(line)) {
        if (earlyReturnLine !== -1 && earlyReturnLine < i + 1) {
          console.log(`[HOOK VIOLATION!] File: ${filePath}:${i+1}`);
          console.log(`  Component: ${componentName}`);
          console.log(`  Hook call: ${line.trim()}`);
          console.log(`  Previous early return at line: ${earlyReturnLine}: ${lines[earlyReturnLine-1].trim()}`);
        }
      }

      if (componentBraceDepth <= 0 && insideComponent && i > 0) {
        insideComponent = false;
        componentName = '';
        earlyReturnLine = -1;
      }
    }
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git' && f !== 'scripts') walk(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      scan(p);
    }
  }
}

walk('src');
console.log('AST/Text Scan Completed.');
