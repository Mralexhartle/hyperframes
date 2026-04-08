# Building from Screenshot + Tokens

Tips for building HyperFrames compositions from the captured data.

## The Workflow

1. Read the **full-page screenshot** for visual layout
2. Read **tokens.json** for exact colors, fonts, headings, CTAs
3. Read **visible-text.txt** for exact page text content
4. Read **assets-catalog.json** for image/font/video URLs
5. Build clean HTML/CSS compositions that recreate the design
6. Add GSAP animations using data from animations.json

## Matching the Screenshot

### Layout

- Count columns in the screenshot. 3 cards side by side → CSS grid or flexbox with 3 columns
- Check alignment: centered text, left-aligned content, split layouts
- Note spacing: tightly packed or breathing with margins?

### Colors

- Use exact hex values from tokens.json, not visual approximations
- Check background: solid color, gradient, or image?
- Note contrast: light text on dark, dark text on light

### Typography

- Use the fonts from tokens.json
- Load via @font-face with URLs from assets-catalog.json font entries
- Match heading sizes from tokens.json headings array (fontSize, fontWeight)

### Images & Assets

- Use asset URLs from assets-catalog.json for product screenshots, hero images
- Use SVGs from assets/svgs/ for company logos and icons
- Use downloaded fonts from assets/fonts/
- For images not captured, use a CSS gradient or shape placeholder

## Common Mistakes

### Fabricating text content

Read visible-text.txt and use the EXACT strings. Don't paraphrase "Financial infrastructure to grow your revenue" as "Grow your business with Stripe."

### Ignoring animation data

Read animations.json. The site's actual animation timings (easing, duration) should inform your GSAP choices.

### Missing brand colors

Every section in tokens.json has a backgroundColor. Use it.

### Wrong font

Check assets/fonts/ for local font files. Check assets-catalog.json for font URLs. Use @font-face with the real URLs.

### Using placeholder images

When assets-catalog.json has a real image URL for something visible in the screenshot, USE IT. Don't substitute with colored rectangles.

## When to Simplify

**Match exactly:**

- Heading text, font, color
- Background color/gradient
- CTA button text and colors
- Overall layout

**OK to simplify:**

- Complex nested card layouts → capture the essence
- Decorative SVG illustrations → use simpler CSS or skip
- Hover states, interactive elements → not relevant for video
- Cookie banners, popups, navigation → skip

## Screenshot Fallback

If a section is too complex (e.g., 3D WebGL), use the screenshot as background:

```html
<div style="position: absolute; inset: 0;">
  <img src="../screenshots/full-page.png" style="width: 100%; object-fit: cover;" />
</div>
```

Then animate text overlays on top.

## Quality Checklist

- [ ] Visually matches the screenshot layout
- [ ] Uses exact brand colors from tokens.json
- [ ] Uses exact text from visible-text.txt
- [ ] Uses real asset URLs (not placeholders)
- [ ] Has meaningful GSAP animations (not just fade in/out)
- [ ] Passes `npx hyperframes lint`
