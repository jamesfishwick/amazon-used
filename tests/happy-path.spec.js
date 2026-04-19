#!/usr/bin/env node
// Headless Playwright happy-path test for the wishlist extension.
//
// Pipeline under test:
//   wishlist.html  -> content.js::findWishlistItems + extractASIN
//   offers-*.html  -> offers-content.js::extractOffers -> parseOffersFromDiv
//
// Exits 0 on pass, 1 on any assertion or runtime failure.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");

function staticServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(FIXTURES, rel.replace(/^\/+/, ""));
    if (!filePath.startsWith(FIXTURES)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function makeReporter() {
  const failures = [];
  return {
    expect(label, cond, detail) {
      if (cond) {
        console.log(`  PASS  ${label}`);
      } else {
        console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
        failures.push(label);
      }
    },
    failures,
  };
}

async function run() {
  const { server, port } = await staticServer();
  const base = `http://127.0.0.1:${port}`;
  const reporter = makeReporter();

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();

    // --- Step 1: wishlist load + ASIN extraction ---
    console.log("Step 1: wishlist -> ASIN extraction");
    const wishlistPage = await ctx.newPage();
    await wishlistPage.addInitScript(() => {
      // Neutralise chrome.* side-effects in content.js before it loads.
      window.chrome = {
        runtime: {
          id: "test-harness",
          onMessage: { addListener: () => {} },
          sendMessage: () => Promise.resolve({ success: true, prices: [] }),
        },
      };
    });
    await wishlistPage.goto(`${base}/wishlist.html`, { waitUntil: "domcontentloaded" });
    await wishlistPage.addScriptTag({ path: path.join(ROOT, "content.js") });

    const { items, asins } = await wishlistPage.evaluate(() => {
      const found = findWishlistItems();
      return {
        items: found.length,
        asins: found.map(extractASIN).filter(Boolean),
      };
    });

    reporter.expect("wishlist renders >= 2 items", items >= 2, `got ${items}`);
    reporter.expect("extracted 2 ASINs", asins.length === 2, `got ${JSON.stringify(asins)}`);
    reporter.expect("ASIN 0374157359 (Dawn of Everything) extracted", asins.includes("0374157359"));
    reporter.expect("ASIN 0262548712 (Moral Codes) extracted", asins.includes("0262548712"));

    // --- Step 2: offer page -> parseOffersFromDiv -> lowest total ---
    console.log("Step 2: offer page -> offer parse -> lowest total");
    const targetAsin = "0374157359";
    const offersPage = await ctx.newPage();
    await offersPage.addInitScript(() => {
      // Capture the onMessage listener that offers-content.js registers so the
      // test can invoke the real extractOffers flow end-to-end.
      window.__offersListener = null;
      window.chrome = {
        runtime: {
          id: "test-harness",
          onMessage: {
            addListener: (cb) => {
              window.__offersListener = cb;
            },
          },
        },
      };
    });
    await offersPage.goto(`${base}/offers-${targetAsin}.html`, { waitUntil: "domcontentloaded" });
    await offersPage.addScriptTag({ path: path.join(ROOT, "offers-content.js") });

    const listenerPresent = await offersPage.evaluate(
      () => typeof window.__offersListener === "function",
    );
    reporter.expect("offers-content.js registered listener", listenerPresent);

    const response = await offersPage.evaluate(
      () =>
        new Promise((resolve) => {
          window.__offersListener(
            { action: "extractOffers", productType: "book", currentFormat: null },
            null,
            resolve,
          );
        }),
    );

    reporter.expect(
      "extractOffers responded",
      response && response.success === true,
      response?.error,
    );
    const offers = response?.offers || [];
    reporter.expect("at least one offer fetched", offers.length >= 1, `got ${offers.length}`);

    const lowest = offers[0];
    reporter.expect(
      "lowest offer has a positive price",
      !!lowest && lowest.price > 0,
      JSON.stringify(lowest),
    );
    reporter.expect(
      "lowest total price surfaced is $6.46",
      !!lowest && Math.abs(lowest.price - 6.46) < 0.01,
      lowest && `got $${lowest.price}`,
    );
    reporter.expect(
      "offers sorted ascending",
      offers.every((o, i) => i === 0 || offers[i - 1].totalPrice <= o.totalPrice),
    );

    // --- Step 3: parity fixture -> seller/condition/dedup parity (FIS-38) ---
    console.log("Step 3: parity fixture -> seller, condition, dedup");
    const parityPage = await ctx.newPage();
    await parityPage.addInitScript(() => {
      window.__offersListener = null;
      window.chrome = {
        runtime: {
          id: "test-harness",
          onMessage: {
            addListener: (cb) => {
              window.__offersListener = cb;
            },
          },
        },
      };
    });
    await parityPage.goto(`${base}/offers-parity.html`, { waitUntil: "domcontentloaded" });
    await parityPage.addScriptTag({ path: path.join(ROOT, "offers-content.js") });

    const parityResponse = await parityPage.evaluate(
      () =>
        new Promise((resolve) => {
          window.__offersListener(
            { action: "extractOffers", productType: "book", currentFormat: null },
            null,
            resolve,
          );
        }),
    );

    const parityOffers = parityResponse?.offers || [];
    // Fixture has 6 aod-offer + 1 pinned + 1 sticky-pinned + 1 Kindle-filtered.
    // Expected unique physical-book offers = 5:
    //   $13.51 HPB-Diamond (Used-VG) | $13.51 ThriftBooks-Dallas (Used-Good)
    //   $18.50 Amazon (New)          | $19.99 Amazon (New, pinned+aod dedup)
    //   $22.00 BookBarn (Used-Acceptable, unknown shipping)
    reporter.expect(
      "parity extractOffers responded",
      parityResponse && parityResponse.success === true,
      parityResponse?.error,
    );
    reporter.expect(
      "parity produces exactly 5 unique offers",
      parityOffers.length === 5,
      `got ${parityOffers.length}: ${JSON.stringify(parityOffers.map((o) => [o.price, o.seller, o.condition]))}`,
    );

    const sellerKnown = parityOffers.filter((o) => o.seller && o.seller !== "Unknown").length;
    // After FIS-71, offer.type carries the category ("Used", "New", ...) and
    // offer.condition carries the sub-grade within Used ("Very Good", ...) or
    // '' for categories without a sub-grade. The parity fixture has at least
    // one category for every offer, so type is always populated; condition is
    // only expected for Used sub-grades.
    const typeKnown = parityOffers.filter((o) => o.type && o.type !== "Unknown").length;
    reporter.expect(
      "parity seller extracted for 100% of offers",
      sellerKnown === parityOffers.length,
      `got ${sellerKnown}/${parityOffers.length}`,
    );
    reporter.expect(
      "parity type extracted for 100% of offers",
      typeKnown === parityOffers.length,
      `got ${typeKnown}/${parityOffers.length}`,
    );
    const usedSubGrades = parityOffers.filter((o) => o.type === "Used" && o.condition);
    reporter.expect(
      "used offers expose non-empty sub-grade in condition",
      usedSubGrades.length === parityOffers.filter((o) => o.type === "Used").length,
      `got ${usedSubGrades.length}/${parityOffers.filter((o) => o.type === "Used").length}`,
    );
    const newOffersHaveEmptyCondition = parityOffers.filter(
      (o) => o.type === "New" && o.condition === "",
    );
    reporter.expect(
      "new offers carry empty condition (no doubled prefix at render)",
      newOffersHaveEmptyCondition.length === parityOffers.filter((o) => o.type === "New").length,
      `got ${newOffersHaveEmptyCondition.length}/${parityOffers.filter((o) => o.type === "New").length}`,
    );

    const amazonAt1999 = parityOffers.filter(
      (o) => o.seller === "Amazon.com" && Math.abs(o.price - 19.99) < 0.01,
    );
    reporter.expect(
      "pinned + regular duplicate collapses to one Amazon $19.99 offer",
      amazonAt1999.length === 1,
      `got ${amazonAt1999.length}`,
    );

    const sameTotalDifferentSellers = parityOffers.filter((o) => Math.abs(o.price - 13.51) < 0.01);
    reporter.expect(
      "two distinct sellers at $13.51 both survive dedup",
      sameTotalDifferentSellers.length === 2,
      `got ${sameTotalDifferentSellers.length}`,
    );

    const kindleLeaked = parityOffers.some((o) =>
      o.seller?.toLowerCase().includes("amazon digital services"),
    );
    reporter.expect("Kindle digital offer filtered out", !kindleLeaked);

    const unknownShipping = parityOffers.find(
      (o) => Math.abs(o.price - 22.0) < 0.01 && o.seller === "BookBarn",
    );
    reporter.expect(
      "offer with no shipping info surfaces shippingCost=null",
      !!unknownShipping && unknownShipping.shippingCost === null,
      unknownShipping && `got ${JSON.stringify(unknownShipping)}`,
    );

    reporter.expect(
      "parity offers sorted ascending by totalPrice",
      parityOffers.every((o, i) => i === 0 || parityOffers[i - 1].totalPrice <= o.totalPrice),
    );
  } finally {
    await browser.close();
    server.close();
  }

  if (reporter.failures.length) {
    console.log(`\nFAIL: ${reporter.failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nPASS: all assertions passed");
}

run().catch((err) => {
  console.error("ERROR:", err?.stack ? err.stack : err);
  process.exit(1);
});
