import type { Rule } from 'stylelint'
import stylelint from 'stylelint'
import { getRuleMeta, getRuleName } from '../utils.js'

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint

export const ruleName = getRuleName(import.meta.url)
export const meta = getRuleMeta(import.meta.url)

export const messages = ruleMessages(ruleName, {
  expected: (combinator: string) => `Expected combinator "${combinator}" to be in the nested form`,
})

const ruleImplementation: Rule = (
  expectation: 'as-prefix' | (string & {}),
  options: { includes?: string[] } | undefined,
  context,
) => {
  return (root, result) => {
    const validOptions = validateOptions(
      result,
      ruleName,
      {
        actual: expectation,
        possible: ['as-prefix'],
      },
      {
        actual: options,
        possible: {
          includes: [
            value => typeof value === 'string',
          ],
        },
        optional: true,
      },
    )
    if (!validOptions) return

    const combinators = ['>', '~', '+']
    if (options?.includes) {
      combinators.push(...options.includes)
    }
    root.walkRules(rule => {
      if (expectation === 'as-prefix') {
        const detectedCombinator = combinators.find(combinator => rule.selector.endsWith(combinator))
        if (detectedCombinator) {
          if (context.fix) {
            rule.each(child => {
              if (child.type === 'rule') {
                child.selector = child.selector
                  .split(',')
                  .map(selector => selector.replace(/(\S)/, `${detectedCombinator} $1`))
                  .join(',')
              }
            })
            const selector = rule.selector.slice(0, -detectedCombinator.length).trim()
            if (selector && selector !== '&') {
              rule.selector = selector
            } else if (rule.parent) {
              const parent = rule.parent
              rule.each(child => {
                parent.insertBefore(rule, child)
              })
              parent.removeChild(rule)
            }
            return
          }
          report({
            ruleName,
            result,
            node: rule,
            message: messages.expected(detectedCombinator),
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
