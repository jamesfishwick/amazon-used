# Test Results - ASIN 1988964490

**Book:** Uncertain Sons and Other Stories
**ASIN:** 1988964490
**Test Date:** 2025-10-17
**Script:** parse-api-simple.js

## Extracted Offers (12 total)

Sorted by total price (lowest to highest):

### 1. $19.98 TOTAL ⭐ LOWEST
- **Item Price:** $15.99
- **Shipping:** $3.99
- **Condition:** New
- **Seller:** Unknown
- **Notes:** Lowest total but NOT lowest item price

### 2. $19.99 TOTAL
- **Item Price:** $19.99
- **Shipping:** Unknown
- **Condition:** Unknown
- **Seller:** Unknown

### 3. $19.99 TOTAL
- **Item Price:** $19.99
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown

### 4. $22.11 TOTAL
- **Item Price:** $22.11
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown

### 5. $23.94 TOTAL
- **Item Price:** $23.94
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown

### 6. $23.98 TOTAL
- **Item Price:** $19.99
- **Shipping:** $3.99
- **Condition:** New
- **Seller:** Unknown
- **Notes:** Same item price as #2/#3, different total due to shipping

### 7. $27.26 TOTAL
- **Item Price:** $23.27
- **Shipping:** $3.99
- **Condition:** Unknown
- **Seller:** Unknown

### 8. $27.27 TOTAL
- **Item Price:** $27.27
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown

### 9. $27.55 TOTAL
- **Item Price:** $27.11
- **Shipping:** $0.44
- **Condition:** Unknown
- **Seller:** Unknown
- **Notes:** Unusual shipping cost (44 cents)

### 10. $34.05 TOTAL
- **Item Price:** $30.06
- **Shipping:** $3.99
- **Condition:** Unknown
- **Seller:** Unknown

### 11. $34.06 TOTAL
- **Item Price:** $34.06
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown

### 12. $34.06 TOTAL ⚠️ DUPLICATE?
- **Item Price:** $34.06
- **Shipping:** FREE
- **Condition:** Unknown
- **Seller:** Unknown
- **Notes:** Exact duplicate of #11 - likely pinned offer appearing twice

## Extraction Statistics

### Success Rates
- **Prices:** 100% (12/12) ✅
- **Shipping:** 75% (9/12) ⚠️
  - 3 offers showing "Unknown" shipping
  - Likely requires different DOM location
- **Condition:** ~30% (4/12) ⚠️
  - Only found "New" for offers #1 and #6
  - Others showing "Unknown"
- **Seller:** 0% (0/12) ❌
  - All showing "Unknown"
  - Need to fix seller extraction

### Price Distribution
- **Lowest Total:** $19.98
- **Highest Total:** $34.06
- **Price Range:** $14.08
- **Median Total:** $25.62

### Item Prices Found
Unique item prices (before shipping):
- $15.99 (1 offer) ⭐ Lowest item price
- $19.99 (3 offers)
- $22.11 (1 offer)
- $23.27 (1 offer)
- $23.94 (1 offer)
- $27.11 (1 offer)
- $27.27 (1 offer)
- $30.06 (1 offer)
- $34.06 (2 offers)

### Shipping Costs Found
- FREE (5 offers)
- $3.99 (4 offers) - Most common paid shipping
- $0.44 (1 offer) - Unusual amount
- Unknown (3 offers) - Failed extraction

## Key Insights

### 1. Total Price ≠ Item Price
**The lowest item price ($15.99) is NOT the cheapest option!**

Comparison:
- Offer with $15.99 item: $15.99 + $3.99 = **$19.98 total**
- Offer with $19.99 item: $19.99 + FREE = **$19.99 total**

The $19.99 with free shipping is only $0.01 more expensive total.

### 2. Shipping Variability
Same item price can have different shipping costs:
- $19.99 item price appears in 3 offers:
  - One with FREE shipping = $19.99 total
  - One with $3.99 shipping = $23.98 total
  - One with Unknown shipping

**This makes shipping extraction critical for finding true lowest price!**

