const WISHLIST_URL_PATTERN = /^https:\/\/www\.amazon\.com\/hz\/wishlist\//;
const DEFAULT_WISHLIST_URL = "https://www.amazon.com/hz/wishlist/";

const statusEl = document.getElementById("status");
const actionEl = document.getElementById("action");
const messageEl = document.getElementById("message");

function renderOnWishlist(tabId) {
  statusEl.textContent = "On your Amazon wishlist. Prices auto-load as items appear.";
  statusEl.className = "on-wishlist";

  const button = document.createElement("button");
  button.textContent = "Rescan wishlist";
  button.addEventListener("click", () => {
    button.disabled = true;
    messageEl.textContent = "Scanning...";
    chrome.tabs.sendMessage(tabId, { action: "scanWishlist" }, (response) => {
      button.disabled = false;
      if (chrome.runtime.lastError) {
        messageEl.textContent = "Could not reach the page. Refresh the wishlist tab and try again.";
        return;
      }
      if (response?.success) {
        messageEl.textContent = `Scanned ${response.itemsProcessed ?? 0} item(s).`;
      } else {
        messageEl.textContent = response?.error || "Scan failed. See the page console for details.";
      }
    });
  });
  actionEl.appendChild(button);
}

function renderOffWishlist() {
  statusEl.textContent = "Open your Amazon wishlist to see the lowest total prices.";
  statusEl.className = "off-wishlist";

  const link = document.createElement("a");
  link.className = "button";
  link.href = DEFAULT_WISHLIST_URL;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Open Amazon wishlist";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: DEFAULT_WISHLIST_URL });
    window.close();
  });
  actionEl.appendChild(link);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs?.[0];
  if (tab?.url && WISHLIST_URL_PATTERN.test(tab.url)) {
    renderOnWishlist(tab.id);
  } else {
    renderOffWishlist();
  }
});
