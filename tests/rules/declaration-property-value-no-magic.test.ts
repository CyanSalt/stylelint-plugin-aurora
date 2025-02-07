import { testRule } from 'stylelint-test-rule-vitest'
import plugin, { messages, ruleName } from '../../src/rules/declaration-property-value-no-magic'

testRule({
  plugins: [plugin],
  ruleName,
  config: [{
    bold: 'bolder',
  }],
  fix: true,
  accept: [
    {
      code: '.foo { font-weight: normal }',
      description: 'not the same value',
    },
    {
      code: '.bold { font-weight: normal }',
      description: 'pattern in selector',
    },
    {
      code: '.foo { font-weight: 700 }',
      description: 'other formats',
    },
  ],
  reject: [
    {
      code: '.foo { font-weight: bold }',
      description: 'used directly',
      fixed: '.foo { font-weight: bolder }',
      message: messages.rejected('bold'),
    },
  ],
})

testRule({
  plugins: [plugin],
  ruleName,
  config: [{
    '#FF0000': {
      syntax: '<color>',
      replacement: 'black',
    },
  }],
  fix: true,
  accept: [
    {
      code: '.foo { color: #00FF0000 }',
      description: 'not the same value',
    },
    {
      code: '#FF0000 { color: red }',
      description: 'pattern as selector',
    },
  ],
  reject: [
    {
      code: '.foo { color: #FF0000 }',
      description: 'used directly',
      fixed: '.foo { color: black }',
      message: messages.rejected('#FF0000'),
    },
    {
      code: '.foo { color: rgb(255, 0, 0) }',
      description: 'other formats',
      fixed: '.foo { color: black }',
      message: messages.rejected('rgb(255, 0, 0)'),
    },
  ],
})

testRule({
  plugins: [plugin],
  ruleName,
  config: [{
    '#FF0000': {
      syntax: '<color>',
      replacement: 'rgb(255, 0, 0)',
    },
  }],
  fix: true,
  accept: [
    {
      code: '.foo { color: rgb(255, 0, 0) }',
      description: 'the same value as replacement',
    },
  ],
})

testRule({
  plugins: [plugin],
  ruleName,
  config: [{
    '#FF0000': {
      syntax: '<color>',
      replacement: 'foo.$color',
      uses: {
        foo: '@foo/bar',
      },
    },
  }],
  fix: true,
  reject: [
    {
      code: '.foo { color: #FF0000 }',
      description: 'used directly',
      fixed: `@use '@foo/bar' as foo;
.foo { color: foo.$color }`,
      message: messages.rejected('#FF0000'),
    },
    {
      code: `@use '@foo/bar' as foo;
.foo { color: #FF0000 }`,
      description: 'used with partials',
      fixed: `@use '@foo/bar' as foo;
.foo { color: foo.$color }`,
      message: messages.rejected('#FF0000'),
    },
  ],
})
