import path from 'path'
import { colord } from 'colord'
import MagicString from 'magic-string'
import valueParser from 'postcss-value-parser'
import type { Rule } from 'stylelint'
import stylelint from 'stylelint'
import { getRuleMeta, getRuleName } from '../utils.js'

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint

export const ruleName = getRuleName(import.meta.url)
export const meta = getRuleMeta(import.meta.url, {
  fixable: true,
})

export const messages = ruleMessages(ruleName, {
  rejected: (matched: string) => `Unexpected magic value "${matched}"`,
})

/**
 * {@link https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L14273}
 */
function escapeRegExp(input: string) {
  return input.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

type UseDeclarations = Record<string, string>

interface MatcherOptions {
  prop?: string,
  syntax?: '<color>' | '<family-name>' | string & {},
  replacement?: string,
  uses?: UseDeclarations,
}

type MatcherConfig = true | string | MatcherOptions

function normalizeMatcherOptions(config: MatcherConfig) {
  switch (typeof config) {
    case 'string':
      return { replacement: config }
    case 'boolean':
      return {}
    default:
      return config
  }
}

interface Matcher {
  options: MatcherOptions,
  // Use `test` to fuzzily match all values and `match` to accurately identify ranges
  test: (input: string) => boolean,
  // Empty `match` means the full input text matched
  match?: (parsed: valueParser.ParsedValue) => [number, number][],
  // Empty `replace` means report without fixing
  replace?: (part: string) => string,
}

const WORD_START_REGEXP = /^\w/
const WORD_END_REGEXP = /\w$/

function createWordRegExp(value: string) {
  const source = escapeRegExp(value)
  return new RegExp(`${
    WORD_START_REGEXP.test(value) ? '\\b' : ''
  }${source}${
    WORD_END_REGEXP.test(value) ? '\\b' : ''
  }`, 'gi')
}

const COLOR_REGEXP = /#[0-9a-fA-F]{3,8}\b|rgba?\(.*?\)|hsla?\(.*?\)/

function isColorNode(node: valueParser.Node) {
  switch (node.type) {
    case 'word':
      return node.value.startsWith('#')
    case 'function':
      return /(rgb|hsl)a?/.test(node.value)
    default:
      return false
  }
}

function divideNodes(nodes: valueParser.Node[]) {
  const groups: valueParser.Node[][] = []
  let currentGroup: valueParser.Node[] = []
  for (const node of nodes) {
    if (node.type === 'div') {
      groups.push(currentGroup)
      currentGroup = []
    } else {
      currentGroup.push(node)
    }
  }
  groups.push(currentGroup)
  return groups
}

interface FamilyName {
  value: string,
  sourceIndex: number,
  sourceEndIndex: number,
}

function getFamilyNames(parsed: valueParser.ParsedValue): FamilyName[] {
  return divideNodes(parsed.nodes).filter(group => group.length).map(group => {
    return {
      value: valueParser.stringify(group, node => {
        return node.type === 'string' ? node.value : undefined
      }),
      sourceIndex: group[0].sourceIndex,
      sourceEndIndex: group[group.length - 1].sourceEndIndex,
    }
  })
}

function createMatcher(value: string, options: MatcherOptions): Matcher {
  const { syntax, replacement } = options
  switch (syntax) {
    case '<color>': {
      const specified = colord(value)
      return {
        options,
        test: input => COLOR_REGEXP.test(input),
        match: parsed => {
          let matches: [number, number][] = []
          parsed.walk(node => {
            if (!isColorNode(node)) return
            const source = valueParser.stringify(node)
            if (source === replacement) return
            const color = colord(source)
            if (specified.isEqual(color)) {
              matches.push([node.sourceIndex, node.sourceEndIndex])
            }
          })
          return matches
        },
        replace: replacement ? () => replacement : undefined,
      }
    }
    case '<family-name>': {
      return {
        options,
        test: input => input.includes(value),
        match: parsed => {
          let matches: [number, number][] = []
          for (const name of getFamilyNames(parsed)) {
            if (name.value === value) {
              matches.push([name.sourceIndex, name.sourceEndIndex])
            }
          }
          return matches
        },
        replace: replacement ? () => replacement : undefined,
      }
    }
    default: {
      const regexp = createWordRegExp(value)
      return {
        options,
        test: input => regexp.test(input),
        replace: replacement
          ? input => input.replace(regexp, replacement)
          : undefined,
      }
    }
  }
}

function executeMatcher(matcher: Matcher, value: string) {
  const suspected = matcher.test(value)
  if (!suspected) return []
  const parsed = valueParser(value)
  return matcher.match ? matcher.match(parsed) : [[0, value.length] as [number, number]]
}

const CSS_PROP_REGEXP = /^[a-z-]+$/i
function matchProp(pattern: string, value: string) {
  return CSS_PROP_REGEXP.test(pattern)
    ? pattern.toLowerCase() === value.toLowerCase()
    : new RegExp(pattern, 'i').test(value)
}

type Root = Parameters<ReturnType<Rule>>[0]
type ChildNode = Root['nodes'][number]

function isSCSSUseRule(node: ChildNode): node is Extract<typeof node, { type: 'atrule' }> {
  return node.type === 'atrule' && node.name === 'use'
}

function getSCSSPartialName(source: string) {
  // _foo(.scss) => foo
  const name = path.basename(source, path.extname(source))
  return name.replace(/^_+/, '')
}

function parseSCSSUses(atRules: Extract<ChildNode, { type: 'atrule' }>[]) {
  return atRules.reduce<UseDeclarations>((uses, atRule) => {
    // 'source'( as alias)
    const matches = atRule.params.match(/^\s*('|")(.+?)\1(?:\s*as\s*(\S+))?\s*$/)
    if (!matches) return uses
    const source = matches[2]
    const alias = matches[3] as string | undefined
    const local = alias ?? getSCSSPartialName(source)
    uses[local] = source
    return uses
  }, {})
}

function diffObjects<T>(source: Record<string, T>, target: Record<string, T>) {
  return Object.fromEntries<T>(
    Object.entries(target).filter(([key, value]) => source[key] !== value),
  )
}

function insertBefore(root: Root, node: ChildNode | undefined, props: Parameters<Root['insertBefore']>[1]) {
  return node ? root.insertBefore(node, props) : root.append(props)
}

function replaceRanges(value: string, ranges: [number, number][], replacer: (part: string) => string) {
  const ms = new MagicString(value)
  for (const range of ranges) {
    ms.update(range[0], range[1], replacer(ms.slice(range[0], range[1])))
  }
  return ms.toString()
}

const ruleImplementation: Rule = (
  values: Record<string, true | string | MatcherOptions>,
  options,
  context,
) => {
  return (root, result) => {
    const validOptions = validateOptions(
      result,
      ruleName,
      {
        actual: values,
        possible: [
          value => {
            return typeof value === 'object'
              && value !== null
          },
        ],
      },
    )
    if (!validOptions) return

    const matchers = Object.entries(values)
      .filter(([key, config]) => config)
      .map(([key, config]) => {
        const opts = normalizeMatcherOptions(config)
        const matcher = createMatcher(key, opts)
        return matcher
      })

    const useRules = root.nodes.filter(node => isSCSSUseRule(node))
    const uses = parseSCSSUses(useRules)
    const startNode = useRules.length
      ? root.nodes.find(node => !isSCSSUseRule(node))
      : root.nodes[0]
    root.walkDecls(decl => {
      for (const matcher of matchers) {
        if (matcher.options.prop && !matchProp(matcher.options.prop, decl.prop)) continue
        const ranges = executeMatcher(matcher, decl.value)
        if (!ranges.length) continue
        const replacer = matcher.replace
        const fix = replacer ? () => {
          decl.value = replaceRanges(decl.value, ranges, replacer)
          if (matcher.options.uses) {
            const diff = diffObjects(uses, matcher.options.uses)
            Object.entries(diff).forEach(([alias, source]) => {
              insertBefore(root, startNode, {
                name: 'use',
                params: `'${source}' as ${alias}`,
              })
              uses[alias] = source
            })
          }
        } : undefined
        if (context.fix && fix) {
          fix()
        } else {
          report({
            result,
            ruleName,
            message: messages.rejected(decl.value.slice(...ranges[0])),
            node: decl,
          })
        }
      }
    })
  }
}

ruleImplementation.ruleName = ruleName
ruleImplementation.messages = messages
ruleImplementation.meta = meta

export default createPlugin(ruleName, ruleImplementation)
