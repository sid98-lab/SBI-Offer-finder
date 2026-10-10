# Cartwise — SBI offer finder

A working, unpacked Manifest V3 Chrome extension for Amazon.in. It reads your selected cart products, searches for similar products, and checks product pages for SBI offer evidence. No build, account, API key, or backend is required.

## Install in Chrome

1. Clone this repository, or extract `cartwise-sbi-extension.zip` if you downloaded the packaged extension.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** at the top right.
4. Click **Load unpacked** and select the project folder containing `manifest.json` (`SBI-Offer-finder` for a Git clone, or `sbi-cart-finder` for the packaged ZIP).
5. Open your signed-in [Amazon.in cart](https://www.amazon.in/gp/cart/view.html) and refresh that tab once.
6. Click **Find SBI offers** on the cart, or the extension icon in Chrome's toolbar.
7. **Find SBI offers** starts a cart scan automatically. Change the payment mode or preferences and use **Scan my Amazon cart** to refresh it.

Chrome's loading instructions: [Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Updating an installed copy

Version 0.1.1 makes **Find SBI offers** start a scan automatically and displays progress or errors near the main button. It also uses ordered local JavaScript files for the dashboard.

If Chrome loaded this folder, close the old Cartwise dashboard, open `chrome://extensions`, and click the reload icon on **Cartwise — SBI Offer Finder**. Refresh your Amazon cart, then click **Find SBI offers** again. If you installed a ZIP extracted into a different folder, replace that folder with the updated download before reloading.

If the dashboard stays on **Preparing the cart scanner**, Chrome has not run the updated scripts. Reload the extension and reopen its dashboard through the cart button. Opening `dashboard.html` directly is only a preview; its startup note identifies preview mode.

## Compare and replace

- Results show your current item, similar alternatives, listed prices, price differences and the exact offer text captured from product offer sections.
- **SBI offer detected** means the page contained an SBI discount/cashback statement that explicitly matched your payment mode. It does **not** guarantee your exact card or transaction is eligible.
- **SBI offer not detected** means the extension could not read that evidence. It does not prove that Amazon has no offer.
- Use **Review on Amazon**, compare the exact variant, seller, capacity, quality, delivery and warranty, then expand **Bank Offers**. Return to Cartwise and click **Read open product page** to capture the visible offer panel.
- To replace an item, add your chosen alternative on Amazon and remove the original from your cart. Confirm the discount at checkout before paying. Cartwise never submits purchases or changes cart quantities.
- If your current item has matching SBI offer evidence, the comparison says so. A replacement may be unnecessary.

## When Amazon pages cannot be read

Amazon often loads offer details dynamically, personalizes prices, or limits requests. A scan stops on a detected robot check or request limit; it never bypasses one.

1. Click **Search Amazon** beside the relevant cart item.
2. Wait for the search page, then return and click **Read open search results**.
3. Review a candidate on Amazon, expand its **Bank Offers**, and return to use **Read open product page**.

Refresh Amazon tabs opened before installation. The content script can read only supported cart, search and product pages. If Amazon changes its markup, update `parser.js` selectors.

## Matching and savings

- Matching is a local title/specification heuristic, not an AI recommendation service. It checks recognized product type, overlapping title words, price range and shared GB/TB/mAh/watt/inch/litre/kg specifications. Missing specifications still need your review.
- **Keep the same brand** uses the first meaningful title word as a brand heuristic. It is approximate.
- Automatic scans cover the first eight selected cart items and inspect up to four candidate product pages for each. Other cart items can use the open-page flow. Requests are sequential and spaced by at least 1.2 seconds.
- Changing filters re-ranks the candidates already fetched. Run another scan to search with a broader brand or price preference.
- The extension never assigns a universal 10% SBI discount. It shows an illustrative standalone discount only when product evidence explicitly includes sufficient minimum-spend and discount/cap details. It never adds bank discounts across cart items; card/order caps, prior use, exclusions, offer dates and EMI costs can change the actual benefit.
- Sample mode uses fictional products and offers. Its Amazon review links are disabled and its data is never saved as a live scan.

## Festival card eligibility

The [official October 2026 SBI credit-card campaign terms](https://www.sbicard.com/en/personal/offer/amazon-festive-sep26.page), checked on 10 October 2026, distinguish categories, spend thresholds, payment modes, date periods and card variants. They exclude SBI Cashback, Paytm SBI, Flipkart SBI, corporate cards and RuPay credit-card transactions via UPI from that campaign. The credit-card terms must not be applied to debit cards. Check the [current SBI offers](https://www.sbicard.com/en/personal/offers.page) and the Amazon product's conditions for your exact card. No dated campaign table is hardcoded into the matching engine.

## Privacy and permissions

- Host access is limited to `https://www.amazon.in/*` and `https://amazon.in/*`. The extension's content scripts run on cart, search and product URL patterns.
- Only Chrome's `storage` permission is requested. Chrome host permissions let the extension read supported Amazon tabs and fetch Amazon pages. See [Chrome host permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) and [network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).
- The content scripts collect only product title, ASIN, image URL, price, selected quantity and product offer evidence. They do not read login fields, card numbers, addresses or payment details.
- Cart and result data stay in `chrome.storage.local`. Results older than 24 hours are removed the next time the comparison screen opens. Click **Clear saved cart & results** to delete them immediately. Preferences remain saved.
- Amazon receives normal search/product requests and image loads as you use the extension. No analytics, affiliate tags, external AI calls, remote JavaScript or third-party servers are used.
- This is an independent prototype, not affiliated with Amazon or SBI.

## Files and development

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3, Amazon host access and content scripts |
| `background.js` | Opens the comparison tab from the toolbar/cart button |
| `content.js` | Reads supported Amazon tabs and adds the cart launcher |
| `core.js` | Safe URLs, prices, offer interpretation and similarity ranking |
| `parser.js` | Scoped cart, search and product DOM extraction |
| `dashboard.html`, `dashboard.css`, `dashboard.js` | Comparison interface and live scan flow |
| `demo.js` | Explicitly fictional sample fixtures |

To preview only the interface, serve this directory with a local HTTP server and open `dashboard.html?demo=1`. Browser preview cannot scan Amazon: that requires installing the extension.

For development tests, use Node.js 24.15+ within the 24.x release line (tested with 24.16), run `npm ci` in this folder, then `npm test`. Development dependencies are only for testing; Chrome needs none of them to load the extension.

## Validation status

See the accompanying `VALIDATION.md` for automated checks and the live-Amazon limitations. A real signed-in cart must be checked in Chrome after installation before wider distribution. Chrome Web Store publication is a separate step requiring a developer account, a privacy disclosure, and store review.
