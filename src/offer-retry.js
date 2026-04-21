// Retry + exponential backoff policy for the offer-fetch pipeline.
// Loaded into the MV3 service worker via `importScripts("offer-retry.js")`
// and required directly by Node tests — kept free of `chrome.*` APIs so it
// stays testable in either environment.

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const RETRY_MULTIPLIER = 2;
const RETRY_CAP_MS = 4000;

function computeBackoffMs(attempt) {
  // attempt is 1-indexed; delay before attempt N+1 is base * multiplier^(N-1).
  // The cap is policy headroom — the current max of 3 attempts only exercises
  // 500ms and 1000ms, but the cap is enforced for any future tuning.
  if (attempt < 1) return RETRY_BASE_MS;
  const raw = RETRY_BASE_MS * RETRY_MULTIPLIER ** (attempt - 1);
  return Math.min(raw, RETRY_CAP_MS);
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLogLine(asin, attempt, max, reason) {
  return `[${new Date().toISOString()}] retry attempt ${attempt}/${max} for ${asin} — ${reason}`;
}

// Run `attemptFn` up to `RETRY_MAX_ATTEMPTS` times. `attemptFn` must return
// { ok: true, value } on success or { ok: false, reason } on a retryable
// failure. Any thrown error is treated as a retryable failure with
// reason = `threw: <message>`.
async function retryWithBackoff(attemptFn, options) {
  const opts = options || {};
  const asin = opts.asin || "unknown";
  const debug = !!opts.debug;
  const sleep = opts.sleep || defaultSleep;
  const max = opts.maxAttempts || RETRY_MAX_ATTEMPTS;
  const log = opts.log || ((line) => console.log(line));

  let lastReason = "never-attempted";
  for (let attempt = 1; attempt <= max; attempt++) {
    let result;
    try {
      result = await attemptFn(attempt);
    } catch (err) {
      result = { ok: false, reason: `threw: ${err?.message ? err.message : String(err)}` };
    }

    if (result?.ok) {
      return { ok: true, value: result.value, attempts: attempt };
    }

    lastReason = result?.reason || "unknown";
    if (debug) log(formatLogLine(asin, attempt, max, lastReason));

    if (attempt < max) {
      await sleep(computeBackoffMs(attempt));
    }
  }

  return { ok: false, reason: lastReason, attempts: max };
}

const OfferRetry = {
  RETRY_MAX_ATTEMPTS,
  RETRY_BASE_MS,
  RETRY_MULTIPLIER,
  RETRY_CAP_MS,
  computeBackoffMs,
  retryWithBackoff,
  formatLogLine,
};

// Dual export: attach to the global scope for the classic MV3 worker and
// expose via CommonJS for Node tests. `self` exists in workers; tests go
// through `module.exports`.
if (typeof self !== "undefined") {
  self.OfferRetry = OfferRetry;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = OfferRetry;
}
