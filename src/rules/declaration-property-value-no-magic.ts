import path from 'path'
import { colord } from 'colord'
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
  syntax?: '<color>' | string & {},
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

function extractColors(value: string) {
  // Supports HEX, RGB(A), HSL(A) only
  const matches = value.match(/#[0-9a-fA-F]{3,6}|rgba?\(.*?\)|hsla?\(.*?\)/g)
  return matches ? matches as string[] : []
}

interface Matcher {
  options: MatcherOptions,
  test: (input: string) => string[],
  // Empty `replace` means report without fixing
  replace?: (input: string, matches: string[]) => string,
}

function createWordRegExpEdge(value: string) {
  return /\w/.test(value) ? '\\b' : ''
}

function createWordRegExp(value: string) {
  const source = escapeRegExp(value)
  return new RegExp(`${createWordRegExpEdge(value.slice(0, 1))}${source}${createWordRegExpEdge(value.slice(-1))}`, 'gi')
}

function createMatcher(value: string, options: MatcherOptions): Matcher {
  const { syntax, replacement } = options
  switch (syntax) {
    case '<color>': {
      const specified = colord(value)
      return {
        options,
        test: (input: string) => {
          const colors = extractColors(input)
          if (!colors.length) return []
          // Skip if color is equivalent to the replacement
          // for replacing formats with a specified one
          return colors.filter(color => color !== replacement && specified.isEqual(color))
        },
        replace: replacement
          ? (input: string, matches: string[]) => {
            return matches.reduce((accumulator, pattern) => {
              const regexp = createWordRegExp(pattern)
              return accumulator.replace(regexp, replacement)
            }, input)
          }
          : undefined,
      }
    }
    default: {
      const regexp = createWordRegExp(value)
      return {
        options,
        test: (input: string) => {
          return regexp.test(input) ? [value] : []
        },
        replace: replacement
          ? (input: string) => input.replace(regexp, replacement)
          : undefined,
      }
    }
  }
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
        const matched = matcher.test(decl.value)
        if (matched.length) {
          const fix = matcher.replace ? () => {
            decl.value = matcher.replace!(decl.value, matched)
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
              message: messages.rejected(matched[0]),
              node: decl,
            })
          }
        }
      }
    })
  }
}

ruleImplementation.ruleName = ruleName
ruleImplementation.messages = messages
ruleImplementation.meta = meta

export default createPlugin(ruleName, ruleImplementation)
