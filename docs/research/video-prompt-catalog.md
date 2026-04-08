# HyperFrames Video Prompt Catalog

> A library of ready-to-use prompts for creating video compositions from captured websites.
> These prompts work with the DESIGN.md + screenshot produced by `hyperframes capture`.

## How to Use

1. Run `hyperframes capture <url>` to capture a website
2. Open the capture directory in Claude Code or Cursor
3. The AI agent reads CLAUDE.md automatically, which points to DESIGN.md and screenshot
4. Copy one of the prompts below and paste it as your request
5. The AI creates HyperFrames compositions using the captured brand identity

---

## Social Media Ads

### 15-Second Instagram/TikTok Ad
```
Create a 15-second social media ad using this captured website's brand identity.

Structure:
- Scene 1 (0-3s): Bold hook statement on brand's primary dark background. 
  Large heading text that grabs attention. Use the hero heading from DESIGN.md.
- Scene 2 (3-8s): Feature showcase. Show 2-3 key features from the website 
  using the product screenshots from DESIGN.md assets. Animate them in with 
  staggered entrance.
- Scene 3 (8-12s): Social proof. Show a testimonial quote and company logos 
  from the website. Counter-animate a key stat.
- Scene 4 (12-15s): CTA on brand background. Show the brand logo and main 
  CTA text. Pulse the button with brand accent color glow. Fade to black.

Use exact colors, fonts, and text from the DESIGN.md.
Reference real asset URLs for product screenshots and logos.
```

### 30-Second LinkedIn Product Tour
```
Create a 30-second product tour video for LinkedIn.

Structure:
- Scene 1 (0-5s): Hero statement. The website's main value proposition 
  heading on the hero background color.
- Scene 2 (5-12s): Feature walkthrough. Take 3 key features from the 
  website's feature section. Show each for ~2s with product screenshots.
- Scene 3 (12-18s): Social proof. "Trusted by" section with company logos 
  scrolling as a marquee. Show a featured testimonial quote.
- Scene 4 (18-25s): Stats/metrics. Counter-animate key statistics from 
  the website (e.g., "100M+ users", "#1 on G2").
- Scene 5 (25-30s): CTA. Brand logo, primary CTA button text, website URL.

Pacing: Corporate/professional. Smooth transitions, no fast cuts.
```

### 60-Second Launch Video
```
Create a 60-second product launch video.

Structure:
- Act 1 — Hook (0-10s): 
  Start with the problem. Dark background, bold text: "Your team is using 
  12 different tools." Build tension with staggered tool names/prices 
  appearing chaotically.

- Act 2 — Solution (10-25s):
  Reveal the product. Brand logo animates in with elastic easing. 
  "One workspace. Everything your team needs." Show the hero product 
  screenshot from the website. Feature badges slide in.

- Act 3 — Proof (25-45s):
  Show social proof. Featured testimonial with company logo. 
  Stats counter-animate (users, ratings, awards). Company logos scroll 
  in a marquee. Second testimonial quote.

- Act 4 — CTA (45-60s):
  "Start saving $X/year" with the savings number from the pricing section. 
  Brand CTA button with accent color glow. Website URL. Fade to black.

Use all real content from the DESIGN.md — headings, stats, quotes, 
company names, asset URLs. Do NOT fabricate any text.
```

---

## Feature Announcements

### New Feature Highlight (15s)
```
Create a 15-second feature announcement video.

Pick ONE feature from the website (e.g., "Custom Agents", "AI Search", 
"Enterprise SSO" — whatever the newest/most prominent feature is).

- Scene 1 (0-4s): Feature name and icon on brand accent color background.
  "Introducing [Feature Name]" with subtitle.
- Scene 2 (4-10s): Feature in action. Show the product screenshot that 
  demonstrates this feature. Zoom into the relevant UI area.
- Scene 3 (10-15s): Key benefit + CTA. One sentence value prop. 
  "Try it free" button. Brand logo.
```

### Before/After Comparison (30s)
```
Create a 30-second before/after comparison video.

- Scene 1 (0-5s): "Before" — Show the problem state. Multiple tool logos 
  scattered chaotically, or a complex workflow visualization. Muted colors.
- Scene 2 (5-8s): Transition — Clean wipe to brand colors.
- Scene 3 (8-20s): "After" — Show the product solving it. Clean UI 
  screenshots from the website. Feature cards appearing one by one. 
  Stats showing improvement.
- Scene 4 (20-30s): Social proof + CTA. Testimonial quote about the 
  transformation. CTA button.
```

