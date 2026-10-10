(function (root) {
  'use strict';
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const bankPattern = /\bSBI\b|State Bank of India/i;
  const benefitPattern = /instant\s*(?:bank\s*)?discount|\d+%\s*(?:off|discount|cashback)|(?:₹|INR|Rs\.?)[\s\d,]+\s*(?:instant\s*)?(?:off|discount|cashback)|cashback\s+(?:of|up\s*to|on\s+(?:eligible\s+)?(?:SBI|State Bank))|(?:get|earn|receive)\s+(?:a\s+)?cashback/i;
  const stop = new Set('the a an and with for in on of to by from new latest edition pack combo black white blue red green grey gray silver gold pink buy online india price product offers offer sale free up upto hours hour playtime warranty'.split(' '));
  const categories = [
    ['earbuds', /earbuds?|airpods?|\btws\b|in[ -]ear/i],
    ['headphones', /headphones?|over[ -]ear|on[ -]ear/i],
    ['phone', /smartphone|mobile phone|\biphone\b|galaxy [asfm]\d|redmi|oneplus|\bpixel\s*\d/i],
    ['laptop', /laptop|macbook|chromebook|notebook/i],
    ['television', /television|smart tv|\bled tv\b|\bqled\b|\boled tv\b/i],
    ['watch', /smartwatch|smart watch|wrist watch/i],
    ['charger', /charger|charging adapter/i],
    ['powerbank', /power ?bank/i],
    ['speaker', /speaker|soundbar/i],
    ['washing machine', /washing machine/i],
    ['refrigerator', /refrigerator|fridge/i],
    ['air conditioner', /air conditioner|split ac|window ac/i],
    ['storage', /ssd|hard drive|pendrive|pen drive|memory card/i],
    ['monitor', /monitor/i],
    ['keyboard', /keyboard/i],
    ['mouse', /\bmouse\b/i],
    ['shoe', /shoes?|sneakers?/i]
  ];
  function money(value) {
    const text = clean(value);
    const match = text.match(/(?:₹|INR\s*|Rs\.?\s*)\s*([\d,]+(?:\.\d{1,2})?)/i)
      || text.match(/^([\d,]+(?:\.\d{1,2})?)$/);
    const amount = match ? Number(match[1].replace(/,/g, '')) : NaN;
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
  function asinFromUrl(value) {
    try {
      const url = new URL(value, 'https://www.amazon.in');
      if (url.protocol !== 'https:' || !['www.amazon.in', 'amazon.in'].includes(url.hostname)) return null;
      return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase() ?? null;
    } catch { return null; }
  }
  function productUrl(asin) {
    return /^[A-Z0-9]{10}$/.test(asin || '') ? `https://www.amazon.in/dp/${asin}` : null;
  }
  function safeImage(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|images-amazon\.com)$/.test(url.hostname) ? url.href : '';
    } catch { return ''; }
  }
  function tokens(title) {
    return [...new Set(clean(title).toLowerCase().replace(/[^a-z0-9. ]/g, ' ').split(/\s+/).filter(x => x.length > 1 && !stop.has(x)))];
  }
  const category = title => categories.find(([, pattern]) => pattern.test(title))?.[0] || null;
  function specs(title) {
    const output = {};
    for (const match of clean(title).toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(gb|tb|mah|watts?|w|inches?|inch|litres?|liters?|kg)\b/g)) {
      const unit = match[2].replace(/^watts?$/, 'w').replace(/^inches?$/, 'inch').replace(/^lit(?:re|er)s?$/, 'l');
      (output[unit] ||= []).push(Number(match[1]));
    }
    for (const unit of Object.keys(output)) output[unit] = [...new Set(output[unit])].sort((a,b) => a-b);
    return output;
  }
  function matchProduct(original, candidate, options = {}) {
    if (!candidate?.asin || candidate.asin === original.asin) return {score: 0, reasons: ['Already in your cart']};
    const reasons = [];
    const aCategory = category(original.title), bCategory = category(candidate.title);
    if (aCategory && bCategory && aCategory !== bCategory) return {score: 0, reasons: ['Different product type']};
    if (aCategory && !bCategory) return {score: 0, reasons: ['Product type could not be matched']};
    const a = tokens(original.title), b = new Set(tokens(candidate.title));
    if (!a.length) return {score: 0, reasons: ['Insufficient title']};
    const brand = a[0];
    if (options.sameBrand && !b.has(brand)) return {score: 0, reasons: ['Different brand']};
    const aSpecs = specs(original.title), bSpecs = specs(candidate.title);
    for (const unit of Object.keys(aSpecs)) {
      if (bSpecs[unit] && JSON.stringify(aSpecs[unit]) !== JSON.stringify(bSpecs[unit])) {
        return {score: 0, reasons: [`Different ${unit.toUpperCase()} specification`]};
      }
      if (!bSpecs[unit]) reasons.push(`${unit.toUpperCase()} specification needs checking`);
    }
    const range = Number(options.priceRange ?? 35) / 100;
    if (original.price && candidate.price && Math.abs(candidate.price - original.price) / original.price > range) {
      return {score: 0, reasons: ['Outside your price range']};
    }
    const shared = a.filter(x => b.has(x));
    const lexical = shared.length / Math.sqrt(a.length * Math.max(b.size, 1));
    let score = lexical * 0.7 + (aCategory && aCategory === bCategory ? 0.23 : 0) + (b.has(brand) ? 0.07 : 0);
    if (shared.length < 2 && !aCategory) score = 0;
    if (aCategory && aCategory === bCategory) reasons.unshift('Same product type');
    if (b.has(brand)) reasons.push('Same brand');
    if (original.price && candidate.price) reasons.push('Within your price range');
    return {score: Math.min(score, 1), reasons};
  }
  function searchQuery(title) {
    return tokens(title).slice(0, 11).join(' ');
  }
  function parseOffer(value) {
    const text = clean(value).slice(0, 2200);
    const unknown = {status: 'unknown', text, modes: [], percent: null, cap: null, minimum: null, flat: null};
    if (!bankPattern.test(text)) return unknown;
    // An SBI reference alone (or a no-cost EMI advertisement) is not a discount.
    if (!benefitPattern.test(text)) return {...unknown, status: 'mentioned'};
    if (/(?:SBI(?:\s+(?:credit|debit))?\s+cards?\s+(?:are\s+)?(?:not eligible|not applicable|excluded)|(?:not valid|not applicable|not eligible)\s+(?:on|for|with)\s+(?:any\s+)?SBI\s+(?:credit\s+|debit\s+)?cards?)/i.test(text)) return {...unknown, status: 'excluded'};
    // Keep only SBI-associated offer sentences, never borrow another bank's discount.
    const clauses = text.split(/(?:\n|[.;](?=\s+[A-Za-z])|[,|](?=\s*(?:SBI|State Bank|HDFC|ICICI|Axis|Kotak|HSBC|AU Bank))|\band\b(?=\s+(?:SBI|State Bank|HDFC|ICICI|Axis|Kotak|HSBC|AU Bank)))/i).filter(x => bankPattern.test(x));
    const eligible = clauses.find(x => benefitPattern.test(x));
    if (!eligible) return {...unknown, status: 'mentioned'};
    const modes = [];
    if (/debit/i.test(eligible)) modes.push('debit');
    const nonEmiCredit = /credit\s+cards?(?!\s+EMI)\b|credit\s*(?:&|and|\/)\s*debit\s+cards?|non[- ]?EMI|full swipe/i.test(eligible);
    if (/credit/i.test(eligible) && !/\bEMI\s*(?:only|transactions only)\b/i.test(eligible) && nonEmiCredit) modes.push('credit');
    if (/\bEMI\b/i.test(eligible)) modes.push('emi');
    const percent = eligible.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
    const cap = eligible.match(/(?:up\s*to|upto|maximum(?: discount)?(?: of)?|capped at|max(?:imum)?\.?\s*discount(?: of)?)\s*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
    const minimum = eligible.match(/(?:min(?:imum)?(?:\s+(?:order|purchase|transaction))?(?:\s+(?:value|amount))?(?:\s+of)?|orders?\s+(?:above|over)|purchase(?:s)?\s+(?:above|over))\s*[:=]?\s*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
    const flat = !percent ? eligible.match(/(?:flat\s*)?(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:instant\s*)?discount/i)?.[1] : null;
    const number = x => x ? Number(x.replace(/,/g, '')) : null;
    return {status: 'detected', text, modes, percent: number(percent), cap: number(cap), minimum: number(minimum), flat: number(flat), kind: /instant|discount|%\s*off/i.test(eligible) ? 'instant' : 'cashback'};
  }
  function offerFits(offer, mode) {
    return offer?.status === 'detected' && offer.modes.includes(mode);
  }
  function estimateDiscount(offer, price, mode) {
    // No default festival percentage/cap/minimum; never sum per-item bank discounts.
    if (!price || !offerFits(offer, mode) || offer.kind !== 'instant' || offer.minimum == null || price < offer.minimum || /\b(?:HDFC|ICICI|Axis|Kotak|HSBC)\b/i.test(offer.text)) return null;
    if (/bonus|exchange|select(?:ed)?\s+(?:card|customer)|first\s+(?:order|transaction)|new\s+(?:card|customer)|\b(?:expired|ended)\b|\b(?:valid|until|till|between|from)\b.*\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|20\d{2})/i.test(offer.text)) return null;
    if (offer.percent && offer.percent <= 100 && offer.cap != null) return Math.round(Math.min(price * offer.percent / 100, offer.cap) * 100) / 100;
    if (offer.flat != null && !/up\s*to|upto/i.test(offer.text)) return Math.min(price, offer.flat);
    return null;
  }
  function rankCandidates(original, candidates, options = {}) {
    return candidates.map(product => ({...product, match: matchProduct(original, product, options)}))
      .filter(product => product.match.score >= 0.3)
      .sort((a,b) => Number(offerFits(b.offer, options.mode || 'credit')) - Number(offerFits(a.offer, options.mode || 'credit')) || b.match.score - a.match.score || (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  const api = {clean, money, asinFromUrl, productUrl, safeImage, tokens, category, specs, searchQuery, matchProduct, parseOffer, offerFits, estimateDiscount, rankCandidates};
  root.CartCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
