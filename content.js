// Cheapest Read - Content Script

// Configuration
const DEBUG_MODE = true;
const BATCH_SIZE = 3;
const DELAY_BETWEEN_ITEMS = 1500; // 1.5 seconds between items to avoid rate limiting

// Global state
const processedASINs = new Set();
let isProcessing = false;

// Function to extract price from text
function extractPrice(priceText) {
  if (!priceText) return null;
  const match = priceText.match(/\$?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Function to extract ASIN from item
function extractASIN(item) {
  // Method 1: From data-reposition-action-params (most reliable for wishlists)
  const reposParams = item.getAttribute("data-reposition-action-params");
  if (reposParams) {
    try {
      const params = JSON.parse(reposParams);
      if (params.itemExternalId) {
        const match = params.itemExternalId.match(/ASIN:([A-Z0-9]{10})/);
        if (match) return match[1];
      }
    } catch (_e) {
      // Ignore parse errors
    }
  }

  // Method 2: From product link
  const productLink = item.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
  if (productLink) {
    const match = productLink.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (match) return match[1];
  }

  // Method 3: data-asin attribute
  const dataAsin = item.getAttribute("data-asin");
  if (dataAsin?.match(/^[A-Z0-9]{10}$/)) {
    return dataAsin;
  }

  return null;
}

// Function to find wishlist items
function findWishlistItems() {
  // Primary selector for wishlist items
  const items = document.querySelectorAll("li[data-id][data-itemid]");

  if (DEBUG_MODE && items.length > 0) {
    console.log(`Found ${items.length} wishlist items`);
  }

  return Array.from(items);
}

// Function to check if extension context is valid
function isExtensionContextValid() {
  try {
    return chrome.runtime?.id;
  } catch (_error) {
    return false;
  }
}

// Function to fetch all prices for an item using background script
async function fetchAllPrices(asin, _title, productType = "unknown", currentFormat = null) {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.warn(`Extension context invalidated for ${asin} - skipping price check`);
      return [];
    }

    // Send message to background script to fetch prices
    const response = await chrome.runtime.sendMessage({
      action: "fetchPrices",
      asin: asin,
      productType: productType,
      currentFormat: currentFormat,
    });

    if (response?.success) {
      if (DEBUG_MODE) {
        console.log(`Background script returned ${response.prices.length} prices for ${asin}`);
      }
      return response.prices;
    } else {
      console.error(`Background script failed to fetch prices for ${asin}:`, response?.error);
      return [];
    }
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      console.warn(`Extension was reloaded - stopping price checks. Please refresh the page.`);
      // Show user-friendly message
      showExtensionReloadedMessage();
      return [];
    }
    console.error(`Error communicating with background script for ${asin}:`, error);
    return [];
  }
}

// Function to show extension reloaded message
function showExtensionReloadedMessage() {
  // Remove any existing message
  const existingMessage = document.querySelector(".extension-reloaded-message");
  if (existingMessage) existingMessage.remove();

  const message = document.createElement("div");
  message.className = "extension-reloaded-message";
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
  `;
  message.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">⚠️ Extension Reloaded</div>
    <div>The price checker extension was updated. Please refresh this page to continue using it.</div>
  `;

  document.body.appendChild(message);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (message.parentNode) {
      message.remove();
    }
  }, 10000);
}

