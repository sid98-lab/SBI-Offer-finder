# Validation — Cartwise v0.1.1

Checked on 10 October 2026.

## Passed

**17 automated test cases, 17 passed, 0 failed.** The shipped test suite is `tests/cartwise.test.cjs`. Runtime: Node.js 24.16.0; DOM fixtures: jsdom 30.1.2.

The tests cover currency handling, safe product/image URLs, SBI mentions versus actual discount statements, credit/debit/EMI separation, explicit exclusions, conservative discount estimates, product type/price/capacity matching, ranking, selected-cart extraction, saved-item exclusion, search extraction, scoped product offer extraction, neighbouring-bank false positives, robot checks, manifest assets and permission scope.

The dashboard integration test uses mocked Chrome APIs and Amazon responses to exercise automatic scanning on launch without a second button click, persistence, payment filters, reading an open product page, sample-data isolation, request-limit handling, cancellation, clearing stored cart data and visible missing-cart errors. A service-worker regression test confirms both the toolbar and cart launcher pass automatic scan intent and the correct source tab to the dashboard.

Version 0.1.1 browser verification confirmed the dashboard's ordered local JavaScript files loaded, the sample results rendered and no JavaScript errors or warnings were emitted. Progress/errors now appear both near the main button and in the comparison area. Scans bring the comparison area into view.

Browser preview checks passed at a 1280-pixel desktop width and a 390-pixel narrow width. No horizontal overflow was observed. Switching from credit to debit and enabling the matching-offers filter correctly removed the sample credit-only alternatives. The offer evidence panel expanded correctly. The desktop preview emitted no JavaScript error or warning logs during these checks.

All extension scripts passed JavaScript syntax checks. Manifest-referenced files exist. The runtime extension has no npm dependency or build step; the lockfile and test dependencies are for development.

## Live validation still needed

A real signed-in Amazon cart was **not** tested, and the extension was **not** installed in the user's Chrome profile or published to the Chrome Web Store. The page parsers were validated against representative DOM fixtures, not a guaranteed stable Amazon interface.

After installation, test one real cart item, confirm that its title, quantity and price match the cart, inspect a search result, and open its Bank Offers panel. Use **Read open product page** to compare the captured evidence with Amazon's displayed text. Complete the replacement manually on Amazon and check the actual card benefit at checkout.

Amazon may change selectors, load personalized offers dynamically, reject extension requests, require sign-in or show robot checks. These cases are exposed as incomplete/unknown results with an open-page fallback. The extension does not bypass request limits and does not guarantee offer availability, equivalent product specifications or exact-card eligibility.
