# MSI Product Scraper

A simple Node.js script using Playwright to scrape product data from the MSI US Store. 

## Run

```bash
npm install
npx playwright install chromium
npm run scrape
```

## Output

The script extracts product details (price, specs, availability, images) and saves the result to `output/product.json`.
