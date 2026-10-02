import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoots = ['apps/web/src', 'packages/editor/src']
const literalColor = /#[\da-f]{3,8}\b|(?:rgba?|hsla?|oklch)\([^$)]*\)/i
const failures = []
const paletteSource = await readFile(resolve(root, 'packages/theme/src/colors.ts'), 'utf8')
const paletteBlock = paletteSource.slice(0, paletteSource.indexOf('} as const'))
const paletteTokens = new Set([...paletteBlock.matchAll(/^  (\w+):/gm)]
  .map((match) => '--palette-' + match[1].replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())))

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
    } else if (/\.(css|tsx?)$/.test(path)) {
      const source = await readFile(path, 'utf8')
      source.split('\n').forEach((line, index) => {
        if (literalColor.test(line)) failures.push(`${relative(root, path)}:${index + 1}`)
        for (const match of line.matchAll(/--palette-[\w-]+/g)) {
          if (!paletteTokens.has(match[0])) failures.push(`${relative(root, path)}:${index + 1}: unknown token ${match[0]}`)
        }
      })
    }
  }
}

for (const directory of sourceRoots) await scan(resolve(root, directory))

if (failures.length) {
  console.error('Use project color tokens instead of color literals:\n' + failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Project colors: no hardcoded color literals in UI or editor sources.')
}
