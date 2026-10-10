(function (root) {
  'use strict';
  const core = root.CartCore || (typeof require === 'function' && require('./core.js'));
  function text(node, selectors) {
    for (const selector of selectors) {
      const value = core.clean(node.querySelector(selector)?.textContent);
      if (value) return value;
    }
    return '';
  }
  function price(node, selectors) {
    for (const selector of selectors) {
      const value = core.money(node.querySelector(selector)?.textContent);
      if (value) return value;
    }
    return null;
  }
  function image(node, selectors) {
    for (const selector of selectors) {
      const img = node.querySelector(selector);
      const value = core.safeImage(img?.getAttribute('src') || img?.getAttribute('data-src') || '');
      if (value) return value;
    }
    return '';
  }
  function extractCart(doc) {
    const items = new Map();
    // Saved-for-later, recommendations, and unchecked items are deliberately outside this root.
    const container = doc.querySelector('#sc-active-cart') || doc.querySelector('#activeCartViewForm');
    if (!container) return [];
    for (const node of container.querySelectorAll('[data-asin]')) {
      const asin = node.getAttribute('data-asin')?.toUpperCase();
      if (!core.productUrl(asin) || node.getAttribute('data-removed') === 'true' || node.getAttribute('data-itemtype') === 'saved') continue;
      if (node.closest('#sc-saved-cart, #sc-saved-cart-list')) continue;
      const selected = node.querySelector('[data-feature-id="item-selection"] input[type="checkbox"], input[type="checkbox"][name*="selected" i], input[type="checkbox"][name*="checkout" i]');
      if (selected && !selected.checked) continue;
      const title = text(node, ['.sc-product-title .a-truncate-full', '.sc-product-title', '[data-feature-id="title"]', 'a.sc-product-link .a-truncate-full', 'a.sc-product-link']) || core.clean(node.getAttribute('data-title'));
      if (!title) continue;
      const quantityText = node.querySelector('select[name^="quantity"]')?.value || node.querySelector('input[name^="quantity"]')?.value || text(node, ['.a-dropdown-prompt', '[data-feature-id="quantity"] .a-stepper-count']) || node.getAttribute('data-quantity') || '1';
      const quantity = Math.min(999, Math.max(1, Number.parseInt(quantityText, 10) || 1));
      if (!items.has(asin)) items.set(asin, {asin, title: title.slice(0, 500), price: price(node, ['.sc-product-price', '.sc-price', '[data-feature-id="price"] .a-offscreen', '.a-price .a-offscreen']), quantity, image: image(node, ['.sc-product-image', 'img']), url: core.productUrl(asin)});
    }
    return [...items.values()];
  }
  function extractSearch(doc) {
    const products = new Map();
    for (const node of doc.querySelectorAll('[data-component-type="s-search-result"][data-asin]')) {
      const asin = node.getAttribute('data-asin')?.toUpperCase();
      if (!core.productUrl(asin)) continue;
      const title = text(node, ['h2 span', 'h2', '[data-cy="title-recipe"]']) || core.clean(node.querySelector('img.s-image')?.getAttribute('alt'));
      if (!title) continue;
      // Search result banners are leads, not sufficient proof of a bank offer.
      products.set(asin, {asin, title: title.slice(0,500), price: price(node, ['.a-price:not(.a-text-price) .a-offscreen', '.a-price .a-offscreen']), image: image(node, ['img.s-image', 'img']), rating: text(node, ['.a-icon-alt']).match(/[\d.]+/)?.[0] || null, url: core.productUrl(asin), offer: {status: 'unknown', text: '', modes: []}, checkedAt: null});
    }
    return [...products.values()];
  }
  function offerBlocks(doc, live = false) {
    const roots = [...doc.querySelectorAll('#sopp_feature_div, #itembox-Price, #bankOffers_feature_div, #offers_feature_div, #inemi_feature_div, #desktop_qualifiedBuybox, [id*="bankOffer"], [id*="BankOffer"], [id*="paymentOffer"], [id*="PaymentOffer"], [id*="sopp"], [id*="promoPriceBlock"], [data-a-modal-id*="bank"], [role="dialog"], .a-popover')];
    const blocks = new Set();
    for (const scope of roots) {
      if (live && !scope.getClientRects().length) continue;
      const nodes = [...scope.querySelectorAll('p, li, tr, .a-row, .a-section, .a-popover-inner, [class*="offer"]'), scope];
      for (const node of nodes) {
        if (live && !node.getClientRects().length) continue;
        const value = core.clean(node.textContent);
        if (value.length < 10 || value.length > 2200 || !/\bSBI\b|State Bank of India/i.test(value)) continue;
        // Avoid assigning a neighbouring bank's percentage to an SBI headline.
        const smaller = [...node.querySelectorAll('p, li, tr, .a-row, .a-section, [class*="offer"]')].some(child => /\bSBI\b|State Bank of India/i.test(child.textContent) && core.clean(child.textContent).length >= 10);
        if (!smaller) blocks.add(value);
      }
    }
    return [...blocks].slice(0, 15);
  }
  function extractProduct(doc, url, live = false) {
    const asin = core.asinFromUrl(url);
    const title = text(doc, ['#productTitle', '#title']);
    if (!asin || !title) return null;
    const offers = offerBlocks(doc, live).map(core.parseOffer);
    const detected = offers.filter(x => x.status === 'detected');
    return {
      asin, title: title.slice(0,500),
      price: price(doc, ['#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen', '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen', '#apex_desktop .a-price:not(.a-text-price) .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '#price_inside_buybox']),
      image: image(doc, ['#landingImage', '#imgBlkFront']),
      rating: text(doc, ['#acrPopover .a-icon-alt']).match(/[\d.]+/)?.[0] || null,
      url: core.productUrl(asin), offers,
      offer: detected[0] || offers.find(x => x.status === 'excluded') || offers[0] || core.parseOffer(''),
      checkedAt: new Date().toISOString(), source: live ? 'visible product page' : 'product HTML'
    };
  }
  function blocked(doc) {
    return Boolean(doc.querySelector('#captchacharacters, form[action*="validateCaptcha"]')) || /robot check|sorry, we just need to make sure|automated access/i.test(doc.title + ' ' + (doc.body?.textContent || '').slice(0, 1200));
  }
  const api = {extractCart, extractSearch, extractProduct, offerBlocks, blocked};
  root.CartDOM = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
