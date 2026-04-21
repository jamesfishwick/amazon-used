#!/usr/bin/env node
// Headless coverage for FIS-108 — retry + exponential backoff on offer-page
// failures. Two tiers share this file:
//
//   1. Unit tier: src/offer-retry.js in Node. Pins the backoff schedule, the
//      retry-on-failure contract, and the log-on-failure-only rule.
//   2. Integration tier: offer-retry.js + offers-content.js in a Playwright
//      page. Stubs the first extract attempt to fail, runs the real fixture
//      on the second, and asserts the ASIN still reaches the sorted results.
//
// Exits 0 on pass, 1 on any assertion or runtime failure.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const OfferRetry = require("../src/offer-retry.js");

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

async function runUnitTier(reporter) {
  console.log("Unit tier: offer-retry.js");

  reporter.expect("backoff(1) === 500ms", OfferRetry.computeBackoffMs(1) === 500);
  reporter.expect("backoff(2) === 1000ms", OfferRetry.computeBackoffMs(2) === 1000);
  reporter.expect("backoff(3) === 2000ms", OfferRetry.computeBackoffMs(3) === 2000);
  reporter.expect("backoff(4) === 4000ms (cap)", OfferRetry.computeBackoffMs(4) === 4000);
  reporter.expect("backoff(10) stays at 4000ms", OfferRetry.computeBackoffMs(10) === 4000);

  // Fail once, then succeed.
  {
    const sleeps = [];
    const logs = [];
    let attemptCount = 0;
    const attemptFn = async () => {
      attemptCount++;
      if (attemptCount === 1) return { ok: false, reason: "simulated-timeout" };
      return { ok: true, value: ["cheapest"] };
    };
    const result = await OfferRetry.retryWithBackoff(attemptFn, {
      asin: "B0TEST0001",
      debug: true,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      log: (line) => logs.push(line),
    });

    reporter.expect(
      "succeeds on 2nd attempt with attempts === 2",
      result.ok === true && result.attempts === 2 && result.value[0] === "cheapest",
      JSON.stringify(result),
    );
    reporter.expect(
      "one sleep of 500ms between attempts",
      sleeps.length === 1 && sleeps[0] === 500,
      JSON.stringify(sleeps),
    );
    reporter.expect(
      "log fires only for failed attempt (count === 1)",
      logs.length === 1,
      `got ${logs.length}: ${JSON.stringify(logs)}`,
    );
    reporter.expect(
      "log matches AC4 format: retry attempt 1/3 for <asin> — <reason>",
      logs.length === 1 &&
        /\[.+\] retry attempt 1\/3 for B0TEST0001 — simulated-timeout/.test(logs[0]),
      logs[0],
    );
  }

  // Always fails → exhaust.
  {
    const sleeps = [];
    const logs = [];
    const result = await OfferRetry.retryWithBackoff(
      async () => ({ ok: false, reason: "always-fails" }),
      {
        asin: "B0TEST0002",
        debug: true,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        log: (line) => logs.push(line),
      },
    );

    reporter.expect(
      "exhausts to { ok:false, attempts:3, reason:'always-fails' }",
      result.ok === false && result.attempts === 3 && result.reason === "always-fails",
      JSON.stringify(result),
    );
    reporter.expect(
      "two sleeps total: 500ms then 1000ms",
      sleeps.length === 2 && sleeps[0] === 500 && sleeps[1] === 1000,
      JSON.stringify(sleeps),
    );
    reporter.expect("log fires once per failed attempt (3 total)", logs.length === 3);
  }

  // Debug off → no logs.
  {
    const logs = [];
    await OfferRetry.retryWithBackoff(async () => ({ ok: false, reason: "x" }), {
      asin: "B0TEST0003",
      debug: false,
      sleep: async () => {},
      log: (line) => logs.push(line),
    });
    reporter.expect("debug: false suppresses logs", logs.length === 0, `got ${logs.length}`);
  }

  // Thrown error → normalized to a retryable failure.
  {
    const result = await OfferRetry.retryWithBackoff(
      async () => {
        throw new Error("boom");
      },
      { asin: "B0TEST0004", debug: false, sleep: async () => {} },
    );
    reporter.expect(
      "thrown error surfaces as reason 'threw: boom'",
      result.ok === false && result.reason === "threw: boom" && result.attempts === 3,
      JSON.stringify(result),
    );
  }
}

async function runIntegrationTier(reporter) {
  console.log("Integration tier: offer-retry + offers-content end-to-end");

  const { server, port } = await staticServer();
  const base = `http://127.0.0.1:${port}`;
  const targetAsin = "0374157359";

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.addInitScript(() => {
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
    await page.goto(`${base}/offers-${targetAsin}.html`, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: path.join(ROOT, "src", "offers-content.js") });
    await page.addScriptTag({ path: path.join(ROOT, "src", "offer-retry.js") });

    const retryFixtureLoaded = await page.evaluate(
      () => typeof window.OfferRetry?.retryWithBackoff === "function",
    );
    reporter.expect("OfferRetry global published by offer-retry.js", retryFixtureLoaded);

    const outcome = await page.evaluate(async (asin) => {
      const captured = [];
      let attemptCount = 0;
      const attemptFn = () =>
        new Promise((resolve) => {
          attemptCount++;
          if (attemptCount === 1) {
            // First attempt: simulate a transient tab-layer failure. The retry
            // loop should log and retry after a (stubbed) 500ms backoff.
            resolve({ ok: false, reason: "simulated" });
            return;
          }
          // Second attempt: real extractOffers flow against the fixture.
          window.__offersListener(
            { action: "extractOffers", productType: "book", currentFormat: null },
            null,
            (response) => {
              if (response?.success) {
                resolve({ ok: true, value: response.offers || [] });
              } else {
                resolve({ ok: false, reason: response?.reason || "unknown" });
              }
            },
          );
        });

      const result = await window.OfferRetry.retryWithBackoff(attemptFn, {
        asin,
        debug: true,
        sleep: async () => {},
        log: (line) => captured.push(line),
      });
      return { result, captured, attemptCount };
    }, targetAsin);

    reporter.expect(
      "integration retry result.ok === true",
      outcome.result.ok === true,
      JSON.stringify(outcome.result),
    );
    reporter.expect(
      "integration attempts === 2 (one retry)",
      outcome.result.attempts === 2 && outcome.attemptCount === 2,
      `result.attempts=${outcome.result.attempts} attemptCount=${outcome.attemptCount}`,
    );

    const offers = outcome.result.value || [];
    reporter.expect("integration offers count >= 1", offers.length >= 1, `got ${offers.length}`);
    reporter.expect(
      "integration offers sorted ascending by totalPrice",
      offers.every((o, i) => i === 0 || offers[i - 1].totalPrice <= o.totalPrice),
    );

    const cheapest = offers[0];
    reporter.expect(
      "integration cheapest price === $6.46 (matches happy-path)",
      !!cheapest && Math.abs(cheapest.price - 6.46) < 0.01,
      cheapest && `got $${cheapest.price}`,
    );
    reporter.expect(
      "captured log contains AC4-formatted retry line with simulated reason",
      outcome.captured.some((line) =>
        /\[.+\] retry attempt 1\/3 for 0374157359 — simulated/.test(line),
      ),
      JSON.stringify(outcome.captured),
    );
    reporter.expect(
      "only the failing attempt is logged (no log on success)",
      outcome.captured.length === 1,
      `got ${outcome.captured.length}`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

async function run() {
  const reporter = makeReporter();
  await runUnitTier(reporter);
  await runIntegrationTier(reporter);
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
