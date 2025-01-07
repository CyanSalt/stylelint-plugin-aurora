import { testRule } from 'stylelint-test-rule-node'
import { messages, ruleName } from '../../src/rules/selector-nested-combinator-position'
import { getPlugin } from '../utils'

testRule({
  plugins: [getPlugin('selector-nested-combinator-position')],
  ruleName,
  config: ['as-prefix'],
  fix: true,
  accept: [
    {
      code: '.foo > .bar {}',
      description: 'selector in one line',
    },
    {
      code: '.foo { > .bar {} }',
      description: 'nesting declaration',
    },
    {
      code: '.foo { & > .bar {} }',
      description: 'another nesting declaration',
    },
  ],
  reject: [
    {
      code: '.foo > { .bar {} }',
      description: 'trailing combinator',
      fixed: '.foo { > .bar {} }',
      message: messages.expected('>'),
    },
    {
      code: '.foo { > { .bar {} } }',
      description: 'single combinator selector',
      fixed: '.foo { > .bar {} }',
      message: messages.expected('>'),
    },
  ],
})

testRule({
  plugins: [getPlugin('selector-nested-combinator-position')],
  ruleName,
  config: ['as-prefix', { includes: ['::v-deep'] }],
  fix: true,
  accept: [
    {
      code: '.foo ::v-deep .bar {}',
      description: 'selector in one line',
    },
  ],
  reject: [
    {
      code: '.foo ::v-deep { .bar {} }',
      description: 'trailing combinator',
      fixed: '.foo { ::v-deep .bar {} }',
      message: messages.expected('::v-deep'),
    },
  ],
})