### 3. Duplicate Detection Needed
Offers #11 and #12 are identical:
- Same price ($34.06)
- Same shipping (FREE)
- Same total ($34.06)

Likely the same offer appearing as both regular and pinned.

### 4. Data Completeness Issues
Missing data:
- Seller: 0/12 extracted (0%)
- Condition: 4/12 extracted (33%)
- Shipping: 9/12 extracted (75%)

**Next priority: Fix seller and condition extraction**

## Verification Against Screenshots

Screenshot: `screenshots/api-offers-simple.png`

### Visual Verification Results
- ✅ All 12 prices visible in screenshot match extracted prices
- ✅ Shipping costs match where visible
- ✅ Sorted order matches screenshot (lowest to highest total)
- ⚠️ Seller names visible in screenshot but not extracted
- ⚠️ Conditions visible in screenshot but mostly not extracted

## Known Sellers (from previous debug files)

From `debug-offers-1988964490.json`:
- Amazon
- SuperBookDeals
- webdelicollc
- MyPrepbooks
- RAREWAVES-IMPORTS
- betterdeals2019
- All-Time-Fast
- LuminaryBooks

**These should be extracted but currently showing as "Unknown"**

## Benchmark for Future Tests

This dataset serves as a benchmark. Future improvements should:

1. **Maintain current accuracy:**
   - 12 offers found
   - All prices correct
   - Shipping costs accurate where extracted

2. **Improve seller extraction:**
   - Target: 100% (currently 0%)
   - Should match seller names from debug files

3. **Improve condition extraction:**
   - Target: 100% (currently 33%)
   - Expected: New, Used - Good, Used - Like New, etc.

4. **Handle shipping edge cases:**
   - Target: 100% (currently 75%)
   - Handle "Unknown" cases properly

5. **Deduplicate offers:**
   - Remove exact duplicates (like #11 and #12)
   - Expected: 11 unique offers

## Test Reproducibility

To reproduce these results:

```bash
node parse-api-simple.js
```

**Expected output:**
- Console: 12 prices logged with shipping and totals
- File: `final-offers.json` with 12 offer objects
- File: `final-offers-summary.txt` with human-readable list
- Screenshot: `screenshots/api-offers-simple.png`

**Validation:**
1. Check console shows: "Lowest total price: $19.98"
2. Check console shows: "Total offers: 12"
3. Compare screenshot prices to JSON output
4. Verify totals = item + shipping

## Edge Cases to Test Next

1. **Used books** - Test with ASIN that has used offers
2. **Music (vinyl)** - Different format handling
3. **Video** - DVD/Blu-ray/Digital
4. **Out of stock** - How are unavailable offers shown?
5. **Prime only** - Prime-exclusive offers
6. **Add-on items** - Items that require $25+ order
7. **International shipping** - Higher shipping costs

## Performance Metrics

- **Execution Time:** ~4-5 seconds
- **API Response Size:** 297KB HTML
- **Price Elements Found:** 12
- **Containers Evaluated:** 12-26 (varies with selector)
- **Screenshot Size:** ~200KB PNG
- **Output JSON:** ~1.5KB

## Files Generated

```
final-offers.json                    (1.5KB) - Structured data
final-offers-summary.txt             (800B)  - Human readable
screenshots/api-offers-simple.png    (200KB) - Visual verification
api-response-rendered.html           (500KB) - Full rendered page
```

## Conclusion

**Working:**
- ✅ Price extraction is 100% accurate
- ✅ Total price calculation is correct
- ✅ Shipping extraction works for 75% of offers
- ✅ Sorting by total price works correctly

**Needs Fix:**
- ❌ Seller extraction (0% success rate)
- ⚠️ Condition extraction (33% success rate)
- ⚠️ Duplicate detection (2 exact duplicates)
- ⚠️ Unknown shipping (3 offers missing shipping data)

**Ready for:**
- Testing with additional ASINs
- Seller extraction improvement
- Condition extraction improvement
- Integration into Chrome extension
