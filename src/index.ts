import * as fs from 'fs'
import * as path from 'path'

function importDefault(obj: any) {
  return obj?.__esModule ? obj.default : obj
}

function loadRules(dir: string) {
  return fs.readdirSync(dir)
    .map(rule => importDefault(require(path.join(dir, rule))))
}

const rules = loadRules(path.join(__dirname, 'rules'))

export default rules
