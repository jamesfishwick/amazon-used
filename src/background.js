// Background script for Cheapest Read
// Tab-based offer fetch wrapped in an exponential-backoff retry loop.
// Retry policy lives in offer-retry.js (see FIS-108).

importScripts("offer-retry.js");

const DEBUG_MODE = true;
const TAB_FETCH_TIMEOUT_MS = 30000;
const POST_LOAD_SETTLE_MS = 3000;

function _extractPrice(priceText) {
  if (!priceText) return null;
  const match = priceText.match(/\$?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Single attempt at fetching offers for an ASIN. Returns
//   { ok: true, value: offers[] } on success, or
//   { ok: false, reason } when the tab layer reports a transient failure.
// Never throws — all failure surfaces are normalized to { ok: false, reason }.
function fetchOffersOnce(asin, productType, currentFormat) {
  const offersUrl = `https://www.amazon.com/dp/${asin}/ref=olp-opf-redir?aod=1&ie=UTF8&condition=ALL`;

  return new Promise((resolve) => {
    let settled = false;
    let tabId = null;
    let timeoutId = null;
    let onUpdated = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (onUpdated) chrome.tabs.onUpdated.removeListener(onUpdated);
      if (tabId !== null) chrome.tabs.remove(tabId).catch(() => {});
    };

    const done = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    chrome.tabs
      .create({ url: offersUrl, active: false })
      .then((tab) => {
        tabId = tab.id;
        if (DEBUG_MODE) console.log(`TAB CREATED: ${tab.id} for ${asin}`);

        timeoutId = setTimeout(() => {
          done({ ok: false, reason: "timeout" });
        }, TAB_FETCH_TIMEOUT_MS);

        onUpdated = (updatedTabId, changeInfo) => {
          if (updatedTabId !== tab.id) return;
          if (changeInfo.status !== "complete") return;

          // Give scripts a moment to run before we ask for offers.
          setTimeout(() => {
            chrome.tabs
              .sendMessage(tab.id, {
                action: "extractOffers",
                productType,
                currentFormat,
              })
              .then((response) => {
                if (!response) {
                  done({ ok: false, reason: "message-error: no response" });
                  return;
                }
                if (response.success === false) {
                  const reasonDetail = response.reason || response.error || "unknown";
                  done({ ok: false, reason: `extract-failed: ${reasonDetail}` });
                  return;
                }
                done({ ok: true, value: response.offers || [] });
              })
              .catch((error) => {
                const msg = error?.message ? error.message : String(error);
                done({ ok: false, reason: `message-error: ${msg}` });
              });
          }, POST_LOAD_SETTLE_MS);
        };

        chrome.tabs.onUpdated.addListener(onUpdated);
      })
      .catch((error) => {
        const msg = error?.message ? error.message : String(error);
        done({ ok: false, reason: `tab-create-failed: ${msg}` });
      });
  });
}

// Retry-wrapped offer fetch. Returns a structured result so callers can
// render a failure affordance instead of silently dropping the ASIN.
async function fetchAllPrices(asin, productType = "unknown", currentFormat = null) {
  if (DEBUG_MODE) {
    console.log(
      `\nANALYZING: "${asin}" (${productType}${currentFormat ? ` - ${currentFormat}` : ""})`,
    );
  }

  const result = await self.OfferRetry.retryWithBackoff(
    () => fetchOffersOnce(asin, productType, currentFormat),
    { asin, debug: DEBUG_MODE },
  );

  if (DEBUG_MODE) {
    if (result.ok) {
      console.log(
        `OFFERS for ${asin}: ${result.value.length} offers (attempts=${result.attempts})`,
      );
    } else {
      console.log(`FETCH FAILED for ${asin} after ${result.attempts} attempts: ${result.reason}`);
    }
  }

  return result;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "fetchPrices") {
    fetchAllPrices(request.asin, request.productType, request.currentFormat)
      .then((result) => {
        try {
          if (result.ok) {
            sendResponse({ success: true, prices: result.value, attempts: result.attempts });
          } else {
            sendResponse({ success: false, reason: result.reason, attempts: result.attempts });
          }
        } catch (e) {
          console.warn(`BACKGROUND: sendResponse failed: ${e.message}`);
        }
      })
      .catch((error) => {
        console.error(`BACKGROUND: unexpected error for ${request.asin}:`, error);
        try {
          sendResponse({ success: false, reason: `threw: ${error.message}`, attempts: 0 });
        } catch (e) {
          console.warn(`BACKGROUND: sendResponse failed: ${e.message}`);
        }
      });
    return true;
  }

  if (request.action === "updateProgress") {
    chrome.runtime.sendMessage(request);
    return true;
  }

  if (request.action === "checkProduct") {
    fetchAllPrices(request.asin, request.productType || "unknown", request.currentFormat)
      .then((result) => {
        const prices = result.ok ? result.value : [];
        const response =
          prices.length > 0
            ? {
                hasUsed: prices.some((p) => p.type === "Used"),
                lowestUsedPrice: prices.find((p) => p.type === "Used")?.price,
                prices,
              }
            : null;
        sendResponse(response);
      })
      .catch((error) => {
        console.error("Error checking product:", error);
        sendResponse(null);
      });
    return true;
  }
});
