# Design System

## Overview
Stripe's visual personality is defined by "High-Fidelity Minimalism." The system uses high-density information layouts paired with ethereal, animated gradients (the signature "mesh gradient" look). It strikes a balance between professional financial infrastructure and cutting-edge software engineering. Key characteristics include extreme typographic precision, fluid motion cues (the hero "wave"), and a layered UI approach that simulates physical depth through soft shadows and sophisticated border treatments. The layout is structured on a strict grid with significant responsive adaptations, transitioning from dense 12-column desktop views to simplified vertical stacks on mobile.

## Colors

### Brand & Core
- **Primary Brand**: #635bff (Stripe Purple / Brand 500)
- **Text Solid**: #0a2540 (Dark Navy)
- **Text Soft**: #424770 (Slate Blue)
- **Background Subdued**: #f6f9fc (Light Gray/Blue tint)
- **White**: #ffffff

### Semantic & Accents
- **Action Text**: #00d4ff (Electric Blue accent)
- **Accent Magenta**: #ea2261 (Connect product accent)
- **Accent Orange**: #ff6118 (Payments/Agentic accent)
- **Accent Yellow**: #fc5 (Billing/Startups accent)
- **Border Quiet**: #e6ebf1 (Soft UI borders)

## Typography
- **Primary Font**: Sohne-var (Custom sans-serif). Used for all body and headings. Characteristics: Geometric but legible, varied weights from 300 (Light) to 700 (Bold).
- **Code Font**: SourceCodePro (Monospace). Used for API references and developer-centric components.
- **Hierarchy**:
  - **Hero Title**: Variable sizing (max-width 32ch), ~3.5rem on desktop, tight line-height (1.15).
  - **Section Headings**: `hds-heading--lg` (~2rem desktop), `hds-heading--md` (~1.625rem).
  - **Body Text**: `hds-font-text-md` (~0.875rem to 1rem) with high tracking/line-height for readability (1.4).

## Elevation
- **Surface Layering**: Uses `isolation: isolate` to manage complex animated background layers.
- **Shadows**:
  - `hds-shadow-md`: 0 6px 22px rgba(0, 55, 112, 0.1) for floating cards.
  - `hds-canary-ui-shadow`: 0 16px 32px rgba(50, 50, 93, 0.12) for dashboard-style graphic cards.
- **Borders**: Heavy reliance on 1px solid or dashed borders (`1px dashed #e5edf5`) instead of heavy shadows for separating content sections.

## Components
- **Navigation**: A sophisticated mega-menu with blur effects (`backdrop-filter: blur(5px)`) and animated chevron transitions.
- **Bento Cards**: Interactive grid items with localized gradient "blobs" (`--bento-left-blob`) and nested graphics.
- **Logo Carousel**: A continuous marquee featuring SVG partner logos with grayscale-to-color hover transitions.
- **Interactive Graphics**: Pseudo-dashboard UI components (Tax, Invoicing, Connect) that use CSS transforms and absolute positioning to simulate product interfaces.
- **Buttons**: 
  - **Primary**: Solid background with a slight pill-shape border-radius.
  - **Secondary**: Ghost style with `hds-icon-hover-arrow` that animates on hover.

## Do's and Don'ts
- **Do**: Use 1px dashed borders to separate high-level footer categories.
- **Do**: Apply `text-wrap: pretty` or `balance` to headings to prevent widows.
- **Don't**: Use generic drop shadows; use the specific color-mixed elevations defined in the HDS system.
- **Do**: Use subtle mesh gradients in background layers to provide depth without distracting from text.
- **Don't**: Overcomplicate mobile layouts; collapse multi-column desktop grids into single-column stacks.

## Assets

### Fonts
- **Sohne Variable**: https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/media/Sohne.cb178166.woff2
- **Source Code Pro**: https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/media/SourceCodePro-Medium.f5ba3e6a.woff2
- **Sohne (Alt Path)**: https://stripe.com/mkt-ssr-statics/assets/_next/static/media/Sohne.cb178166.woff2
- **Source Code Pro (Alt Path)**: https://stripe.com/mkt-ssr-statics/assets/_next/static/media/SourceCodePro-Medium.f5ba3e6a.woff2

### Images
- **Personalize Background**: https://images.ctfassets.net/fzn2n1nzq965/243SyQMmyCkQOj9SIYcV9m/9ca6154f96e65aa92bb35401e70f3725/Frame_2147247494.png
- **Decagon Logo**: https://images.stripeassets.com/fzn2n1nzq965/1hreJwxuVJ5ucPtuA7pRKH/3c5630387bca898d01ae17fc7ae2890a/decagon.png?w=432&fm=webp&q=90
- **Connect Bento Background**: https://images.stripeassets.com/fzn2n1nzq965/1j4wM9h2bBsyRFvTv6Wsn0/07f4b9b1e1e17fdc509d9087454dd8bc/ConnectBentoBackground.jpg?w=1242&fm=webp&q=90
- **Agentic Mobile Graphic**: https://images.stripeassets.com/fzn2n1nzq965/1k7ckFceNFlxqF47hWJUlM/eaa4d8b3f8e4b76ba3dd7df7da88e099/the-happenings-agentic-mobile.png?w=336&fm=webp&q=90
- **Browserbase Case Study**: https://images.stripeassets.com/fzn2n1nzq965/1NiQJZA0rKbwXZ7mD4BCrM/0abdaba77e564f858a33241a9aab0939/browserbase.png?w=432&fm=webp&q=90
- **The Quincunx Book Cover**: https://images.stripeassets.com/fzn2n1nzq965/2gq7OxrRa1Ee5L8uFUX75n/2398783b25e6c09d095a94e8bae4b1e4/TheQuincunx.png?w=296&fm=webp&q=90
- **Connect Mobile Background**: https://images.stripeassets.com/fzn2n1nzq965/43eqkFV1GG5GqcbNNeEzVp/8f4705b1b80a4c835c2960ed8055d649/ConnectMobileBackground.jpg?w=1104&fm=webp&q=90
- **Sessions Banner**: https://images.stripeassets.com/fzn2n1nzq965/5cRV5XgALGMWv62qKuH0Rw/f0429f90b5731f51c44c47b187626bbd/sessions-banner-background_2x.png?w=1232&fm=webp&q=90
- **Retailers Mobile Graphic**: https://images.stripeassets.com/fzn2n1nzq965/7EVLwfXmG3pl1vhBssMrFB/b6d8612b1f567922c1355d864c279678/the-happenings-payment-retailers-mobile.png?w=336&fm=webp&q=90
