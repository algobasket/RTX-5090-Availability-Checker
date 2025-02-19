import puppeteer from 'puppeteer';

(async () => {
    // Define the GPU model
    const gpu = 'RTX 5080';  // Change this value to search for a different GPU

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });

    const query = encodeURIComponent(gpu);

    const stores = [
        { name: 'Best Buy', url: `https://www.bestbuy.com/site/searchpage.jsp?st=${query}` },
        { name: 'Micro Center', url: `https://www.microcenter.com/search/search_results.aspx?Ntt=${query}` },
        { name: 'Walmart', url: `https://www.walmart.com/search?q=${query}` },
        { name: 'Newegg', url: `https://www.newegg.com/p/pl?d=${query}` },
        { name: 'Amazon', url: `https://www.amazon.com/s?k=${query}` }
    ];

    for (const store of stores) {
        console.log(`\n🔍 Checking availability on ${store.name}...`);

        await page.goto(store.url, { waitUntil: 'domcontentloaded' });

        // Extract product details
        let results = await page.evaluate(() => {
            let products = [];
            let items = document.querySelectorAll('[data-testid="product-title"], .product-title, .item-title, .title, .s-title-instructions-style');

            items.forEach(item => {
                let title = item.innerText.trim();
                let priceElement = item.closest('div')?.querySelector('.priceView-hero-price span, .price, .price-current, .a-price-whole');
                let price = priceElement ? priceElement.innerText.trim() : 'Price not available';

                let stockElement = item.closest('div')?.querySelector('.availability, .fulfillment-fulfillment-summary, .stock, .a-color-success');
                let availability = stockElement ? stockElement.innerText.trim() : 'Stock info not found';

                products.push({ title, price, availability });
            });

            return products; 
        });

        console.table(results.length ? results : [{ title: 'No products found', price: '-', availability: '-' }]);
    }

    await browser.close();
})();
