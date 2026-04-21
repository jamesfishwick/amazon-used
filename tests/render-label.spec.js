#!/usr/bin/env node
// FIS-71 render assertion: the lowest-price headline must read
// (Used - Very Good), (New), (Refurbished), etc. -- never with a doubled
// type prefix. Runs content.js in a headless page, stubs in a synthetic
// wishlist item + background responses, and inspects the injected DOM.

const path = require("node:path");
const { chromium } = require("playwright");

async function renderLabel(page, type, condition) {
  return page.evaluate(
    ([type, condition]) => {
      const item = document.querySelector('[data-itemid="TEST"]');
      const existing = item.querySelector(".amz-price-checker-display");
      if (existing) existing.remove();
      const prices = [
        {
          type,
          condition,
          price: 9.99,
          totalPrice: 9.99,
          source: "TEST",
          seller: "TestSeller",
          shippingCost: 0,
        },
      ];
      displayPriceInfo(item, prices, false, "TEST", "book", null);
      const display = item.querySelector(".amz-price-checker-display");
      return display ? display.innerText.replace(/\s+/g, " ").trim() : "";
    },
    [type, condition],
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const pass = (label) => console.log(`  PASS  ${label}`);
  const fail = (label, detail) => {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
  };

  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Minimal wishlist-like DOM. content.js queries for `[id^="itemImage_"]`
    // or similar patterns; we just need a container for the price display.
    await page.setContent(`
      <!doctype html><html><body>
        <div id="wishlist">
          <div data-itemid="TEST" data-price="$20.00" class="a-row">
            <div class="a-row a-size-small">current price</div>
          </div>
        </div>
      </body></html>
    `);

    await page.addInitScript(() => {
      window.chrome = {
        runtime: {
          id: "test-harness",
          onMessage: { addListener: () => {} },
          sendMessage: () => Promise.resolve({ success: true, prices: [] }),
        },
      };
    });

    await page.addScriptTag({ path: path.join(__dirname, "..", "src", "content.js") });

    const cases = [
      { type: "Used", condition: "Very Good", wants: "(Used - Very Good)" },
      { type: "Used", condition: "Like New", wants: "(Used - Like New)" },
      { type: "Used", condition: "Good", wants: "(Used - Good)" },
      { type: "Used", condition: "Acceptable", wants: "(Used - Acceptable)" },
      { type: "Used", condition: "", wants: "(Used)" },
      { type: "New", condition: "", wants: "(New)" },
      { type: "Refurbished", condition: "", wants: "(Refurbished)" },
      { type: "Collectible", condition: "", wants: "(Collectible)" },
    ];

    for (const tc of cases) {
      const text = await renderLabel(page, tc.type, tc.condition);
      const contains = text.includes(tc.wants);
      // Guard against doubled-prefix regressions.
      const doubled =
        /\(Used\s*-\s*Used\b/.test(text) ||
        /\(New\s*-\s*New\b/.test(text) ||
        /\(Refurbished\s*-\s*Refurbished\b/.test(text) ||
        /\(Collectible\s*-\s*Collectible\b/.test(text);
      if (contains && !doubled) {
        pass(`renders ${tc.wants} for type=${tc.type || '""'}, condition=${tc.condition || '""'}`);
      } else {
        fail(
          `renders ${tc.wants} for type=${tc.type}, condition=${tc.condition}`,
          `got headline text: ${text}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log(`\nFAIL: ${failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nPASS: all render assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
