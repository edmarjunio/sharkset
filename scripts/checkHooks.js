const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

let hasErrors = false;

function scanFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = babelParser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (err) {
    // ignore parse error if any
    return;
  }

  // Check each function (component or custom hook)
  traverse(ast, {
    Function(pathNode) {
      const fnName = pathNode.node.id ? pathNode.node.id.name : (pathNode.parent.type === 'VariableDeclarator' && pathNode.parent.id.name) ? pathNode.parent.id.name : '';
      const isComponentOrHook = /^[A-Z]/.test(fnName) || /^use[A-Z]/.test(fnName);
      if (!isComponentOrHook) return;

      let returnStatements = [];
      let hookCalls = [];

      pathNode.traverse({
        Function(innerPath) {
          innerPath.skip(); // don't inspect nested functions
        },
        ReturnStatement(retPath) {
          returnStatements.push(retPath.node.loc ? retPath.node.loc.start.line : 0);
        },
        CallExpression(callPath) {
          const callee = callPath.node.callee;
          let name = '';
          if (callee.type === 'Identifier') {
            name = callee.name;
          } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
            name = callee.property.name;
          }
          if (/^use[A-Z]/.test(name)) {
            hookCalls.push({ name, line: callPath.node.loc ? callPath.node.loc.start.line : 0 });
          }
        }
      });

      if (returnStatements.length > 1 && hookCalls.length > 0) {
        // Find if any hook call happens after ANY return statement (except the last one)
        const earliestReturn = Math.min(...returnStatements.slice(0, -1));
        const hooksAfterEarlyReturn = hookCalls.filter(h => h.line > earliestReturn);
        if (hooksAfterEarlyReturn.length > 0) {
          console.log(`[VIOLATION] Component/Hook "${fnName}" in ${filePath}:`);
          console.log(`  Early return at line: ${earliestReturn}`);
          hooksAfterEarlyReturn.forEach(h => {
            console.log(`  Hook "${h.name}" called at line ${h.line} (AFTER return!)`);
          });
          hasErrors = true;
        }
      }
    }
  });
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
        walk(full);
      }
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      scanFile(full);
    }
  }
}

walk('src');
if (!hasErrors) {
  console.log('No obvious hook rule violations found with AST traversal!');
}