// Function to display price info on wishlist item
function displayPriceInfo(
  item,
  prices,
  isLoading = false,
  asin = null,
  productType = "unknown",
  currentFormat = null,
) {
  // Remove any existing display
  const existingDisplay = item.querySelector(".amz-price-checker-display");
  if (existingDisplay) existingDisplay.remove();

  const display = document.createElement("div");
  display.className = "amz-price-checker-display";
  display.style.cssText = `
    margin: 10px 0;
    padding: 10px;
    background: ${isLoading ? "#f0f0f0" : "#FFF3CD"};
    border: 1px solid ${isLoading ? "#ddd" : "#FFA724"};
    border-radius: 4px;
    font-size: 14px;
  `;

  if (isLoading) {
    display.innerHTML = "⏳ Checking all prices...";
  } else if (prices.length === 0) {
    display.innerHTML = "❌ Unable to fetch additional prices";
  } else {
    const lowestPrice = prices[0];
    const wishlistPrice = extractPrice(item.getAttribute("data-price"));

    const offersUrl = `https://www.amazon.com/dp/${asin}/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL`;

    let html = `
      <div style="font-weight: bold; margin-bottom: 5px;">
        💰 Lowest Price: $${lowestPrice.price.toFixed(2)} 
        <span style="font-size: 12px; color: #666;">
          (${lowestPrice.type}${lowestPrice.condition ? ` - ${lowestPrice.condition}` : ""})
        </span>
      </div>
      <div style="font-size: 11px; color: #0066c0; margin-bottom: 5px;">
        🔗 <a href="${offersUrl}" target="_blank" style="color: #0066c0;">
          View all offers: ASIN ${asin}
        </a>
        ${productType !== "unknown" ? `<span style="margin-left: 10px; color: #666;">(${productType}${currentFormat ? ` - ${currentFormat}` : ""})</span>` : ""}
      </div>
      <div style="font-size: 10px; color: #666; margin-bottom: 5px; font-family: monospace; word-break: break-all;">
        📋 URL: ${offersUrl}
      </div>
    `;

    // Calculate savings vs wishlist price
    if (wishlistPrice && wishlistPrice > lowestPrice.price) {
      const savings = wishlistPrice - lowestPrice.price;
      html += `
        <div style="color: #007600; font-size: 12px;">
          Save $${savings.toFixed(2)} vs current price ($${wishlistPrice.toFixed(2)})
        </div>
      `;
    }

    if (prices.length > 1) {
      html += `
        <details style="margin-top: 5px;">
          <summary style="cursor: pointer; font-size: 12px; color: #0066c0;">
            View all ${prices.length} prices
          </summary>
          <table style="margin-top: 5px; font-size: 12px; width: 100%; border-collapse: collapse;">
            ${prices
              .map(
                (p, idx) => `
              <tr style="${idx === 0 ? "background: #FFF3CD;" : ""}">
                <td style="padding: 3px;">${p.type}</td>
                <td style="padding: 3px; font-weight: bold;">$${p.price.toFixed(2)}</td>
                ${p.condition ? `<td style="padding: 3px; font-size: 11px;">${p.condition}</td>` : ""}
              </tr>
            `,
              )
              .join("")}
          </table>
        </details>
      `;
    }

    display.innerHTML = html;
  }

  // Find best insertion point - after the price info
  const priceSection = item.querySelector(".a-row.a-size-small.itemPriceDrop, .a-row.a-size-small");
  if (priceSection) {
    priceSection.parentNode.insertBefore(display, priceSection.nextSibling);
  } else {
    // Fallback: add to end of item
    item.appendChild(display);
  }
}

// Detect book items on the wishlist. Non-book items return productType !== 'book'
// so the caller can skip them. Cheapest Read is books-only on amazon.com.
function analyzeWishlistItem(item) {
  const titleEl = item.querySelector('h2 a, h3 a, a[id*="itemName"], .a-link-normal');
  const title = titleEl ? titleEl.textContent.trim() : "";

  const formatText = item.textContent.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Digital book formats are excluded; those offer pages aren't physical-book offers.
  const isDigitalBook =
    formatText.includes("kindle") ||
    formatText.includes("audible") ||
    formatText.includes("audiobook") ||
    formatText.includes("ebook");

  const hasBookFormat =
    formatText.includes("hardcover") ||
    formatText.includes("hard cover") ||
    formatText.includes("hardback") ||
    formatText.includes("paperback") ||
    formatText.includes("paper back") ||
    formatText.includes("softcover") ||
    formatText.includes("mass market") ||
    lowerTitle.includes("book");

  if (isDigitalBook || !hasBookFormat) {
    return { productType: "other", currentFormat: null, title };
  }

  let currentFormat = null;
  if (
    formatText.includes("hardcover") ||
    formatText.includes("hard cover") ||
    formatText.includes("hardback")
  ) {
    currentFormat = "hardcover";
  } else if (
    formatText.includes("paperback") ||
    formatText.includes("paper back") ||
    formatText.includes("softcover")
  ) {
    currentFormat = "paperback";
  } else if (formatText.includes("mass market")) {
    currentFormat = "mass market";
  }

  return { productType: "book", currentFormat, title };
}

