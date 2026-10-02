import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const webRoot = join(root, 'apps/web/src')
const editorRoot = join(root, 'packages/editor/src')
const failures = []

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []))
  return groups.flat()
}

function dependencies(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const imports = []
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const allTypeSpecifiers = clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        && !clause.name && clause.namedBindings.elements.length > 0
        && clause.namedBindings.elements.every(element => element.isTypeOnly)
      const allTypeExports = node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly)
      imports.push({ target: node.moduleSpecifier.text, runtime: !(node.isTypeOnly || clause?.isTypeOnly || allTypeSpecifiers || allTypeExports) })
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
      imports.push({ target: node.arguments[0].text, runtime: true })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

const webFiles = await sourceFiles(webRoot)
for (const file of webFiles) {
  const owner = relative(webRoot, file).split('/')
  for (const { target } of dependencies(file, await readFile(file, 'utf8'))) {
    const absolute = target.startsWith('@/') ? join(webRoot, target.slice(2))
      : target.startsWith('.') ? resolve(dirname(file), target) : null
    if (!absolute) continue
    const destination = relative(webRoot, absolute).split('/')
    const fail = message => failures.push(`${relative(root, file)} → ${target}: ${message}`)
    if (owner[0] === 'shared' && ['app', 'pages', 'features'].includes(destination[0])) fail('shared cannot depend on application features')
    if (owner[0] === 'features' && ['app', 'pages'].includes(destination[0])) fail('features cannot depend on application composition')
    if (owner[0] === 'pages' && destination[0] === 'app') fail('pages cannot depend on app')
    if (destination[0] === 'features' && !(owner[0] === 'features' && owner[1] === destination[1])
      && destination.length > 2 && !(destination.length === 3 && /^index(?:\.ts)?$/.test(destination[2]))) fail('use the feature public entry point')
  }
}

const editorFiles = await sourceFiles(editorRoot)
const editorSet = new Set(editorFiles)
const graph = new Map()
for (const file of editorFiles) {
  const edges = []
  for (const { target, runtime } of dependencies(file, await readFile(file, 'utf8'))) {
    if (!runtime || !target.startsWith('.')) continue
    const base = resolve(dirname(file), target)
    const destination = [base, `${base}.ts`, join(base, 'index.ts')].find(candidate => editorSet.has(candidate))
    if (destination) edges.push(destination)
  }
  graph.set(file, edges)
}
const visited = new Set()
const active = new Set()
function checkCycles(file, path = []) {
  if (active.has(file)) {
    failures.push(`Editor runtime cycle: ${[...path.slice(path.indexOf(file)), file].map(item => relative(editorRoot, item)).join(' → ')}`)
    return
  }
  if (visited.has(file)) return
  active.add(file)
  for (const dependency of graph.get(file) ?? []) checkCycles(dependency, [...path, file])
  active.delete(file)
  visited.add(file)
}
for (const file of editorFiles) checkCycles(file)
if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
} else {
  console.log(`Architecture: ${webFiles.length} web files respect module boundaries; ${editorFiles.length} editor modules have no runtime cycles.`)
}
