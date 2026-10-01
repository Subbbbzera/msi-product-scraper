const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const URL = 'https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI'

const normalizePrice = (str) => {
  if (!str) return null
  const num = parseFloat(str.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

const normalizeAvailability = (str) => {
  if (!str) return null
  const s = str.toLowerCase().trim()
  if (s.includes('in stock')) return 'in_stock'
  if (s.includes('out of stock')) return 'out_of_stock'
  if (s.includes('pre')) return 'pre_order'
  return null
}

const getText = async (page, selector) => {
  try {
    const el = await page.$(selector)
    if (!el) return null
    return (await el.innerText()).trim() || null
  } catch { return null }
}

const getAttr = async (page, selector, attr) => {
  try {
    const el = await page.$(selector)
    if (!el) return null
    return (await el.getAttribute(attr)) || null
  } catch { return null }
}


const scrapePage = async () => {
  const browser = await chromium.launch({
    headless: false, 
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  console.log('Відкриваємо сторінку...')
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3000) 
  await page.waitForSelector('#prices-new', { timeout: 30000 })

  const finalUrl = page.url()

  const title = await getText(page, 'h2.crop-text-2.title')

  const priceRaw = await getText(page, '#prices-new')
  const price = normalizePrice(priceRaw)

  const salePriceRaw = await getText(page, '#prices-old')
  const sale_price = normalizePrice(salePriceRaw)

  const availRaw = await getText(page, '#prices-wrapper span:last-of-type')
  const availability = normalizeAvailability(availRaw)

  const brand = 'MSI'

  const category_tree = await page.evaluate(() => {
    const items = document.querySelectorAll('ul.breadcrumb li')
    return Array.from(items).map(el => {
      const a = el.querySelector('a')
      return {
        name: (a ? a.innerText : el.innerText).trim(),
        url: a ? a.href : null
      }
    }).filter(i => i.name && i.name !== '/')
  })

  const product_category = category_tree.map(i => i.name).join(' > ') || null

  const description = await getText(page, '#description-list > div:first-child')

  const allImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('#carouselImages img.product-detail-thumb-bto')
    return [...new Set(
      Array.from(imgs)
        .map(img => img.getAttribute('popup_img'))
        .filter(Boolean)
    )]
  })

  const image_url = allImages[0] || null
  const additional_image_urls = allImages.slice(1)

  const specs = await page.evaluate(() => {
    const rows = document.querySelectorAll('table.table.table-borderless tr')
    return Array.from(rows).map(row => {
      const name = row.querySelector('th')?.innerText?.trim() || null
      const value = row.querySelector('td')?.innerText?.trim() || null
      return { name, value }
    }).filter(s => s.name && s.value)
  })

  const ratingRaw = await getText(page, '#description-list-average-rating .rating-avg')
  const star_rating = ratingRaw ? parseFloat(ratingRaw) : null

  const reviewRaw = await getText(page, '#description-list-average-rating .rating-count')
  const review_count = reviewRaw ? parseInt(reviewRaw.replace(/\D/g, '')) || null : null

  const structured = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]')
    if (!el) return null
    try { return JSON.parse(el.innerText) } catch { return null }
  })

  const item_id = structured?.sku || null
  const gtin = structured?.gtin || structured?.gtin13 || null
  const mpn = structured?.mpn || null

  await browser.close()

  return {
    url: finalUrl,
    item_id,
    title,
    brand,
    product_category,
    category_tree,
    description,
    price,
    sale_price,
    availability,
    image_url,
    additional_image_urls,
    specs,
    star_rating,
    review_count,
    gtin,
    mpn,
    scraped_at: new Date().toISOString()
  }
}

const saveResult = (data) => {
  const dir = path.join(__dirname, '..', 'output')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  const filePath = path.join(dir, 'product.json')
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Збережено: ${filePath}`)
}

const main = async () => {
  try {
    console.log('Починаємо скрепінг...')
    const result = await scrapePage()
    saveResult(result)
    console.log('\n=== Результат ===')
    console.log('Title:', result.title)
    console.log('Price:', result.price)
    console.log('Availability:', result.availability)
    console.log('Specs знайдено:', result.specs.length)
    console.log('Images знайдено:', result.additional_image_urls.length + 1)
  } catch (e) {
    console.error('Помилка:', e.message)
    process.exit(1)
  }
}

main()