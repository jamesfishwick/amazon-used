const { chromium } = require('playwright');

// Helper function to check if text indicates digital/Kindle format
function isDigitalFormat(text) {
  const lowerText = text.toLowerCase();
  return lowerText.includes('kindle') ||
         lowerText.includes('ebook') ||
         lowerText.includes('e-book') ||
         lowerText.includes('audiobook') ||
         lowerText.includes('audible') ||
         lowerText.includes('mp3 cd') ||
         lowerText.includes('digital');
}

async function findLowestPrice(page, asin, title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📚 ANALYZING: "${title}"`);
  console.log(`🔑 ASIN: ${asin}`);

  // Check if this is likely a Kindle book
  if (asin.startsWith('B0')) {
    console.log(`⚠️  WARNING: ASIN starts with B0 - likely a Kindle/Digital edition`);
  }

  console.log(`${'='.repeat(80)}`);

  const prices = [];

  try {
    // Navigate to the product page
    const productUrl = `https://www.amazon.com/dp/${asin}`;
    console.log(`\n🔗 Navigating to: ${productUrl}`);

    try {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      console.log(`⚠️  Navigation timeout, continuing anyway...`);
    }

    await page.waitForTimeout(3000);

    // Check current format and look for physical format links
    const formatLinks = await page.$$('a.a-button-text[role="button"], .bookFormat a, #tmmSwatches .a-button-text');
    const formats = [];

    for (const link of formatLinks) {
      const text = await link.textContent();
      formats.push(text.trim());
    }

    console.log(`📖 Available formats detected: ${formats.join(', ')}`);

    // Check if current page is Kindle/Digital
    const pageTitle = await page.title();
    const bodyText = await page.textContent('body');
    const isKindlePage = isDigitalFormat(pageTitle) || isDigitalFormat(bodyText);

    if (isKindlePage) {
      console.log(`📱 Current page is KINDLE/DIGITAL format`);

      // Try to find and click physical format link
      const physicalFormats = ['Paperback', 'Hardcover', 'Mass Market', 'Audio CD', 'Vinyl'];
      let switchedFormat = false;

      for (const format of physicalFormats) {
        try {
          const formatButton = await page.$(`a.a-button-text:has-text("${format}"), .bookFormat a:has-text("${format}")`);
          if (formatButton) {
            console.log(`🔄 Switching to ${format} format...`);
            await formatButton.click();
            await page.waitForTimeout(3000);
            switchedFormat = true;

            // Update ASIN from new page
            const newUrl = page.url();
            const newAsinMatch = newUrl.match(/\/dp\/([A-Z0-9]{10})/);
            if (newAsinMatch && newAsinMatch[1] !== asin) {
              asin = newAsinMatch[1];
              console.log(`✅ Switched to ${format} - New ASIN: ${asin}`);
            }
            break;
          }
        } catch (e) {
          // Try next format
        }
      }

      if (!switchedFormat) {
        console.log(`⚠️  Could not find physical format link - may only be available as Kindle`);
      }
    } else {
      console.log(`📚 Current page appears to be PHYSICAL format`);
    }

    // Method 1: Get the main listing price (only if not Kindle page)
    if (!isKindlePage) {
      try {
        const mainPriceSelectors = [
          '.a-price[data-a-color="price"] .a-offscreen',
          '.a-price .a-offscreen',
          '#price_inside_buybox',
          '#priceblock_ourprice',
          '#priceblock_dealprice'
        ];

        for (const selector of mainPriceSelectors) {
          const priceElement = await page.$(selector);
          if (priceElement) {
            const priceText = await priceElement.textContent();
            const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
            if (priceMatch) {
              const price = parseFloat(priceMatch[1].replace(',', ''));
              console.log(`\n💰 MAIN LISTING PRICE: $${price.toFixed(2)}`);
              prices.push({
                price,
                type: 'Main Listing',
                condition: 'New',
                source: 'Product Page'
              });
              break;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not find main listing price: ${error.message}`);
      }
    } else {
      console.log(`\n⏩ Skipping main listing price (Kindle/Digital page)`);
    }

    // Method 2: Try to click "See all buying options" or similar button
    try {
      const buyingOptionsSelectors = [
        'a:has-text("See all buying options")',
        'a:has-text("Other Sellers on Amazon")',
        '#buybox-see-all-buying-choices a',
        'a[href*="all-offers-display"]',
        'a.a-popover-trigger:has-text("buying options")'
      ];

      let clicked = false;
      for (const selector of buyingOptionsSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            console.log(`\n🖱️  Clicking: "${selector}"`);
            await button.click();
            await page.waitForTimeout(2000);
            clicked = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (clicked) {
        console.log(`✅ Side drawer/modal should be open`);

        // Extract prices from the drawer
        const offerDivs = await page.$$('[data-csa-c-content-id*="offer"], [id*="aod-offer"], .aod-offer, [id*="all-offers-display"]');

        console.log(`\n📦 Found ${offerDivs.length} potential offer containers`);

        for (let i = 0; i < Math.min(offerDivs.length, 10); i++) {
          try {
            const offerText = await offerDivs[i].textContent();

            // Skip if this is a digital/Kindle offer
            if (isDigitalFormat(offerText)) {
              console.log(`   ⏩ Skipping digital/Kindle offer in drawer`);
              continue;
            }

            // Look for price pattern
            const priceMatches = offerText.match(/\$(\d+\.\d{2})/g);
            if (priceMatches) {
              for (const priceText of priceMatches) {
                const price = parseFloat(priceText.replace('$', ''));

                // Determine condition
                let condition = 'New';
                let type = 'New';
                const lowerText = offerText.toLowerCase();

                if (lowerText.includes('used')) {
                  type = 'Used';
                  if (lowerText.includes('like new')) condition = 'Used - Like New';
                  else if (lowerText.includes('very good')) condition = 'Used - Very Good';
                  else if (lowerText.includes('good')) condition = 'Used - Good';
                  else if (lowerText.includes('acceptable')) condition = 'Used - Acceptable';
                  else condition = 'Used';
                } else if (lowerText.includes('refurbished')) {
                  type = 'Refurbished';
                  condition = 'Refurbished';
                }

                // Filter out unreasonable prices and duplicates
                if (price >= 1 && price <= 500) {
                  const isDuplicate = prices.some(p => Math.abs(p.price - price) < 0.01);
                  if (!isDuplicate) {
                    prices.push({
                      price,
                      type,
                      condition,
                      source: 'Side Drawer'
                    });
                    console.log(`   ✅ Found: $${price.toFixed(2)} (${condition}) from drawer`);
                  }
                }
              }
            }
          } catch (e) {
            // Skip this offer
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not open/parse side drawer: ${error.message}`);
    }

    // Method 3: Navigate to full offers page
    try {
      const offersUrl = `https://www.amazon.com/dp/${asin}/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL`;
      console.log(`\n🔗 Navigating to full offers page: ${offersUrl}`);

      try {
        await page.goto(offersUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {
        console.log(`⚠️  Navigation timeout, continuing anyway...`);
      }

      await page.waitForTimeout(4000);

      // Wait for the all-offers-display div to load
      const allOffersDiv = await page.$('#all-offers-display, #aod-offer-list, [id*="aod-offer"]');

      if (allOffersDiv) {
        console.log(`✅ Found offers display section`);

        // Take a screenshot for debugging
        await page.screenshot({ path: `offers-page-${asin}.png`, fullPage: true });
        console.log(`📸 Screenshot saved: offers-page-${asin}.png`);

        const offersText = await allOffersDiv.textContent();

        // Check if there are no sellers
        if (offersText.toLowerCase().includes('currently, there are no other sellers')) {
          console.log(`ℹ️  No other sellers available`);
        } else {
          // Extract all price elements - be very specific to avoid "You May Also Like" section
          // Look for the actual offer containers with seller info
          const priceElements = await page.$$('#aod-offer-list [id^="aod-offer-"] .a-price .a-offscreen, #aod-offer .a-price .a-offscreen, #aod-pinned-offer .a-price .a-offscreen');
          console.log(`📋 Found ${priceElements.length} price elements on offers page`);

          for (const priceEl of priceElements) {
            try {
              const priceText = await priceEl.textContent();
              const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);

              if (priceMatch) {
                const itemPrice = parseFloat(priceMatch[1].replace(',', ''));

                // Get surrounding context to determine condition AND shipping
                const parent = await priceEl.evaluateHandle(el => {
                  // Go up a few levels to get the offer container
                  let container = el.parentElement;
                  for (let i = 0; i < 5; i++) {
                    if (container.parentElement) container = container.parentElement;
                  }
                  return container;
                });

                const contextText = await parent.evaluate(el => el.textContent);
                const lowerContext = contextText.toLowerCase();

                let condition = 'New';
                let type = 'New';

                if (lowerContext.includes('used')) {
                  type = 'Used';
                  if (lowerContext.includes('like new')) condition = 'Used - Like New';
                  else if (lowerContext.includes('very good')) condition = 'Used - Very Good';
                  else if (lowerContext.includes('good')) condition = 'Used - Good';
                  else if (lowerContext.includes('acceptable')) condition = 'Used - Acceptable';
                  else condition = 'Used';
                } else if (lowerContext.includes('refurbished')) {
                  type = 'Refurbished';
                  condition = 'Refurbished';
                }

                // Extract shipping cost
                let shippingCost = 0;
                const shippingMatch = contextText.match(/\+\s*\$?([\d,]+\.?\d*)\s*shipping/i);
                if (shippingMatch) {
                  shippingCost = parseFloat(shippingMatch[1].replace(',', ''));
                } else if (lowerContext.includes('free shipping') || lowerContext.includes('free delivery')) {
                  shippingCost = 0;
                }

                const totalPrice = itemPrice + shippingCost;

                // Filter for books (exclude digital)
                if (isDigitalFormat(contextText)) {
                  console.log(`   ⏩ Skipping digital format: $${itemPrice.toFixed(2)}`);
                } else if (totalPrice >= 1 && totalPrice <= 500) {
                  const isDuplicate = prices.some(p => Math.abs(p.price - totalPrice) < 0.01);
                  if (!isDuplicate) {
                    prices.push({
                      price: totalPrice,
                      itemPrice,
                      shippingCost,
                      type,
                      condition,
                      source: 'All Offers Page'
                    });
                    if (shippingCost > 0) {
                      console.log(`   ✅ Found: $${itemPrice.toFixed(2)} + $${shippingCost.toFixed(2)} shipping = $${totalPrice.toFixed(2)} (${condition})`);
                    } else {
                      console.log(`   ✅ Found: $${totalPrice.toFixed(2)} (${condition}) with free shipping`);
                    }

                    // Save detailed context for debugging
                    const fs = require('fs');
                    const debugFile = `price-debug-${asin}.txt`;
                    const debugData = `
═══════════════════════════════════════════════════════════════════════
Price: $${totalPrice.toFixed(2)} (Item: $${itemPrice.toFixed(2)}, Shipping: $${shippingCost.toFixed(2)})
Condition: ${condition}
Type: ${type}
Source: All Offers Page
Context (first 500 chars):
${contextText.substring(0, 500)}
═══════════════════════════════════════════════════════════════════════
`;
                    fs.appendFileSync(debugFile, debugData);
                  } else {
                    console.log(`   ⏩ Skipping duplicate: $${totalPrice.toFixed(2)}`);
                  }
                } else {
                  console.log(`   ⏩ Price out of range: $${totalPrice.toFixed(2)}`);
                }
              }
            } catch (e) {
              // Skip this price element
            }
          }
        }
      } else {
        console.log(`⚠️  Could not find all-offers-display div`);
      }
    } catch (error) {
      console.log(`⚠️  Could not navigate to offers page: ${error.message}`);
    }

  } catch (error) {
    console.error(`❌ ERROR analyzing ${asin}:`, error.message);
  }

  // Sort prices and display results
  const sortedPrices = prices.sort((a, b) => a.price - b.price);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 RESULTS FOR: "${title}"`);
  console.log(`${'─'.repeat(80)}`);

  if (sortedPrices.length === 0) {
    console.log(`❌ No prices found`);
  } else {
    console.log(`\n🎯 LOWEST PRICE: $${sortedPrices[0].price.toFixed(2)} (${sortedPrices[0].type} - ${sortedPrices[0].condition})`);
    console.log(`📍 Source: ${sortedPrices[0].source}`);

    if (sortedPrices.length > 1) {
      console.log(`\n📋 All ${sortedPrices.length} prices found (sorted lowest to highest):`);
      sortedPrices.forEach((p, idx) => {
        const breakdown = p.shippingCost !== undefined
          ? `($${p.itemPrice.toFixed(2)} + $${p.shippingCost.toFixed(2)} ship)`
          : '';
        console.log(`   ${idx + 1}. $${p.price.toFixed(2).padStart(8)} ${breakdown.padEnd(25)} - ${p.type.padEnd(12)} - ${p.condition.padEnd(20)} [${p.source}]`);
      });
    }
  }

  console.log(`${'='.repeat(80)}\n`);

  return sortedPrices;
}

async function main() {
  console.log('🚀 Starting Amazon Wishlist Price Checker Test\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Navigate to wishlist
    const wishlistUrl = 'https://www.amazon.com/hz/wishlist/ls/3DFK5C9F229Y5/ref=nav_wishlist_lists_1';
    console.log(`📋 Navigating to wishlist: ${wishlistUrl}\n`);

    try {
      await page.goto(wishlistUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log(`⚠️  Navigation timeout, but continuing anyway...`);
      await page.screenshot({ path: 'wishlist-debug.png' });
      console.log(`📸 Screenshot saved to wishlist-debug.png`);
    }

    await page.waitForTimeout(5000);

    // Get top 3 items - extract all data first before navigating
    const items = await page.$$('li[data-id][data-itemid]');
    console.log(`✅ Found ${items.length} items in wishlist\n`);

    const top3Items = [];
    for (let i = 0; i < Math.min(3, items.length); i++) {
      const item = items[i];

      // Extract ASIN
      let asin = null;
      const reposParams = await item.getAttribute('data-reposition-action-params');
      if (reposParams) {
        try {
          const params = JSON.parse(reposParams);
          if (params.itemExternalId) {
            const match = params.itemExternalId.match(/ASIN:([A-Z0-9]{10})/);
            if (match) asin = match[1];
          }
        } catch (e) {}
      }

      // Extract title
      const titleEl = await item.$('h2 a, h3 a, a[id*="itemName"]');
      const title = titleEl ? await titleEl.textContent() : 'Unknown Title';

      if (asin) {
        top3Items.push({
          asin,
          title: title.trim()
        });
      }
    }

    console.log(`📝 Extracted ${top3Items.length} items to analyze\n`);

    // Now process each item
    const results = [];
    for (let i = 0; i < top3Items.length; i++) {
      const { asin, title } = top3Items[i];
      console.log(`\n📖 Item ${i + 1}/3: "${title}"`);
      const prices = await findLowestPrice(page, asin, title);
      results.push({
        title,
        asin,
        prices
      });

      // Small delay between items
      await page.waitForTimeout(2000);
    }

    // Final summary
    console.log(`\n\n${'█'.repeat(80)}`);
    console.log(`                         FINAL SUMMARY - TOP 3 BOOKS`);
    console.log(`${'█'.repeat(80)}\n`);

    results.forEach((result, idx) => {
      console.log(`${idx + 1}. "${result.title}"`);
      console.log(`   ASIN: ${result.asin}`);
      if (result.prices.length > 0) {
        const lowest = result.prices[0];
        let priceDisplay = `$${lowest.price.toFixed(2)}`;
        if (lowest.shippingCost !== undefined && lowest.shippingCost > 0) {
          priceDisplay += ` ($${lowest.itemPrice.toFixed(2)} + $${lowest.shippingCost.toFixed(2)} shipping)`;
        }
        console.log(`   🎯 LOWEST: ${priceDisplay} (${lowest.type} - ${lowest.condition})`);
      } else {
        console.log(`   ❌ No prices found`);
      }
      console.log('');
    });

    console.log(`${'█'.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    console.log('\n⏸️  Browser will remain open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

main();
