# Enforce the position of combinators in nesting (`selector-nested-combinator-position`)

Using combinators improperly in nesting not only makes the code difficult to read, but also prone to bugs. For example, `.foo > { display: block }` will compile in an unintended style.

Set the first parameter of the rule to `as-prefix` to disallow combinators at the end of selectors.

This rule is fixable.

## Options

This rule has an object option:

- `"includes"` declares extra combinators

## Fail

```scss
.foo > {
  .bar {
    display: block;
  }
}
```

```scss
/* stylelint aurora/selector-nested-combinator-position: ["as-prefix", { "includes": ["::v-deep"] }] */
.foo ::v-deep {
  .bar {
    display: block;
  }
}
```

## Pass

```scss
.foo > .bar {
  display: block;
}
```

```scss
.foo {
  > .bar {
    display: block;
  }
}
```

```scss
.foo {
  & > .bar {
    display: block;
  }
}
```
