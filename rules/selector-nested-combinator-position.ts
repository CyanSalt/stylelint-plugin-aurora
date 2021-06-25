import { createPlugin, utils } from 'stylelint';
import { getRuleName } from '../utils';

export const ruleName = getRuleName(__filename);

export const messages = utils.ruleMessages(ruleName, {
  expected: (combinator) => `Expected combinator "${combinator}" to be in the nested form`,
});

// @ts-expect-error bad typings in @types/stylelint
export default createPlugin(ruleName, (expectation, options: any, context) => {
  return (root, result) => {
    const validOptions = utils.validateOptions(
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
    );
    if (!validOptions) return;

    const combinators = ['>', '~', '+'];
    if (options?.includes) {
      combinators.push(...options.includes);
    }
    root.walkRules(rule => {
      if (expectation === 'as-prefix') {
        const detectedCombinator = combinators.find(combinator => rule.selector.endsWith(combinator));
        if (detectedCombinator) {
          if (context.fix) {
            rule.each(child => {
              if (child.type === 'rule') {
                child.selector = `${detectedCombinator} ${child.selector}`;
              }
            });
            const selector = rule.selector.slice(0, -detectedCombinator.length).trim();
            if (selector && selector !== '&') {
              rule.selector = selector;
            } else {
              rule.each(child => {
                rule.parent.insertBefore(rule, child);
              });
              rule.parent.removeChild(rule);
            }
            return;
          }
          utils.report({
            ruleName,
            result,
            node: rule,
            message: messages.expected(detectedCombinator),
          });
        }
      }
    });
  };
});
