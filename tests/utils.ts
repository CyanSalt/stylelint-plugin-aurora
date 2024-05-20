import * as path from 'path'
import { fileURLToPath } from 'url'

export function getPlugin(name: string) {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/rules/${name}.ts`)
}
