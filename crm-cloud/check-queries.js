// Verifies, for every `pool.query(sql, [params])` call site in the given
// files, that the highest $N placeholder in the SQL string is <= the
// number of elements in the params array, and flags any obvious mismatch.
// Run with: node check-queries.js <file1.js> <file2.js> ...
const ts = require('typescript');
const fs = require('fs');

function countArrayElements(node) {
  if (!node) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.length;
  return null; // params passed as a variable, not a literal — can't statically count
}

function maxPlaceholder(sqlText) {
  const matches = [...sqlText.matchAll(/\$(\d+)/g)];
  if (!matches.length) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

function extractStringish(node, sourceFile) {
  // Handles plain strings, template literals (no substitutions only — flags if it has them)
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return '__HAS_TEMPLATE_SUBSTITUTIONS__' + node.getText(sourceFile);
  }
  return null;
}

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const issues = [];
  let callCount = 0;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'query' &&
      (node.expression.expression.getText(sourceFile) === 'pool' || node.expression.expression.getText(sourceFile) === 'client')
    ) {
      callCount++;
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const args = node.arguments;
      const sqlArg = args[0];
      const paramsArg = args[1];

      const sqlText = sqlArg ? extractStringish(sqlArg, sourceFile) : null;
      if (sqlText && sqlText.startsWith('__HAS_TEMPLATE_SUBSTITUTIONS__')) {
        issues.push(`Line ${line + 1}: SQL uses template substitution (\${...}) instead of a $N placeholder — likely SQL injection risk or a missed conversion: ${sqlText.replace('__HAS_TEMPLATE_SUBSTITUTIONS__', '').slice(0, 90)}`);
        return ts.forEachChild(node, visit);
      }
      if (sqlText === null) {
        // SQL built dynamically (e.g. string concatenation) — can't statically check, skip.
        return ts.forEachChild(node, visit);
      }

      const maxPh = maxPlaceholder(sqlText);
      const arrCount = countArrayElements(paramsArg);

      if (maxPh > 0 && paramsArg === undefined) {
        issues.push(`Line ${line + 1}: SQL has $${maxPh} placeholder(s) but no params argument was passed at all.`);
      } else if (maxPh > 0 && arrCount !== null && arrCount !== maxPh) {
        issues.push(`Line ${line + 1}: SQL highest placeholder is $${maxPh} but params array has ${arrCount} element(s).`);
      } else if (maxPh === 0 && arrCount !== null && arrCount > 0) {
        issues.push(`Line ${line + 1}: params array has ${arrCount} element(s) but SQL has no $N placeholders — are they unused, or did you forget the placeholders?`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { callCount, issues };
}

const files = process.argv.slice(2);
let totalCalls = 0;
let totalIssues = 0;
for (const f of files) {
  const { callCount, issues } = checkFile(f);
  totalCalls += callCount;
  if (issues.length) {
    totalIssues += issues.length;
    console.log(`\n=== ${f} (${callCount} query calls) ===`);
    for (const issue of issues) console.log('  ⚠ ' + issue);
  }
}
console.log(`\nChecked ${files.length} files, ${totalCalls} pool.query() calls total, ${totalIssues} potential issues found.`);
process.exit(totalIssues > 0 ? 1 : 0);
