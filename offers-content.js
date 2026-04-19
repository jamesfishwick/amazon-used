// Offers page content script - runs on offer listing pages to extract real prices
// This script waits for the all-offers-display div to populate and extracts real offers

(function() {
  'use strict';
  
  const DEBUG_MODE = true;
  
  // Books-only filter: include physical book offers, exclude digital formats.
  function shouldIncludePrice(priceText, contextText) {
    const lowerContext = contextText.toLowerCase();
    const isDigital = lowerContext.includes('kindle') ||
                     lowerContext.includes('ebook') ||
                     lowerContext.includes('audiobook') ||
                     lowerContext.includes('audible');
    return !isDigital;
  }
  
  async function waitForOffersToLoad() {
    if (DEBUG_MODE) {
      console.log('🔍 OFFERS CONTENT SCRIPT: Waiting for all-offers-display to populate...');
    }
    
    return new Promise((resolve) => {
      const checkDiv = () => {
        const div = document.getElementById('all-offers-display');
        
        if (!div) {
          if (DEBUG_MODE) console.log('⏳ all-offers-display div not found, waiting...');
          setTimeout(checkDiv, 1000);
          return;
        }
        
        const contentLength = div.innerHTML.length;
        const hasNoSellers = div.textContent.toLowerCase().includes('currently, there are no other sellers');
        
        if (DEBUG_MODE) {
          console.log(`📦 all-offers-display found: ${contentLength} chars, noSellers: ${hasNoSellers}`);
        }
        
        // If it has the \"no sellers\" message, we're done
        if (hasNoSellers) {
          if (DEBUG_MODE) console.log('🚫 Detected \"no other sellers\" - completing');
          resolve({ noSellers: true, div });
          return;
        }
        
        // If it has substantial content (offers loaded), we're done
        if (contentLength > 10000) {
          if (DEBUG_MODE) console.log('✅ Offers appear to be loaded - completing');
          resolve({ noSellers: false, div });
          return;
        }
        
        // Otherwise keep waiting
        if (DEBUG_MODE) console.log(`⏳ Content too short (${contentLength} chars), waiting for more...`);
        setTimeout(checkDiv, 1000);
      };
      
      // Start checking
      checkDiv();
      
      // Timeout after 20 seconds (increased)
      setTimeout(() => {
        if (DEBUG_MODE) console.log('⏰ Timeout waiting for offers to load');
        const div = document.getElementById('all-offers-display');
        resolve({ noSellers: false, div, timeout: true });
      }, 20000);
    });
  }
  
  function parseOffersFromDiv(div) {
    if (!div) return [];
    
    const prices = [];
    
    if (DEBUG_MODE) {
      console.log(`📋 Parsing offers from all-offers-display div`);
    }
    
    // Amazon uses complex div structures, not table rows
    // Look for elements that contain prices and offer information
    const allElements = div.querySelectorAll('*');
    const elementsWithPrices = [];
    
    // First pass: find all elements containing price patterns
    for (const element of allElements) {
      const text = element.textContent || '';
      if (text.includes('$') && text.match(/\$\d+\.\d{2}/)) {
        // Check if this looks like an actual offer (has condition/seller info)
        const lowerText = text.toLowerCase();
        const hasOfferKeywords = lowerText.includes('new') || lowerText.includes('used') || 
                                lowerText.includes('condition') || lowerText.includes('seller') ||
                                lowerText.includes('ships from') || lowerText.includes('sold by');
        
        if (hasOfferKeywords || text.length < 500) { // Short text more likely to be actual offer
          elementsWithPrices.push({
            element,
            text: text.substring(0, 300),
            prices: text.match(/\$\d+\.\d{2}/g) || []
          });
        }
      }
    }
    
    if (DEBUG_MODE) {
      console.log(`📋 Found ${elementsWithPrices.length} elements with prices`);
    }
    
    // Second pass: extract price information
    const foundPrices = new Set(); // Avoid duplicates
    
    for (let i = 0; i < elementsWithPrices.length; i++) {
      const item = elementsWithPrices[i];
      const text = item.text;
      const lowerText = text.toLowerCase();
      
      for (const priceText of item.prices) {
        const price = parseFloat(priceText.replace('$', ''));
        const priceKey = `${price}-${lowerText.substring(0, 50)}`; // Create unique key
        
        if (price >= 1 && price <= 500 && !foundPrices.has(priceKey)) {
          foundPrices.add(priceKey);
          
          // Determine condition from surrounding text
          let condition = 'New';
          let type = 'New';
          
          if (lowerText.includes('used')) {
            type = 'Used';
            if (lowerText.includes('like new')) condition = 'Used - Like New';
            else if (lowerText.includes('very good')) condition = 'Used - Very Good';
            else if (lowerText.includes('good')) condition = 'Used - Good';
            else if (lowerText.includes('acceptable')) condition = 'Used - Acceptable';
            else condition = 'Used - Good';
          } else if (lowerText.includes('refurbished')) {
            condition = 'Refurbished';
            type = 'Refurbished';
          }
          
          // Apply books-only filtering (exclude Kindle / Audible / ebook / audiobook)
          const shouldInclude = shouldIncludePrice(priceText.replace(/[^0-9]/g, ''), text);

          if (shouldInclude) {
            prices.push({
              price,
              type,
              condition,
              context: text.substring(0, 100)
            });

            if (DEBUG_MODE) {
              console.log(`   ✅ OFFER ${prices.length}: $${price} (${condition})`);
            }
          } else if (DEBUG_MODE) {
            console.log(`   ❌ FILTERED: $${price} (digital format)`);
          }
        }
      }
    }
    
    // Remove duplicates by price and sort
    const uniquePrices = prices.reduce((acc, current) => {
      const exists = acc.find(item => 
        Math.abs(item.price - current.price) < 0.01
      );
      if (!exists) acc.push(current);
      return acc;
    }, []);
    
    const sortedPrices = uniquePrices.sort((a, b) => a.price - b.price);
    
    if (DEBUG_MODE) {
      console.log(`📦 OFFERS RESULT: ${sortedPrices.length} valid offers`);
      if (sortedPrices.length > 0) {
        console.log(`💰 LOWEST PRICE: $${sortedPrices[0].price} (${sortedPrices[0].type})`);
      }
    }
    
    return sortedPrices;
  }
  
  // Main function to extract offers (books-only)
  async function extractOffers() {
    try {
      if (DEBUG_MODE) {
        console.log(`🔍 OFFERS EXTRACTION: Starting (books-only)`);
      }

      const result = await waitForOffersToLoad();

      if (result.noSellers) {
        if (DEBUG_MODE) console.log('🚫 NO OTHER SELLERS detected');
        return [];
      }

      if (result.timeout) {
        if (DEBUG_MODE) console.log('⏰ TIMEOUT - parsing current state');
      }

      const offers = parseOffersFromDiv(result.div);

      if (DEBUG_MODE) {
        console.log(`✅ EXTRACTION COMPLETE: ${offers.length > 0 ? '$' + offers[0].price + ' (' + offers[0].type + ')' : 'No offers'}`);
      }

      return offers;

    } catch (error) {
      console.error('❌ Error extracting offers:', error);
      return [];
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractOffers') {
      if (DEBUG_MODE) {
        console.log(`📨 OFFERS CONTENT: Received extractOffers request`);
      }

      extractOffers()
        .then(offers => {
          if (DEBUG_MODE) {
            console.log(`📤 OFFERS CONTENT: Sending response with ${offers.length} offers`);
          }
          try {
            sendResponse({ success: true, offers });
          } catch (e) {
            console.warn(`⚠️ OFFERS CONTENT: Could not send response: ${e.message}`);
          }
        })
        .catch(error => {
          console.error(`❌ OFFERS CONTENT: Error extracting offers:`, error);
          try {
            sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.warn(`⚠️ OFFERS CONTENT: Could not send error response: ${e.message}`);
          }
        });
      return true; // Keep message channel open
    }
  });
  
  if (DEBUG_MODE) {
    console.log('🔍 OFFERS CONTENT SCRIPT: Ready to extract offers');
  }
  
})();