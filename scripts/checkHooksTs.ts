import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

interface Violation {
  file: string;
  line: number;
  type: 'CONDITIONAL_HOOK' | 'HOOK_AFTER_RETURN';
  hook: string;
}

const reports: Violation[] = [];

function checkFunction(node: any, sf: any) {
  let hasReturned = false;

  function visit(child: any, insideConditional: boolean) {
    if (ts.isFunctionDeclaration(child) || ts.isArrowFunction(child) || ts.isFunctionExpression(child)) {
      function visitNested(nested: any) {
        if (ts.isCallExpression(nested)) {
          let callName = '';
          if (ts.isIdentifier(nested.expression)) {
            callName = nested.expression.text;
          } else if (ts.isPropertyAccessExpression(nested.expression) && ts.isIdentifier(nested.expression.name)) {
            callName = nested.expression.name.text;
          }
          if (/^use[A-Z]/.test(callName) && callName !== 'useCallback') {
            const { line } = sf.getLineAndCharacterOfPosition(nested.getStart());
            reports.push({
              file: sf.fileName,
              line: line + 1,
              type: 'CONDITIONAL_HOOK',
              hook: `${callName} (inside nested function/callback)`,
            });
          }
        }
        ts.forEachChild(nested, visitNested);
      }
      ts.forEachChild(child, visitNested);
      return;
    }

    if (ts.isIfStatement(child) || ts.isConditionalExpression(child) || ts.isSwitchStatement(child) || ts.isForStatement(child) || ts.isWhileStatement(child)) {
      insideConditional = true;
    }

    if (ts.isReturnStatement(child)) {
      hasReturned = true;
    }

    if (ts.isCallExpression(child)) {
      let callName = '';
      if (ts.isIdentifier(child.expression)) {
        callName = child.expression.text;
      } else if (ts.isPropertyAccessExpression(child.expression) && ts.isIdentifier(child.expression.name)) {
        callName = child.expression.name.text;
      }

      if (/^use[A-Z]/.test(callName)) {
        const { line } = sf.getLineAndCharacterOfPosition(child.getStart());
        if (insideConditional) {
          reports.push({
            file: sf.fileName,
            line: line + 1,
            type: 'CONDITIONAL_HOOK',
            hook: callName,
          });
        } else if (hasReturned) {
          reports.push({
            file: sf.fileName,
            line: line + 1,
            type: 'HOOK_AFTER_RETURN',
            hook: callName,
          });
        }
      }
    }

    ts.forEachChild(child, (c: any) => visit(c, insideConditional));
  }

  if (node.body && ts.isBlock(node.body)) {
    for (const stmt of node.body.statements) {
      const isCond = ts.isIfStatement(stmt) || ts.isConditionalExpression(stmt) || ts.isSwitchStatement(stmt);
      visit(stmt, isCond);
    }
  }
}

function walkAst(node: any, sf: any) {
  if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    checkFunction(node, sf);
  }
  ts.forEachChild(node, (c: any) => walkAst(c, sf));
}

function walkDir(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git' && f !== 'scripts') {
        walkDir(full);
      }
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      const code = fs.readFileSync(full, 'utf8');
      const sf = ts.createSourceFile(full, code, ts.ScriptTarget.Latest, true);
      walkAst(sf, sf);
    }
  }
}

walkDir('src');

if (reports.length === 0) {
  console.log('✅ SUCCESS: 0 React Hook violations found.');
} else {
  console.error(`❌ FOUND ${reports.length} VIOLATIONS:`);
  console.error(JSON.stringify(reports, null, 2));
}