// Function to process a single wishlist item
async function processWishlistItem(item) {
  // Check if extension context is still valid before processing
  if (!isExtensionContextValid()) {
    if (DEBUG_MODE) {
      console.warn("Extension context invalidated - stopping item processing");
    }
    return;
  }

  const asin = extractASIN(item);
  if (!asin) {
    if (DEBUG_MODE) {
      console.log("No ASIN found for item");
    }
    return;
  }

  // Skip if already processed
  if (processedASINs.has(asin)) {
    return;
  }

  processedASINs.add(asin);

  // Analyze the item to understand product type and format
  const analysis = analyzeWishlistItem(item);
  const { productType, currentFormat, title } = analysis;

  if (productType !== "book") {
    if (DEBUG_MODE) {
      console.log(`Skipping non-book item: "${title}" (ASIN: ${asin})`);
    }
    return;
  }

  if (DEBUG_MODE) {
    console.log(`Processing: "${title}" (ASIN: ${asin}) - Format: ${currentFormat}`);
  }

  // Show loading state
  displayPriceInfo(item, [], true, asin, productType, currentFormat);

  // Fetch prices with format filtering
  const prices = await fetchAllPrices(asin, title, productType, currentFormat);

  // Display results (only if we got valid results or context is still valid)
  if (isExtensionContextValid()) {
    displayPriceInfo(item, prices, false, asin, productType, currentFormat);

    if (DEBUG_MODE && prices.length > 0) {
      console.log(`Found ${prices.length} prices for "${title}":`, prices);
    }
  }
}

// Function to process all visible wishlist items
async function processVisibleItems() {
  if (isProcessing) return;

  isProcessing = true;
  const items = findWishlistItems();

  if (items.length === 0) {
    if (DEBUG_MODE) {
      console.log("No wishlist items found");
    }
    isProcessing = false;
    return;
  }

  if (DEBUG_MODE) {
    console.log(`Processing ${items.length} wishlist items...`);
  }

  // Process items in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    await Promise.all(batch.map((item) => processWishlistItem(item)));

    // Delay between batches
    if (i + BATCH_SIZE < items.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_ITEMS));
    }
  }

  isProcessing = false;

  if (DEBUG_MODE) {
    console.log("Finished processing visible items");
  }
}

// Function to observe DOM changes for lazy loading
function observeWishlist() {
  const observer = new MutationObserver((mutations) => {
    // Check if new items were added
    const hasNewItems = mutations.some((mutation) => {
      return Array.from(mutation.addedNodes).some((node) => {
        return (
          node.nodeType === 1 &&
          (node.matches?.("[data-itemid]") || node.querySelector?.("[data-itemid]"))
        );
      });
    });

    if (hasNewItems) {
      if (DEBUG_MODE) {
        console.log("New items detected, processing...");
      }
      setTimeout(processVisibleItems, 500);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Main initialization function
async function init() {
  console.log("Cheapest Read: Active");

  // Add visual indicator that extension is active
  const indicator = document.createElement("div");
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #232F3E;
    color: #FFA724;
    padding: 10px 15px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  indicator.textContent = "🔍 Price Checker Active";
  document.body.appendChild(indicator);

  // Fade out indicator after 3 seconds
  setTimeout(() => {
    indicator.style.transition = "opacity 0.5s";
    indicator.style.opacity = "0";
    setTimeout(() => indicator.remove(), 500);
  }, 3000);

  // Process initial items
  await processVisibleItems();

  // Set up observer for lazy loaded items
  observeWishlist();

  // Also process on scroll (backup for lazy loading)
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      processVisibleItems();
    }, 1000);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "scanWishlist") {
    if (!isExtensionContextValid()) {
      sendResponse({ success: false, error: "Extension context invalidated" });
      return;
    }

    processVisibleItems()
      .then(() => {
        sendResponse({ success: true, itemsProcessed: processedASINs.size });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Auto-run on wishlist pages
if (window.location.href.includes("/hz/wishlist/")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Small delay to ensure page is fully rendered
    setTimeout(init, 1000);
  }
}
