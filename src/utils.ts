import * as path from 'path'

export function getRuleName(filename) {
  return `aurora/${path.basename(filename, path.extname(filename))}`
}
