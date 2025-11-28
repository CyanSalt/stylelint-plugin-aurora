import type { Plugin } from 'stylelint'
import selectorNestedCombinatorPosition from './rules/selector-nested-combinator-position.js'

export default [
  selectorNestedCombinatorPosition,
] satisfies Plugin[]
