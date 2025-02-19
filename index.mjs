import puppeteer from 'puppeteer';

(async () => {
    const gpu = 'RTX 5090'; // Define the GPU model

    const browser = await puppeteer.launch({
        headless: true, // Set to true for production
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const query = encodeURIComponent(gpu);

    const bestBuyStores = [
        { 
            name: 'Best Buy US', 
            location: 'US', 
            baseUrl: 'https://www.bestbuy.com/?intl=nosplash', 
            searchUrl: `https://www.bestbuy.com/site/searchpage.jsp?st=${query}`,
        },
        { 
            name: 'Best Buy Canada', 
            location: 'Canada', 
            baseUrl: 'https://www.bestbuy.ca/en-ca', 
            searchUrl: `https://www.bestbuy.ca/en-ca/search?search=${query}`,
        }
    ];

    for (const store of bestBuyStores) {
        

        let allResults = [];

        // **Best Buy US Parsing**
        if (store.location === 'US') {
            console.log(`\n🔍 Checking availability on ${store.name} (${store.location})...`);
        
            await page.goto(store.baseUrl, { waitUntil: 'domcontentloaded' });
            console.log(`✅ Navigated to ${store.name} homepage.`);
        
            await page.goto(store.searchUrl, { waitUntil: 'domcontentloaded' });
            console.log(`✅ Searching for ${gpu} at ${store.name}...`);
        
            // Extract total item count
            let itemCount = await page.evaluate(() => {
                let itemCountElement = document.querySelector('.item-count');
                return itemCountElement ? itemCountElement.innerText.replace(/\D/g, '') : '0';
            });
        
            console.log(`📌 Total Items Found: ${itemCount}`); 
        
            // Extract and filter products based on GPU
            allResults = await page.evaluate((gpu) => {
                let products = [];
                let items = document.querySelectorAll('.sku-item-list .sku-item');
        
                items.forEach(item => {
                    let titleElement = item.querySelector('.sku-title a');
                    let title = titleElement ? titleElement.innerText.trim() : '';
        
                    // **Filter by GPU (case-insensitive)**
                    if (!title.toLowerCase().includes(gpu.toLowerCase())) return;
        
                    let priceElement = item.querySelector('.priceView-hero-price span');
                    let priceText = priceElement ? priceElement.innerText.trim().replace(/[^0-9.]/g, '') : '0';
                    let price = priceText ? `$${priceText}` : 'N/A';
        
                    let stockElement = item.querySelector('.fulfillment-add-to-cart-button');
                    let availability = stockElement ? stockElement.innerText.trim().replace(/\s+/g, ' ') : 'Out of Stock';
        
                    products.push({ title, price, availability, location: 'US' });
                });
        
                return products;
            }, gpu); // **Pass the `gpu` variable into evaluate()**
        
            console.log(`✅ Extracted ${allResults.length} results matching "${gpu}".`);
            console.table(allResults.length ? allResults : [{ title: 'No matching products found', price: '-', availability: '-', location: store.location }]);
        }
        

        else if (store.location === 'Canada') {
            console.log(`✅ Navigating to ${store.searchUrl}`);
            
            // Navigate to Best Buy Canada search page
            await page.goto(store.searchUrl, { waitUntil: 'networkidle2' });
        
            // **Handle Location Popup**
            try {
                await page.waitForSelector('.button_1Ov0K', { timeout: 3000 });
                console.log("📍 Location prompt detected. Dismissing...");
                let locationButtons = await page.$$('.button_1Ov0K');
                if (locationButtons.length > 2) {
                    await locationButtons[2].click(); // "Never Allow" button
                    await page.waitForTimeout(1000);
                }
            } catch (error) {
                console.log("✅ No location popup found.");
            }
        
            // **Handle Privacy Banner**
            try {
                await page.waitForSelector('button[data-testid="accept-privacy-policy"]', { timeout: 3000 });
                console.log("🍪 Privacy policy banner detected. Accepting...");
                await page.click('button[data-testid="accept-privacy-policy"]');
                await page.waitForTimeout(1000);
            } catch (error) {
                console.log("✅ No privacy policy banner found.");
            }
        
            // **Wait for Product Listings with Improved Timeout**
            try {
                await page.waitForFunction(() => {
                    return document.querySelectorAll('.x-productListItem').length > 0;
                }, { timeout: 10000 });
        
                console.log("✅ Page is fully loaded, starting data extraction...");
            } catch (error) {
                console.log("❌ Product list did not load in time. Taking a screenshot for debugging...");
                await page.screenshot({ path: 'debug.png', fullPage: true });
                throw new Error("Timeout waiting for product list.");
            }
        
            // **Extract Total Product Count**
            let productCount = await page.evaluate(() => {
                let countElement = document.querySelector('[data-testid="PRODUCT_LIST_RESULT_COUNT_DATA_AUTOMATION"]');
                return countElement ? parseInt(countElement.innerText.replace(/\D/g, ''), 10) || 0 : 0;
            });
        
            console.log(`📊 Total Products Found: ${productCount}`);
        
            let allResults = await page.evaluate((gpu) => {
                let products = [];
                let items = document.querySelectorAll('.x-productListItem');
            
                items.forEach(item => {
                    // **Extract & Truncate Title (Max: 70 chars)**
                    let titleElement = item.querySelector('h3[data-automation="productItemName"]');
                    let title = titleElement ? titleElement.textContent.trim() : 'No Title';
                    if (title.length > 70) {
                        title = title.substring(0, title.lastIndexOf(" ", 70)) + "...";
                    }
            
                    // **Filter Products by Title (Case-Insensitive)**
                    if (!title.toLowerCase().includes(gpu.toLowerCase())) return;
            
                    // **Extract Price**
                    let priceElement = item.querySelector('.productPricingContainer_3gTS3 div[aria-hidden="true"]');
                    let price = priceElement ? priceElement.textContent.replace(/[^0-9.,]/g, '').trim() : 'N/A';
                    if (price !== 'N/A') price = `$${price}`; // Format price correctly
            
                    // **Extract Availability**
                    let availabilityElement = item.querySelector('.availabilityMessageSearch_1KfqF') || item.querySelector('.container_1DAvI');
                    let availability = availabilityElement ? availabilityElement.innerText.trim() : 'Unavailable';
            
                    products.push({ title, price, availability });
                });
            
                return products;
            }, gpu); // Pass `gpu` into the evaluate function
            
            console.log(`✅ Extracted ${allResults.length} products matching "${gpu}".`);
            console.table(allResults); 
        
            return { productCount, allResults };   
        }
        
        
        

        
    }

    //await browser.close(); 
})();
