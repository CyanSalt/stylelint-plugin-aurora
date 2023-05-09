# stylelint-plugin-aurora

[![npm](https://img.shields.io/npm/v/stylelint-plugin-aurora.svg)](https://www.npmjs.com/package/stylelint-plugin-aurora)

Various Stylelint rules in one plugin.

## Installation

```shell
npm install --save-dev eslint-plugin-aurora
```

## Usage

```js
// stylelint.config.js
module.exports = {
  plugins: [
    'stylelint-plugin-aurora',
  ],
  rules: {
    'aurora/selector-nested-combinator-position': 'as-prefix',
  }
}
```

## Rules

- [`selector-nested-combinator-position`](./docs/rules/selector-nested-combinator-position.md) - Enforce the position of combinators in nesting 🔧

*🔧 means that the rule could be fixed automatically*.
