// Offers page content script - runs on offer listing pages to extract real offers
// Anchors on the AOD offer containers so seller/condition/shipping come from
// stable sub-components (#aod-offer-heading, #aod-offer-soldBy) rather than
// regexing noisy container text.

(function() {
  'use strict';

  const DEBUG_MODE = true;

  // Books-only filter: exclude digital formats detectable from container text.
  function isDigitalContext(text) {
    const lower = (text || '').toLowerCase();
    return lower.includes('kindle') ||
           lower.includes('ebook') ||
           lower.includes('audiobook') ||
           lower.includes('audible');
  }

  async function waitForOffersToLoad() {
    if (DEBUG_MODE) {
      console.log('OFFERS CONTENT SCRIPT: waiting for offers to render');
    }

    return new Promise((resolve) => {
      const start = Date.now();

      const checkDiv = () => {
        // Real Amazon product page wraps the list in #all-offers-display.
        // The raw aodAjaxMain endpoint exposes #aod-offer-list directly.
        const div = document.getElementById('all-offers-display') ||
                    document.getElementById('aod-container') ||
                    (document.getElementById('aod-offer-list') || {}).parentElement ||
                    null;

        if (!div) {
          if (Date.now() - start > 20000) {
            if (DEBUG_MODE) console.log('timeout waiting for offers root');
            resolve({ noSellers: false, div: null, timeout: true });
            return;
          }
          setTimeout(checkDiv, 500);
          return;
        }

        const contentLength = div.innerHTML.length;
        const noSellers = div.textContent.toLowerCase()
          .includes('currently, there are no other sellers');

        if (noSellers) {
          resolve({ noSellers: true, div });
          return;
        }

        // Heuristic: once we can see at least one offer container, we're ready.
        const hasOfferContainer = !!div.querySelector(
          '[id="aod-offer"], [id="aod-pinned-offer"], [id^="aod-offer-"]'
        );
        if (hasOfferContainer && contentLength > 2000) {
          resolve({ noSellers: false, div });
          return;
        }

        if (Date.now() - start > 20000) {
          resolve({ noSellers: false, div, timeout: true });
          return;
        }
        setTimeout(checkDiv, 500);
      };

      checkDiv();
    });
  }

  // Sub-component IDs that share the "aod-offer-" prefix but are NOT offer roots.
  const SUBCOMPONENT_ID = /^aod-(pinned-)?offer-(heading|soldBy|shipsFrom|price|seller-rating|added-to-cart|updated-cart|not-added-to-cart|view-cart|promotion|qty-|upsell|list|main-content-show-more|main-content-show-less|additional-content|show-more-link|show-less-link)/;

  function getOfferContainers(root) {
    const candidates = root.querySelectorAll(
      '[id="aod-offer"], [id="aod-pinned-offer"], [id^="aod-offer-"]'
    );
    const containers = [];
    for (const el of candidates) {
      if (SUBCOMPONENT_ID.test(el.id)) continue;
      if (!el.querySelector('.a-price')) continue;
      // Don't accept a container that already has one of its ancestors/descendants in the list.
      let overlaps = false;
      for (const existing of containers) {
        if (existing.contains(el) || el.contains(existing)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) containers.push(el);
    }
    return containers;
  }

  function parsePrice(container) {
    const priceEl = container.querySelector('span.a-price span[aria-hidden="true"]');
    const raw = priceEl ? priceEl.textContent : '';
    let match = raw.match(/\$\s*([\d,]+\.?\d*)/);
    if (!match) {
      const off = container.querySelector('span.a-price .a-offscreen');
      if (off) match = (off.textContent || '').match(/\$\s*([\d,]+\.?\d*)/);
    }
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ''));
    return Number.isFinite(price) ? price : null;
  }

  function parseShipping(container) {
    const text = container.innerText || '';
    if (/free\s+(shipping|delivery)/i.test(text)) return 0;
    // "$3.99 shipping" or "$3.99 delivery"
    const m = text.match(/\$\s*([\d,]+\.?\d{1,2})\s+(?:shipping|delivery)/i);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
    // "+ $3.99 delivery" (AOD left column)
    const m2 = text.match(/\+\s*\$\s*([\d,]+\.?\d{1,2})\s+(?:shipping|delivery)/i);
    if (m2) return parseFloat(m2[1].replace(/,/g, ''));
    return null; // unknown
  }

  function normalizeCondition(raw) {
    const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;
    const lower = cleaned.toLowerCase();
    if (lower === 'new' || lower.startsWith('new ')) return 'New';
    if (lower.includes('used')) {
      if (lower.includes('like new')) return 'Used - Like New';
      if (lower.includes('very good')) return 'Used - Very Good';
      if (lower.includes('good')) return 'Used - Good';
      if (lower.includes('acceptable')) return 'Used - Acceptable';
      return 'Used';
    }
    if (lower.includes('refurbished')) return 'Refurbished';
    if (lower.includes('collectible')) return 'Collectible';
    return cleaned;
  }

  function parseCondition(container) {
    const heading = container.querySelector(
      '[id="aod-offer-heading"], [id^="aod-offer-heading-"]'
    );
    if (!heading) return null;
    // innerText strips inline <style>/<script>. Fall back to textContent for
    // headless contexts (jsdom-style) where innerText returns empty.
    const raw = (heading.innerText && heading.innerText.trim())
      ? heading.innerText
      : heading.textContent;
    return normalizeCondition(raw);
  }

  function parseSeller(container) {
    const sold = container.querySelector(
      '[id="aod-offer-soldBy"], [id^="aod-offer-soldBy-"]'
    );
    if (sold) {
      // Real Amazon renders the seller name as
      //   <span aria-label="SellerName. Opens a new page">SellerName</span>
      // The aria-label strips away rating/disclosure text that creeps into innerText.
      const labeled = sold.querySelector('[aria-label]');
      if (labeled) {
        const al = (labeled.getAttribute('aria-label') || '').trim();
        const m = al.match(/^(.+?)\.\s*Opens a new page/i);
        const name = m ? m[1].trim() : al;
        if (name) return name;
      }
      // Fixture/legacy: anchor text or full seller block.
      const link = sold.querySelector('a');
      if (link && link.textContent && link.textContent.trim()) {
        return link.textContent.trim();
      }
      const text = (sold.innerText || sold.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        return text
          .replace(/^Sold by\s*/i, '')
          .replace(/^Ships from and sold by\s*/i, '')
          .replace(/\s*Seller rating.*$/i, '')
          .trim() || null;
      }
    }

    // Fallback: parse "Ships from and sold by X" from container innerText.
    const full = container.innerText || '';
    const m = full.match(/Ships from and sold by\s+([^\n]+)/i);
    if (m) return m[1].replace(/\s*Seller rating.*$/i, '').trim();
    const m2 = full.match(/(?:^|\n)\s*Sold by\s*\n\s*([^\n]+)/i);
    if (m2) return m2[1].replace(/\s*Seller rating.*$/i, '').trim();
    return null;
  }

  function extractOfferFrom(container) {
    const text = container.innerText || container.textContent || '';
    if (isDigitalContext(text)) return null;

    const price = parsePrice(container);
    if (price === null || price <= 0) return null;

    const normalized = parseCondition(container) || 'Unknown';
    const seller = parseSeller(container) || 'Unknown';
    const shippingCost = parseShipping(container);
    const totalPrice = price + (shippingCost === null ? 0 : shippingCost);
    // normalizeCondition returns fused labels like "Used - Very Good" for
    // sub-graded used offers, and bare category names ("New", "Refurbished",
    // "Collectible", "Used", "Unknown") otherwise. Split into a category
    // `type` and optional sub-grade `condition` so the renderer (content.js)
    // can format as `(Used - Very Good)` / `(New)` without doubling prefixes.
    const dashIdx = normalized.indexOf(' - ');
    const type = dashIdx > 0 ? normalized.slice(0, dashIdx) : normalized;
    const condition = dashIdx > 0 ? normalized.slice(dashIdx + 3) : '';

    return {
      price,
      shippingCost,
      totalPrice,
      condition,
      seller,
      type,
      source: 'All Offers Display',
    };
  }

  function dedupeOffers(offers) {
    const seen = new Map();
    for (const offer of offers) {
      const key = [
        offer.price.toFixed(2),
        offer.shippingCost === null ? 'null' : offer.shippingCost.toFixed(2),
        offer.seller,
        offer.type,
        offer.condition,
      ].join('|');
      if (!seen.has(key)) seen.set(key, offer);
    }
    return Array.from(seen.values());
  }

  function parseOffersFromDiv(root) {
    if (!root) return [];

    const containers = getOfferContainers(root);
    if (DEBUG_MODE) {
      console.log(`Parsing ${containers.length} offer containers`);
    }

    const raw = [];
    for (const container of containers) {
      const offer = extractOfferFrom(container);
      if (offer) raw.push(offer);
    }

    const unique = dedupeOffers(raw);
    unique.sort((a, b) => a.totalPrice - b.totalPrice);

    if (DEBUG_MODE) {
      console.log(`Dedup: ${raw.length} raw -> ${unique.length} unique offers`);
      if (unique.length > 0) {
        const best = unique[0];
        console.log(`Lowest total: $${best.totalPrice.toFixed(2)} (${best.condition}, ${best.seller})`);
      }
    }

    return unique;
  }

  async function extractOffers() {
    try {
      const result = await waitForOffersToLoad();
      if (result.noSellers) return [];
      if (result.timeout && DEBUG_MODE) {
        console.log('TIMEOUT - parsing whatever is rendered');
      }
      return parseOffersFromDiv(result.div);
    } catch (error) {
      console.error('Error extracting offers:', error);
      return [];
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractOffers') {
      extractOffers()
        .then(offers => {
          try {
            sendResponse({ success: true, offers });
          } catch (e) {
            console.warn(`Could not send response: ${e.message}`);
          }
        })
        .catch(error => {
          try {
            sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.warn(`Could not send error response: ${e.message}`);
          }
        });
      return true;
    }
  });

  if (DEBUG_MODE) {
    console.log('OFFERS CONTENT SCRIPT: ready');
  }
})();
