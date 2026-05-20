# RH Sports & Leisure — E-commerce Site

## Overview
A simple, static e-commerce site for camping & fishing equipment. Products are loaded from a CSV file — no backend required. The owner updates products by editing `products.csv` and refreshing the page.

## Key Requirements
- **Pure static site** — HTML5, CSS3, vanilla JavaScript. No frameworks, no build step.
- **CSV-driven catalogue** — Use PapaParse (CDN) to parse `products.csv` client-side.
- **CSV format** — Columns: `Page,Category,Product Name,Price (£),Condition,Description,image split('|')`
  - Page = top-level category (Course, Sea, Game, Swap Shop)
  - Category = sub-category (Rods, Reels, Terminal Tackle, Camping & Bivvy, etc.)
  - Condition = New, Used, Used - Good, Used - Very Good
  - Price can be numeric or text like "Open to Offers"
- **Brand**: RH Sports & Leisure
- **Categories**: Course Fishing, Sea Fishing, Game Fishing, Swap Shop
- **Sub-categories**: Rods, Reels, Terminal Tackle (+ others in Swap Shop)

## Design Guidelines
- Clean, professional, dark green/outdoor colour scheme
- Responsive — mobile-first
- Product cards: image (placeholder if none), name, price, condition badge, description preview
- Category navigation: top nav bar or sidebar
- Search bar for filtering products by name/description
- Swap Shop section should feel slightly different (community marketplace vibe)

## File Structure
```
index.html          — main page, all-in-one SPA
css/styles.css      — all styling
js/app.js           — CSV loading, filtering, rendering logic
products.csv        — product data (owner edits this)
images/             — any local images
README.md           — instructions for the owner on how to update products
```

## Constraints
- No server-side code — must work opened as a local file OR served from any static host
- PapaParse loaded from CDN: https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js
- If opened via file:// protocol, CSV fetch may be blocked — include a note in README about using a simple local server (e.g., `npx serve`) or hosting on Netlify/GitHub Pages
- Images: use product image URL from CSV if provided; show a tasteful placeholder if not
