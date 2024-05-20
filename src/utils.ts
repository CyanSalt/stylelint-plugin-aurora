import * as path from 'path'
import { fileURLToPath } from 'url'
import type { RuleMeta } from 'stylelint'

function getBasename(url: string) {
  const filename = fileURLToPath(url)
  return path.basename(filename, path.extname(filename))
}

export function getRuleName(url: string) {
  return `aurora/${getBasename(url)}`
}

export function getRuleMeta(url: string): RuleMeta {
  return {
    url: `https://github.com/CyanSalt/stylelint-plugin-aurora/blob/master/docs/rules/${getBasename(url)}.md`,
  }
}
