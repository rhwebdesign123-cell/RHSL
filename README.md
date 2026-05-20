# RH Sports & Leisure — Website Instructions

## Overview

This is your product catalogue website. It loads products automatically from `products.csv` — no coding required to update the shop. Simply edit the CSV file and refresh the page.

---

## How to Update Your Products

### Using Excel or Google Sheets

1. Open `products.csv` in Excel, Google Sheets, or any spreadsheet app.
2. Add, edit or remove rows.
3. **Save as CSV** (comma-separated values) — keep the filename `products.csv`.
4. Replace the old file in this folder with your new one.
5. Refresh the website.

### Column Format

| Column | Description | Example |
|---|---|---|
| `Page` | Top-level category | `Course`, `Sea`, `Game`, or `Swap Shop` |
| `Category` | Sub-category | `Rods`, `Reels`, `Terminal Tackle`, `Camping & Bivvy` |
| `Product Name` | Full product name | `Shimano Baitrunner DL 6000` |
| `Price (£)` | Numeric price or text | `89.99` or `Open to Offers` |
| `Condition` | One of the set values below | `New` |
| `Description` | Optional product description | `Great beginner reel, used two seasons.` |
| `picture url` | Optional image URL | `https://example.com/image.jpg` |

#### Valid Condition Values
- `New`
- `Used`
- `Used - Good`
- `Used - Very Good`

#### Pages (Top-level categories)
- `Course` — coarse/carp fishing
- `Sea` — sea fishing
- `Game` — fly fishing for trout and salmon
- `Swap Shop` — community marketplace items

---

## Adding Product Images

Place the image URL in the last column (`picture url`).

**Option A — External URL (easiest):**
```
https://cdn.example.com/my-product-photo.jpg
```
You can use images hosted on your own website, eBay listings, or an image host like Imgur.

**Option B — Local image:**
1. Put your image file in the `images/` folder inside this project.
2. Enter the path: `images/my-photo.jpg`

If no image URL is provided, a fishing-themed illustration placeholder is shown automatically.

---

## Adding a New Category

Simply use a new value in the `Page` or `Category` column. The website reads these dynamically — new categories will appear in the navigation automatically.

---

## Running the Site Locally

> **Note:** Due to browser security restrictions, the site cannot load `products.csv` when opened as a plain file (`file://`). You must use a simple local server.

### Option 1 — npx serve (recommended, no install needed)
```
npx serve
```
Then open **http://localhost:3000** in your browser.

### Option 2 — VS Code Live Server
If you use VS Code, right-click `index.html` → **Open with Live Server**.

### Option 3 — Python (if installed)
```
python -m http.server 8000
```
Then open **http://localhost:8000**.

---

## Hosting Online (Free)

### Netlify (easiest — drag and drop)
1. Go to [netlify.com](https://netlify.com) and sign up for free.
2. Drag your entire project folder onto the Netlify dashboard.
3. Your site is live instantly at a `*.netlify.app` URL.
4. To update products: drag the folder again, or connect to GitHub for automatic deploys.

### GitHub Pages
1. Create a free GitHub account and a new repository.
2. Upload all files to the repository.
3. Go to **Settings → Pages → Source** and select the main branch.
4. Your site is live at `https://yourusername.github.io/your-repo-name`.

---

## File Structure

```
index.html          Main website page
products.csv        Your product data — edit this to update the shop
css/
  styles.css        All styling
js/
  app.js            Loads and filters products from the CSV
images/             Optional folder for local product images
README.md           This file
```

---

## Tips

- Keep product names clear and descriptive — they're searchable.
- If a description contains a comma, wrap the whole field in double quotes in the CSV.
- Descriptions can be multi-line — wrap the field in double quotes.
- Prices can be left blank or written as text (e.g. `Open to Offers`) — the site handles both.
- Sort order defaults to the order rows appear in the CSV within each category.

---

*Site built for RH Sports & Leisure. Pure HTML/CSS/JS.*
# Fishingecom
