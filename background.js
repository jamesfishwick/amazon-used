// Background script for Cheapest Read
// Uses tab-based approach to properly wait for all-offers-display to populate

// Function to extract price from text
function extractPrice(priceText) {
  if (!priceText) return null;
  const match = priceText.match(/\$?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Function to fetch all prices using tab-based approach with content script
async function fetchAllPrices(asin, productType = 'unknown', currentFormat = null) {
  try {
    console.log(`\n🔍 ANALYZING: "${asin}" (${productType}${currentFormat ? ` - ${currentFormat}` : ''})`);
    
    const offersUrl = `https://www.amazon.com/dp/${asin}/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL`;
    
    console.log(`🔗 OPENING TAB: ${offersUrl}`);
    console.log(`🌐 VERIFICATION URL: ${offersUrl}`);
    
    // Create a new tab to load the offers page
    const tab = await chrome.tabs.create({
      url: offersUrl,
      active: false // Don't switch to this tab
    });
    
    console.log(`✅ TAB CREATED: ${tab.id} for ${asin}`);
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log(`⏰ TIMEOUT: Closing tab ${tab.id}`);
        chrome.tabs.remove(tab.id).catch(() => {});
        resolve([]);
      }, 30000); // 30 second timeout
      
      // Wait for tab to complete loading
      const onUpdated = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          console.log(`✅ TAB LOADED: ${tab.id} for ${asin}`);
          
          // Give it a moment for JavaScript to run
          setTimeout(() => {
            console.log(`📤 SENDING MESSAGE to tab ${tab.id} for ${asin}`);
            
            // Send message to content script to extract offers
            chrome.tabs.sendMessage(tab.id, {
              action: 'extractOffers',
              productType: productType,
              currentFormat: currentFormat
            }).then(response => {
              clearTimeout(timeoutId);
              chrome.tabs.onUpdated.removeListener(onUpdated);
              
              if (response && response.success) {
                console.log(`✅ OFFERS EXTRACTED for ${asin}: ${response.offers.length} offers`);
                if (response.offers.length > 0) {
                  console.log(`💰 LOWEST for ${asin}: $${response.offers[0].price} (${response.offers[0].type})`);
                }
                console.log(`────────────────────────────────────────────────────────────\n`);
                resolve(response.offers);
              } else {
                console.log(`❌ EXTRACTION FAILED for ${asin}: ${response ? response.error : 'No response'}`);
                resolve([]);
              }
              
              // Close the tab
              console.log(`🗑️ CLOSING TAB: ${tab.id}`);
              chrome.tabs.remove(tab.id).catch(() => {});
              
            }).catch(error => {
              clearTimeout(timeoutId);
              chrome.tabs.onUpdated.removeListener(onUpdated);
              console.error(`❌ MESSAGE ERROR for ${asin}: ${error.message}`);
              console.log(`🗑️ CLOSING TAB (error): ${tab.id}`);
              chrome.tabs.remove(tab.id).catch(() => {});
              resolve([]);
            });
          }, 3000); // Wait 3 seconds for page to settle (increased from 2)
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
    
  } catch (error) {
    console.error(`❌ Error fetching prices for ${asin}:`, error);
    return [];
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchPrices") {
    console.log(`🔄 BACKGROUND: Received fetchPrices request for ${request.asin}`);
    
    // Set a timeout to prevent the message channel from closing
    const timeoutId = setTimeout(() => {
      console.error(`⏰ BACKGROUND: Timeout fetching prices for ${request.asin}`);
      try {
        sendResponse({ success: false, error: 'Request timeout' });
      } catch (e) {
        console.warn(`⚠️ BACKGROUND: Could not send timeout response: ${e.message}`);
      }
    }, 45000); // 45 second timeout (longer for tab approach)
    
    fetchAllPrices(request.asin, request.productType, request.currentFormat)
      .then(prices => {
        clearTimeout(timeoutId);
        console.log(`✅ BACKGROUND: Sending ${prices.length} prices for ${request.asin}`);
        try {
          sendResponse({ success: true, prices });
        } catch (e) {
          console.warn(`⚠️ BACKGROUND: Could not send success response: ${e.message}`);
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error(`❌ BACKGROUND: Error in fetchAllPrices for ${request.asin}:`, error);
        try {
          sendResponse({ success: false, error: error.message });
        } catch (e) {
          console.warn(`⚠️ BACKGROUND: Could not send error response: ${e.message}`);
        }
      });
    return true; // Keep message channel open for async response
  }
  
  // Handle other legacy messages
  if (request.action === "updateProgress") {
    chrome.runtime.sendMessage(request);
    return true;
  }
  
  if (request.action === "checkProduct") {
    // Legacy support - redirect to new fetchPrices
    fetchAllPrices(request.asin, request.productType || 'unknown', request.currentFormat)
      .then(prices => {
        const result = prices.length > 0 ? {
          hasUsed: prices.some(p => p.type === 'Used'),
          lowestUsedPrice: prices.find(p => p.type === 'Used')?.price,
          prices
        } : null;
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error checking product:", error);
        sendResponse(null);
      });
    return true;
  }
});