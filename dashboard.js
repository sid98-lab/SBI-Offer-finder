(function () {
'use strict';

const demoData = () => globalThis.CartwiseDemo.demoData();

const C = globalThis.CartCore, D = globalThis.CartDOM;
const $ = id => document.getElementById(id);
const extension = Boolean(globalThis.chrome?.runtime?.id);
const storageKey = 'cartwiseSession';
let data = {items:[],results:[],scannedAt:null};
let sample = false, scanning = false, controller = null, lastRequest = 0;
let options = {mode:'credit',priceRange:35,sameBrand:false,offersOnly:false};
const currency = value => value == null ? 'Price unavailable' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(value);
function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}
function button(value, className, action) {
  const node = el('button',className,value);
  node.type = 'button';
  node.addEventListener('click',action);
  return node;
}
function externalLink(value, url, className) {
  const node = el('a',className,value);
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}
function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').className = 'status-box' + (error ? ' error' : '');
  $('status').hidden = !message;
  $('startup-note').textContent = message || (extension ? 'Extension connected. Scan your cart to refresh the comparisons.' : 'Preview mode. Load the extension in Chrome to scan Amazon.');
  $('startup-note').className = 'startup-note' + (error ? ' error' : '');
}
function pickOffer(product) {
  const offers = product.offers?.length ? product.offers : [product.offer || C.parseOffer('')];
  return offers.find(offer => C.offerFits(offer,options.mode)) || offers.find(offer => offer.status === 'detected') || offers[0];
}
function offerBadge(product) {
  const offer = pickOffer(product);
  if (C.offerFits(offer,options.mode)) return el('span','offer-badge detected','✦ SBI offer detected');
  if (offer.status === 'detected') return el('span','offer-badge other',offer.modes.length ? 'Different payment mode' : 'Check card / payment type');
  if (offer.status === 'excluded') return el('span','offer-badge other','SBI exclusion detected');
  return el('span','offer-badge',offer.status === 'mentioned' ? 'SBI mentioned · check offer' : 'SBI offer not detected');
}
function productImage(product) {
  const src = C.safeImage(product.image);
  if (!src) return el('div','product-image placeholder-image',({headphones:'♪',earbuds:'♪',charger:'ϟ',watch:'◷',phone:'▯',laptop:'▱'})[C.category(product.title)] || 'c.');
  const image = el('img','product-image');
  image.src = src;
  image.alt = product.title;
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error',()=>image.replaceWith(el('div','product-image placeholder-image','c.')),{once:true});
  return image;
}
const queryUrl = original => 'https://www.amazon.in/s?k=' + encodeURIComponent(C.searchQuery(original.title));
function originalCard(product) {
  const node = el('div','original');
  node.append(el('p','item-label','Currently in your cart'),productImage(product),el('h4','',product.title),el('p','price',currency(product.price)),el('p','quantity',`Quantity ${product.quantity || 1} · price per item`),offerBadge(product));
  if (!sample) {
    const link = externalLink('Review current item ↗',C.productUrl(product.asin),'small-link');
    link.style.display = 'block';
    link.style.marginTop = '12px';
    node.append(link,button('Read open page','clear-button',()=>captureProduct(product.asin)));
  }
  return node;
}
function candidateCard(original, product, index) {
  const offer = pickOffer(product);
  const node = el('article','candidate' + (C.offerFits(offer,options.mode) && index === 0 ? ' best' : ''));
  node.append(offerBadge(product),productImage(product),el('h4','',product.title),el('p','price',currency(product.price)),el('p','price-caption','Listed price · before any card benefit'));
  if (original.price && product.price) {
    const difference = original.price - product.price;
    node.append(el('p','price-difference' + (difference < 0 ? ' higher' : ''),difference === 0 ? 'Same listed price as your item' : `${currency(Math.abs(difference))} ${difference >= 0 ? 'lower' : 'higher'} listed price`));
  }
  node.append(el('p','match-reasons',product.match.reasons.join(' · ') || 'Title similarity · compare all specifications'));
  const details = el('details','');
  details.append(el('summary','',offer.text ? 'See offer evidence & conditions' : 'How to check this offer'));
  const evidence = el('p','evidence',offer.text || 'The fetched page did not expose a product-level SBI discount. Open this product, expand Bank Offers, then return here and read the open page.');
  details.append(evidence);
  const estimate = C.estimateDiscount(offer,product.price,options.mode);
  if (estimate != null) details.append(el('p','verification-note',`Illustrative standalone card discount: ${currency(estimate)}. This is conditional on the displayed terms and unused card limits; not a checkout quote. Do not add estimates across items.`));
  details.append(el('p','verification-note',product.checkedAt ? `Evidence read ${new Date(product.checkedAt).toLocaleString('en-IN')} · ${product.source || 'product page'}. Offer availability may change.` : sample ? 'Fictional evidence for the sample cart.' : 'No readable product offer captured yet.'));
  node.append(details);
  if (sample) {
    const action = button('Sample product only','button secondary',()=>setStatus('This is an illustrative sample. Install the extension and scan your Amazon cart to review real alternatives.'));
    node.append(action);
  } else {
    node.append(externalLink('Review on Amazon ↗',C.productUrl(product.asin),'button ' + (C.offerFits(offer,options.mode) ? 'primary' : 'secondary')),
      button('Read open product page','clear-button',()=>captureProduct(product.asin)),
      el('p','verification-note','Expand Bank Offers on Amazon, then read the page here. Confirm your card, seller and variant before switching.'));
  }
  return node;
}
function render() {
  $('demo-banner').hidden = !sample;
  $('empty-state').hidden = data.items.length > 0;
  $('item-count').textContent = data.items.length ? String(data.items.length) : '—';
  let offerCount = 0, alternativeCount = 0;
  const fragment = document.createDocumentFragment();
  for (const result of data.results) {
    const ranked = C.rankCandidates(result.original,result.candidates.map(product=>({...product,offer:pickOffer(product)})),options);
    const offers = ranked.filter(product=>C.offerFits(product.offer,options.mode));
    offerCount += offers.length;
    alternativeCount += ranked.length;
    const candidates = (options.offersOnly ? offers : ranked).slice(0,3);
    const comparison = el('article','comparison');
    const heading = el('div','comparison-heading');
    heading.append(el('h3','',C.category(result.original.title)?.toUpperCase() || 'CART ITEM'),el('span','',result.state === 'searching' ? 'Searching…' : `${offers.length} matching SBI ${offers.length === 1 ? 'offer' : 'offers'} detected`));
    const body = el('div','comparison-body');
    body.append(originalCard(result.original));
    const alternatives = el('div','alternatives');
    const top = el('div','alternatives-top');
    top.append(el('p','',candidates.length ? 'SIMILAR FINDS FOR YOU' : 'LOOKING FOR YOUR NEXT MATCH'));
    if (!sample) top.append(externalLink('Search Amazon ↗',queryUrl(result.original),''));
    alternatives.append(top);
    if (!sample && result.state !== 'searching') alternatives.append(button('Read open search results','capture-button',()=>captureSearch(result)));
    if (candidates.length) {
      const grid = el('div','candidate-grid');
      candidates.forEach((product,index)=>grid.append(candidateCard(result.original,product,index)));
      alternatives.append(grid);
    } else alternatives.append(el('p','no-matches',result.state === 'searching' ? 'Reading similar products and checking their product pages for SBI offer evidence…' : options.offersOnly ? 'No matching SBI offers were detected in these results. Turn off the offer filter to inspect alternatives, or read an open product page after expanding Bank Offers.' : result.error || 'No close matches were found with these preferences. Try a wider price range or search Amazon and read the open results.'));
    body.append(alternatives);
    comparison.append(heading,body,el('div','comparison-note',C.offerFits(pickOffer(result.original),options.mode) ? 'Your current item also has matching SBI offer evidence. Compare both before changing your cart.' : 'Title and price matching cannot guarantee equivalent quality or compatibility. Review specifications, delivery and seller details.'));
    fragment.append(comparison);
  }
  $('results').replaceChildren(fragment);
  $('match-count').textContent = data.items.length ? String(offerCount) : '—';
  $('alternative-count').textContent = data.items.length ? String(alternativeCount) : '—';
  $('scan-time').textContent = sample ? 'Illustrative sample' : data.scannedAt ? `Last scan ${new Date(data.scannedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : 'Ready when you are';
}
function busy(value) {
  scanning = value;
  $('scan').disabled = value;
  $('demo').disabled = value;
  $('clear').disabled = value;
  $('mode').disabled = value;
  $('same-brand').disabled = value;
  $('price-range').disabled = value;
  $('cancel').hidden = !value;
  $('progress').hidden = !value;
  for (const node of document.querySelectorAll('.capture-button, .candidate .clear-button, .original .clear-button')) node.disabled = value;
}
async function persist() {
  if (!extension || sample) return;
  try { await chrome.storage.local.set({[storageKey]:data,cartwiseOptions:options}); }
  catch { setStatus('Results are available here, but could not be saved. Clear old results to free browser storage.',true); }
}
function sleep(ms, signal) {
  return new Promise((resolve,reject)=>{
    if (signal?.aborted) return reject(new DOMException('Scan stopped','AbortError'));
    const finish = () => {signal?.removeEventListener('abort',abort);resolve();};
    const timer = setTimeout(finish,ms);
    const abort = () => {clearTimeout(timer);reject(new DOMException('Scan stopped','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
  });
}
class AmazonBlocked extends Error {}
async function fetchPage(url, signal) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.amazon.in' || !(/^\/dp\/[A-Z0-9]{10}$/.test(parsed.pathname) || parsed.pathname === '/s')) throw new Error('Unsupported Amazon URL');
  await sleep(Math.max(0,1200 - (Date.now() - lastRequest)),signal);
  lastRequest = Date.now();
  const response = await fetch(url,{credentials:'include',signal:AbortSignal.any([signal,AbortSignal.timeout(18000)]),redirect:'follow',cache:'no-store'});
  if (!['www.amazon.in','amazon.in'].includes(new URL(response.url).hostname)) throw new Error('Amazon redirected away from the supported site.');
  if ([403,429,503].includes(response.status)) throw new AmazonBlocked('Amazon has limited automated requests. Open Search Amazon or the product page and use Read open page instead.');
  if (!response.ok) throw new Error(`Amazon returned status ${response.status}. Try reading the open page.`);
  const doc = new DOMParser().parseFromString(await response.text(),'text/html');
  if (D.blocked(doc)) throw new AmazonBlocked('Amazon requested a robot check. The scan stopped. Resolve it on Amazon, then use the open-page buttons here.');
  if (/signin|ap\/sign/i.test(new URL(response.url).pathname)) throw new AmazonBlocked('Amazon requires sign-in for this page. Open it on Amazon and use the open-page buttons here.');
  return doc;
}
async function getCart() {
  const tabs = await chrome.tabs.query({url:['https://www.amazon.in/*','https://amazon.in/*']});
  const source = Number(new URL(location.href).searchParams.get('source'));
  const cartTabs = tabs.filter(tab=>/\/(?:gp\/cart|cart)\//.test(new URL(tab.url).pathname)).sort((a,b)=>(a.id === source ? -1 : b.id === source ? 1 : (b.lastAccessed || 0) - (a.lastAccessed || 0)));
  if (!cartTabs.length) throw new Error('Open your Amazon.in cart in a tab, sign in if needed, then scan again.');
  let response;
  try { response = await chrome.tabs.sendMessage(cartTabs[0].id,{type:'READ_CART'}); }
  catch { throw new Error('Refresh your Amazon cart once so the extension can connect, then scan again. Check that Chrome allows the extension on Amazon.in.'); }
  if (response?.blocked) throw new Error('Amazon is showing a robot check. Resolve it in your cart tab, then scan again.');
  if (!response?.items?.length) throw new Error('No active selected cart items could be read. Check your cart and refresh it. Saved-for-later items are excluded. Amazon may also have changed its page layout.');
  return response.items;
}
async function checkCandidates(result, candidates, signal) {
  const eligible = C.rankCandidates(result.original,candidates,options).slice(0,4);
  result.candidates = eligible;
  render(); busy(true);
  for (let index = 0; index < eligible.length; index++) {
    signal.throwIfAborted();
    setStatus(`Checking product ${index+1} of ${eligible.length} for “${result.original.title.slice(0,65)}…”`);
    try {
      const doc = await fetchPage(C.productUrl(eligible[index].asin),signal);
      const parsed = D.extractProduct(doc,C.productUrl(eligible[index].asin));
      if (parsed) result.candidates[index] = {...eligible[index],...parsed};
    } catch (error) {
      if (error instanceof AmazonBlocked || signal.aborted) throw error;
      result.candidates[index].readError = 'Product page could not be read. Use the open-page check.';
    }
    render(); busy(true);
  }
}
async function scan() {
  if (scanning) return;
  if (!extension) return setStatus('This is the extension preview. Use the sample cart here, or load this folder as an unpacked Chrome extension to scan Amazon.',true);
  busy(true); controller = new AbortController();
  const signal = controller.signal;
  setStatus('Reading your active Amazon cart…');
  $('results-title').scrollIntoView?.({block:'start',behavior:'auto'});
  try {
    const items = await getCart();
    signal.throwIfAborted();
    sample = false;
    data = {items,results:items.map(original=>({original,candidates:[],state:'pending',error:null})),scannedAt:new Date().toISOString()};
    render(); busy(true);
    const limit = Math.min(items.length,8);
    for (let index=0; index<limit; index++) {
      signal.throwIfAborted();
      const result = data.results[index];
      result.state = 'searching';
      setStatus(`Finding alternatives for cart item ${index+1} of ${limit}…`);
      $('progress-bar').style.width = `${index/limit*100}%`;
      render(); busy(true);
      try {
        try {
          const currentDoc = await fetchPage(C.productUrl(result.original.asin),signal);
          const current = D.extractProduct(currentDoc,C.productUrl(result.original.asin));
          if (current) {
            // Cart price/quantity are authoritative for the original variant currently selected.
            result.original = {...result.original,offers:current.offers,offer:current.offer,checkedAt:current.checkedAt};
          }
        } catch (error) {if(error instanceof AmazonBlocked || signal.aborted) throw error;}
        const doc = await fetchPage(queryUrl(result.original),signal);
        await checkCandidates(result,D.extractSearch(doc),signal);
        result.state = 'complete';
      } catch (error) {
        result.state = 'complete';
        result.error = error.message;
        if (error instanceof AmazonBlocked || signal.aborted) throw error;
      }
      await persist();
      render(); busy(true);
    }
    for (const result of data.results.slice(limit)) {result.state='complete';result.error='Automatic scans cover the first eight items. Use Search Amazon and Read open search results for this item.';}
    $('progress-bar').style.width = '100%';
    setStatus(`Scan finished. ${limit} cart ${limit===1?'item':'items'} checked${items.length>limit?`; ${items.length-limit} more can be checked with the open-page buttons`:''}. Review offer evidence and confirm the actual benefit at Amazon checkout.`);
  } catch (error) {
    if (signal.aborted) setStatus('Scan stopped. Any results already found are still available.');
    else setStatus(error.message || 'The scan could not be completed. Refresh Amazon and try again.',true);
    for (const result of data.results) if (result.state !== 'complete') {result.state='complete';result.error='The scan stopped before this item was fully checked. Use the open-page buttons to continue.';}
  } finally {
    await persist();render();busy(false);controller=null;
  }
}
async function readAmazonTab(type, predicate, missingMessage) {
  const tabs = (await chrome.tabs.query({url:['https://www.amazon.in/*','https://amazon.in/*']})).filter(predicate).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0));
  if (!tabs.length) throw new Error(missingMessage);
  try { return await chrome.tabs.sendMessage(tabs[0].id,{type}); }
  catch { throw new Error('Refresh the Amazon page to connect the extension, then use this button again.'); }
}
async function captureProduct(asin) {
  if (scanning || !extension || sample) return;
  try {
    const response = await readAmazonTab('READ_PRODUCT',tab=>C.asinFromUrl(tab.url)===asin,'Open Review on Amazon for this product, expand Bank Offers, then return and read the open page.');
    if (response.blocked) throw new Error('Resolve Amazon’s robot check in the product tab first.');
    const product = response.product;
    if (!product || product.asin !== asin) throw new Error('The product page is not ready. Wait for it to load and expand Bank Offers before reading again.');
    for (const result of data.results) {
      if (result.original.asin===asin) result.original = {...result.original,offers:product.offers,offer:product.offer,checkedAt:product.checkedAt};
      result.candidates = result.candidates.map(candidate=>candidate.asin===asin ? {...candidate,...product} : candidate);
    }
    setStatus(product.offers.some(offer=>C.offerFits(offer,options.mode)) ? 'SBI offer evidence captured from the visible product page. Check conditions and the discount at checkout before switching.' : 'No matching SBI discount was readable in the visible offer panel. Expand Bank Offers on Amazon and try again.');
    await persist();render();
  } catch (error) {setStatus(error.message,true);}
}
async function captureSearch(result) {
  if (scanning || !extension || sample) return;
  try {
    const query = C.searchQuery(result.original.title);
    const response = await readAmazonTab('READ_SEARCH',tab=>{
      const url = new URL(tab.url);
      return url.pathname === '/s' && url.searchParams.get('k') === query;
    },'Open Search Amazon for this item first. Wait for the results, then return and read the open search results.');
    if (response.blocked) throw new Error('Resolve the robot check in the Amazon search tab first.');
    if (!response.products?.length) throw new Error('No search products could be read. Wait for the results and refresh the Amazon search tab.');
    busy(true);controller=new AbortController();result.state='searching';
    try {
      await checkCandidates(result,response.products,controller.signal);
      result.error=null;
      setStatus('Open search results captured and matching product pages checked. Use Read open product page to inspect offers that load dynamically.');
    } catch (error) {
      setStatus(controller.signal.aborted ? 'Scan stopped. Search candidates are still available.' : error.message,true);
    } finally {
      result.state='complete';await persist();render();busy(false);controller=null;
    }
  } catch (error) {setStatus(error.message,true);}
}
function updateOptions() {
  options={mode:$('mode').value,priceRange:Number($('price-range').value),sameBrand:$('same-brand').checked,offersOnly:$('offers-only').checked};
  $('range-value').textContent=`±${options.priceRange}%`;
  if (extension) chrome.storage.local.set({cartwiseOptions:options}).catch(()=>{});
  render();
}
$('scan').addEventListener('click',scan);
$('cancel').addEventListener('click',()=>controller?.abort());
$('demo').addEventListener('click',()=>{sample=true;data=demoData();setStatus('Explore a fictional sample. Use the preferences to see how comparisons change.');render();});
$('exit-demo').addEventListener('click',async()=>{sample=false;data=extension?(await chrome.storage.local.get(storageKey))[storageKey]||{items:[],results:[],scannedAt:null}:{items:[],results:[],scannedAt:null};setStatus('');render();});
$('clear').addEventListener('click',async()=>{if(scanning)return;sample=false;data={items:[],results:[],scannedAt:null};if(extension)await chrome.storage.local.remove(storageKey);setStatus('Saved cart and product results cleared from this browser.');render();});
for (const id of ['mode','price-range','same-brand','offers-only']) $(id).addEventListener('input',updateOptions);
async function init() {
  if(extension) {
    let saved = {};
    try {saved = await chrome.storage.local.get([storageKey,'cartwiseOptions']);}
    catch {setStatus('Saved results could not be loaded. Starting with a fresh cart scan.',true);}
    if(saved.cartwiseOptions) options={...options,...saved.cartwiseOptions};
    if(saved[storageKey]?.scannedAt && Date.now()-new Date(saved[storageKey].scannedAt).getTime()<24*60*60*1000) {
      data=saved[storageKey];
      for(const result of data.results) if(result.state!=='complete'){result.state='complete';result.error='The previous scan was interrupted. Scan again or use the open-page buttons.';}
      setStatus('Showing saved results from this browser. Scan again to refresh prices and offer evidence.');
    } else if(saved[storageKey]) await chrome.storage.local.remove(storageKey);
  }
  $('mode').value=options.mode;$('price-range').value=options.priceRange;$('same-brand').checked=options.sameBrand;$('offers-only').checked=options.offersOnly;$('range-value').textContent=`±${options.priceRange}%`;
  render();
  const launch = new URL(location.href).searchParams;
  if(launch.get('demo')==='1') $('demo').click();
  else if(extension && launch.get('scan')==='1') await scan();
  else if(extension) setStatus('Extension connected. Click Scan my Amazon cart to read your open Amazon cart.');
  else setStatus('Preview mode. Load Cartwise in Chrome to scan your Amazon cart.');
}
init().catch(()=>setStatus('Could not load saved results. You can still start a fresh cart scan.',true));
})();
