# Compositions

A composition is an HTML document that defines a video timeline.

## Structure

Every composition needs a root element with `data-composition-id`:

```html
<div id="root" data-composition-id="root" data-width="1920" data-height="1080">
  <!-- Elements go here -->
</div>
```

## Nested Compositions

Embed one composition inside another:

```html
<div data-composition-src="./intro.html" data-start="0" data-duration="5"></div>
```

## Parameterized Compositions

Reuse a composition with different data using `data-props`:

```html
<!-- Root: same component, different data -->
<div class="clip"
  data-composition-src="compositions/card.html"
  data-props='{"title":"Pro","price":"$29","color":"#ec4899"}'
  data-start="0" data-duration="5" data-track-index="0">
</div>

<!-- Sub-composition: uses {{key}} placeholders -->
<!-- compositions/card.html -->
<template id="card-template">
  <div data-composition-id="card" data-width="1920" data-height="1080">
    <style>.card { background: {{color:#6366f1}}; }</style>
    <h2>{{title:Card Title}}</h2>
    <p>{{price:$0}}/mo</p>
  </div>
</template>
```

- `data-props` accepts a JSON object
- `{{key}}` — replaced with value, left as-is if unmatched
- `{{key:default}}` — replaced with value, or default if unmatched (use this so compositions render standalone)
- Works in HTML, CSS, and scripts
- Values are HTML-escaped in content, raw in CSS, JS-escaped in scripts

## Listing Compositions

Use `npx hyperframes compositions` to see all compositions in a project.