---

## Brand Stories

### Company Overview (30s)
```
Create a 30-second brand overview video using all sections of the captured website.

Walk through the website top-to-bottom, spending 3-5 seconds per section:
1. Hero statement and value proposition
2. Key features (show product screenshots)
3. Social proof (testimonials and logos)
4. Pricing/savings value
5. CTA

Use the website's section flow as the video's narrative arc.
Each section transitions smoothly to the next using the recommended 
transitions from the design system.
```

### Testimonial Spotlight (15s)
```
Create a 15-second testimonial spotlight video.

Pick the most impactful testimonial from the website.

- Scene 1 (0-3s): Company logo on clean background.
- Scene 2 (3-11s): The quote, revealed word-by-word or line-by-line. 
  Use the serif/display font from DESIGN.md for the quote text.
  Show the person's headshot if available in assets.
- Scene 3 (11-15s): Attribution + your brand logo. "Read the full story →"
```

---

## Technical/Developer

### API/Developer Feature (15s)
```
Create a 15-second developer-focused video.

- Scene 1 (0-5s): Code snippet on dark background. Use the monospace font 
  from DESIGN.md. Show a simple API call or integration example.
- Scene 2 (5-10s): The result — product screenshot showing what the code 
  produces. Clean transition.
- Scene 3 (10-15s): Developer CTA. "View docs →" or "Start building →" 
  with brand accent color.
```

---

## Prompt Modifiers

Add these to any prompt above to customize:

### Energy/Pacing
- **Energetic**: "Use fast cuts (2-3s per scene), bold entrances with back.out easing, aggressive stagger timing (0.08s between elements)"
- **Corporate**: "Use smooth transitions (0.6-0.8s), gentle fade-ins, generous hold time between animations"
- **Cinematic**: "Use slow reveals with power4.out easing, dramatic scale changes, long holds on key visuals"
- **Playful**: "Use bounce easing, colorful accents, quick rotation and scale pops"

### Transitions
- **Wipe**: "Use horizontal wipe transitions between scenes"
- **Crossfade**: "Use 0.5s crossfade between scenes"
- **Slide**: "Use slide-push transitions (content slides left as new content enters from right)"
- **Scale**: "Use scale-zoom transitions (zoom into a point, new scene emerges)"

### Format
- **Landscape (16:9)**: Default — 1920×1080
- **Portrait (9:16)**: "Make this for Instagram Stories/TikTok. Use 1080×1920 canvas."
- **Square (1:1)**: "Make this for Instagram feed. Use 1080×1080 canvas."

### Audio (if using TTS)
- "Add narration using /hyperframes-tts with voice am_adam"
- "Add captions synced to narration using /hyperframes-captions"

---

## Multi-Brand (Comparison Videos)

### Side-by-Side Comparison (30s)
```
I have two captured websites:
- capture-a/ (Product A)
- capture-b/ (Product B)

Create a 30-second comparison video:
- Scene 1 (0-5s): "X vs Y" title card with both brand logos
- Scene 2 (5-15s): Split screen — show equivalent features side-by-side. 
  Use Product A's colors on the left, Product B's on the right.
- Scene 3 (15-25s): Stats comparison. Show key metrics from both products 
  with counter animations.
- Scene 4 (25-30s): "Try [Winner] free" CTA with the winning product's branding.
```

---

## Quick Reference: Scene Building Blocks

| Block | Duration | Use For |
|-------|----------|---------|
| **Bold Statement** | 3-5s | Opening hooks, key messages |
| **Feature Card** | 3-4s | Individual feature highlights |
| **Product Screenshot** | 4-6s | Showing the actual product UI |
| **Stats Counter** | 3-5s | Animated numbers and metrics |
| **Testimonial Quote** | 4-6s | Social proof with attribution |
| **Logo Marquee** | 3-4s | Company logos scrolling |
| **CTA Button** | 3-4s | Closing call-to-action |
| **Transition** | 0.3-0.8s | Between scenes |
