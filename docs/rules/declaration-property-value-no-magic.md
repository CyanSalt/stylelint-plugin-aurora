# Disallow magic values in declaration properties (`declaration-property-value-no-magic`)

Sometimes we want to use CSS values ​​in a specific way, such as importing colors from a theme file, or using CSS custom properties. For specific values, this rule can prohibit using them literally.

This rule is fixable.

## Options

This rule has an object option:

- `values`: an object that contains magic values. The key represents the magic value that needs to be reported while the value can be in any of the following formats：
    - `true` means report only
    - A string representing the replacement
    - An object with:
        - `prop` : an optional property name to match. It will be treated as a regular expression if it contains characters other than lowercase letters and hyphens, otherwise a complete and exact match will be performed.
        - `syntax` : other variants of magic value with the syntax will also be reported. `<color>` is supported currently.
        - `replacement` : the value to be replaced in autofix
        - `uses` : additional partials that need to be imported via `@use` after replacing in SCSS. `uses` is declared as an object, e.g. `{ foo: './bar' }` is equivalent to `@use './bar' as foo`
        - `oneOf` : If there are multiple rules for one magic value, you can declare those objects as `oneOf`. The first items in the array will be matched first.

## Fail

```scss
/* stylelint aurora/declaration-property-value-no-magic: [{ "bold": "bolder" }] */
.foo {
  font-weight: bold;
}
```

```scss
/* stylelint aurora/declaration-property-value-no-magic: [{ "#FF0000": { "syntax": "<color>" } }] */
.foo {
  color: rgb(255, 0, 0);
}
```

## Pass

```scss
/* stylelint aurora/declaration-property-value-no-magic: [{ "bold": "bolder" }] */
.foo {
  font-weight: 700;
}
```

```scss
/* stylelint aurora/declaration-property-value-no-magic: [{ "#FF0000": { "syntax": "<color>" } }] */
#FF0000 {
  color: red;
}
```
