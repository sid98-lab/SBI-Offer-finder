const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const C=require(path.join(root,'core.js'));
const D=require(path.join(root,'parser.js'));
const doc=html=>new JSDOM(html).window.document;
const offerText='10% instant discount on SBI Credit Cards up to ₹1,500, minimum transaction ₹2,490';
const original={asin:'B012345678',title:'Soundleaf wireless over-ear headphones with active noise cancellation',price:4499,quantity:1,image:''};
const alternative={asin:'B112345678',title:'Soundleaf wireless over-ear headphones with hybrid active noise cancellation',price:4299};
const productHtml=product=>`<title>${product.title}</title><h1 id="productTitle">${product.title}</h1><div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">₹${product.price}</span></span></div><div id="sopp_feature_div"><div class="a-row"><p>${offerText}</p></div></div>`;
const searchHtml=`<div data-component-type="s-search-result" data-asin="${alternative.asin}"><h2><span>${alternative.title}</span></h2><span class="a-price"><span class="a-offscreen">₹4,299</span></span></div>`;

test('currency parsing handles INR, commas, decimals and rejects invalid values',()=>{
  for(const [input,value] of [['₹1,29,999.50',129999.5],['INR 2,490',2490],['Rs. 599',599],['4999',4999],['free',null],['₹0',null]])assert.equal(C.money(input),value);
});
test('ASIN links reject other origins, insecure protocols and malformed IDs',()=>{
  assert.equal(C.asinFromUrl('https://www.amazon.in/title/dp/B012345678/ref=abc'),'B012345678');
  assert.equal(C.asinFromUrl('/gp/product/B012345678'),'B012345678');
  for(const url of ['https://evil.test/dp/B012345678','https://www.amazon.in.evil.test/dp/B012345678','javascript:alert(1)','http://www.amazon.in/dp/B012345678','https://www.amazon.in/dp/SHORT'])assert.equal(C.asinFromUrl(url),null);
  assert.equal(C.productUrl('bad'),null);
});
test('image URLs are restricted to Amazon image hosts',()=>{
  assert.ok(C.safeImage('https://m.media-amazon.com/images/I/photo.jpg'));
  for(const url of ['https://evil.test/a.jpg','javascript:alert(1)','https://media-amazon.com.evil.test/a.jpg','http://m.media-amazon.com/a.jpg'])assert.equal(C.safeImage(url),'');
});
test('SBI mentions, no-cost EMI and other banks are not an SBI discount',()=>{
  assert.equal(C.parseOffer('SBI Credit Cards accepted').status,'mentioned');
  assert.equal(C.parseOffer('SBI Cashback Credit Card accepted').status,'mentioned');
  assert.notEqual(C.parseOffer('No Cost EMI on SBI Credit Cards').status,'detected');
  assert.equal(C.parseOffer('SBI Credit Cards accepted. HDFC Credit Cards get 10% instant discount up to ₹2000').status,'mentioned');
  assert.equal(C.parseOffer('HDFC credit cards get 10% instant discount, SBI Credit Cards accepted').status,'mentioned');
  assert.equal(C.parseOffer('10% instant discount on ICICI credit cards').status,'unknown');
});
test('payment modes distinguish credit, debit, EMI-only and ambiguous card offers',()=>{
  const credit=C.parseOffer(offerText);
  assert.equal(credit.status,'detected');assert.deepEqual(credit.modes,['credit']);
  assert.ok(C.offerFits(credit,'credit'));assert.ok(!C.offerFits(credit,'debit'));assert.ok(!C.offerFits(credit,'emi'));
  assert.deepEqual(C.parseOffer('10% instant discount on SBI Credit Card EMI only').modes,['emi']);
  assert.deepEqual(C.parseOffer('10% instant discount on SBI Credit Cards and Credit Card EMI transactions').modes,['credit','emi']);
  assert.deepEqual(C.parseOffer('10% instant discount on SBI Debit Cards').modes,['debit']);
  assert.deepEqual(C.parseOffer('10% instant discount on SBI Credit and Debit Cards').modes,['debit','credit']);
  assert.deepEqual(C.parseOffer('10% instant discount on SBI cards').modes,[]);
});
test('explicit exclusions never become positive evidence',()=>{
  assert.equal(C.parseOffer('10% instant discount. Not valid on SBI credit cards').status,'excluded');
  assert.equal(C.parseOffer('10% instant discount on SBI credit cards, SBI cards are not eligible').status,'excluded');
});
test('discount estimates require explicit terms, correct payment mode and sufficient spend',()=>{
  const offer=C.parseOffer(offerText);
  assert.equal(C.estimateDiscount(offer,4299,'credit'),429.9);
  assert.equal(C.estimateDiscount(offer,25000,'credit'),1500);
  assert.equal(C.estimateDiscount(offer,1499,'credit'),null);
  assert.equal(C.estimateDiscount(offer,4299,'debit'),null);
  assert.equal(C.estimateDiscount(C.parseOffer('10% instant discount on SBI credit cards'),4299,'credit'),null);
  assert.equal(C.estimateDiscount(C.parseOffer('10% cashback on SBI credit cards up to ₹1500, minimum transaction ₹2490'),4299,'credit'),null);
  assert.equal(C.estimateDiscount(C.parseOffer(offerText+' valid until 20 October 2025'),4299,'credit'),null);
  assert.equal(C.estimateDiscount(C.parseOffer(offerText+' on first order'),4299,'credit'),null);
});
test('matching excludes original, incompatible types, price range and capacity mismatches',()=>{
  assert.equal(C.matchProduct(original,original).score,0);
  assert.equal(C.matchProduct(original,{...alternative,title:'Soundleaf TWS wireless earbuds active noise cancellation'}).score,0);
  assert.equal(C.matchProduct(original,{...alternative,price:9999}).score,0);
  assert.ok(C.matchProduct(original,alternative).score>=.3);
  assert.equal(C.matchProduct(original,{...alternative,title:'Otherbrand wireless over-ear headphones active noise cancellation'},{sameBrand:true}).score,0);
  assert.equal(C.matchProduct({asin:'B012345678',title:'OnePlus smartphone 8GB 128GB',price:20000},{asin:'B112345678',title:'OnePlus smartphone 8GB 256GB',price:21000}).score,0);
  assert.equal(C.matchProduct({asin:'B012345678',title:'Voltline 65W USB-C charger',price:3000},{asin:'B112345678',title:'Voltline 45W USB-C charger',price:2800}).score,0);
});
test('ranking prioritizes matching payment offers and cannot rank low-similarity products',()=>{
  const candidate={...alternative,offer:C.parseOffer(offerText)};
  const result=C.rankCandidates(original,[{...alternative,asin:'B212345678',price:4399},candidate,{asin:'B312345678',title:'Garden plant pot',price:4000}],{mode:'credit'});
  assert.equal(result[0].asin,candidate.asin);assert.equal(result.length,2);
});
test('cart parser scopes active cart, excludes unchecked/saved items and preserves quantity',()=>{
  const html=`<div id="sc-active-cart"><div data-asin="B012345678" data-quantity="2"><input type="checkbox" name="item-selected" checked><a class="sc-product-title"><span class="a-truncate-full">Headphones title</span></a><span class="sc-product-price">₹4,499</span></div><div data-asin="B112345678"><input type="checkbox" name="item-selected"><a class="sc-product-title">Unselected</a></div><div data-asin="B212345678" data-removed="true"><a class="sc-product-title">Removed</a></div></div><div id="sc-saved-cart"><div data-asin="B312345678"><a class="sc-product-title">Saved product</a></div></div><div data-asin="B412345678">Recommendations</div>`;
  const items=D.extractCart(doc(html));assert.equal(items.length,1);assert.equal(items[0].quantity,2);assert.equal(items[0].price,4499);
  assert.deepEqual(D.extractCart(doc('<div data-asin="B012345678">Outside cart</div>')),[]);
});
test('search parser ignores global festival banners and duplicate result ASINs',()=>{
  const html='<div>10% instant discount on SBI credit cards</div>'+searchHtml+searchHtml;
  const products=D.extractSearch(doc(html));assert.equal(products.length,1);assert.equal(products[0].price,4299);assert.equal(products[0].offer.status,'unknown');
});
test('product parser uses offer sections, excludes reviews and crossed-out prices',()=>{
  const html=productHtml(alternative).replace('<span class="a-price">','<span class="a-price a-text-price"><span class="a-offscreen">₹8,999</span></span><span class="a-price">')+'<div id="customerReviews">20% instant discount on SBI credit cards</div>';
  const product=D.extractProduct(doc(html),C.productUrl(alternative.asin));assert.equal(product.price,4299);assert.equal(product.offer.percent,10);assert.equal(product.offers.length,1);
  const noOffer=D.extractProduct(doc('<h1 id="productTitle">Headphones</h1><div id="customerReviews">10% instant discount on SBI credit cards</div>'),C.productUrl(alternative.asin));assert.equal(noOffer.offer.status,'unknown');
});
test('robot check recognition',()=>{
  assert.ok(D.blocked(doc('<title>Robot Check</title>')));
  assert.ok(D.blocked(doc('<form action="/errors/validateCaptcha"><input id="captchacharacters"></form>')));
  assert.ok(!D.blocked(doc(productHtml(alternative))));
});
test('offer extraction never borrows discounts from a neighbouring bank block',()=>{
  const html='<h1 id="productTitle">Headphones</h1><div id="sopp_feature_div"><div class="a-row"><p>10% instant discount on HDFC Credit Cards</p><p>SBI Credit Cards accepted</p></div></div>';
  const product=D.extractProduct(doc(html),C.productUrl(alternative.asin));
  assert.notEqual(product.offer.status,'detected');
});
test('manifest assets and permission scope are valid',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);assert.equal(manifest.host_permissions.length,2);
  const files=[manifest.background.service_worker,...manifest.content_scripts.flatMap(x=>x.js),...Object.values(manifest.icons)];
  files.forEach(file=>assert.ok(fs.existsSync(path.join(root,file)),file));
  assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
});
test('dashboard integration: automatic launch, mode filter, manual capture, sample isolation, blocked requests, cancellation and clear',async()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(root,'dashboard.html'),'utf8'),{url:'https://cartwise.test/dashboard.html?scan=1&source=1'});
  globalThis.document=dom.window.document;
  globalThis.location=dom.window.location;
  globalThis.DOMParser=dom.window.DOMParser;
  const saved={};
  let tabs=[{id:1,url:'https://www.amazon.in/gp/cart/view.html',lastAccessed:10}];
  globalThis.chrome={runtime:{id:'test-extension'},storage:{local:{get:async()=>({...saved}),set:async values=>Object.assign(saved,structuredClone(values)),remove:async key=>{delete saved[key];}}},tabs:{query:async()=>tabs,sendMessage:async(id,message)=>message.type==='READ_CART'?({items:[{...original}],isCart:true}):({product:{...alternative,offers:[C.parseOffer('10% instant discount on SBI Debit Cards')],offer:C.parseOffer('10% instant discount on SBI Debit Cards'),checkedAt:new Date().toISOString(),source:'visible product page'}})}};
  const fetches=[];
  globalThis.fetch=async url=>{fetches.push(url);return {ok:true,status:200,url,text:async()=>url.includes('/s?')?searchHtml:productHtml(url.includes(alternative.asin)?alternative:original)};};
  await import(require('node:url').pathToFileURL(path.join(root,'demo.js')).href);
  await import(require('node:url').pathToFileURL(path.join(root,'dashboard.js')).href);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(document.getElementById('scan').disabled,true,'Opening from Find SBI offers must start the scan without a second click');
  const end=Date.now()+12000;
  while(document.getElementById('scan').disabled&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(document.getElementById('scan').disabled,false);
  assert.equal(fetches.length,3);
  assert.equal(document.querySelectorAll('.candidate').length,1);
  assert.equal(document.getElementById('match-count').textContent,'1');
  assert.match(document.querySelector('.comparison-note').textContent,/current item also has/);
  assert.ok(saved.cartwiseSession);assert.equal(saved.cartwiseSession.items[0].asin,original.asin);
  const liveSession=structuredClone(saved.cartwiseSession);
  document.getElementById('mode').value='debit';document.getElementById('mode').dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.getElementById('match-count').textContent,'0');
  document.getElementById('offers-only').checked=true;document.getElementById('offers-only').dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelectorAll('.candidate').length,0);
  document.getElementById('offers-only').checked=false;document.getElementById('offers-only').dispatchEvent(new dom.window.Event('input'));
  tabs.push({id:2,url:C.productUrl(alternative.asin),lastAccessed:20});
  [...document.querySelectorAll('button')].find(node=>node.textContent==='Read open product page').click();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(document.getElementById('match-count').textContent,'1');
  assert.match(document.getElementById('status').textContent,/captured from the visible/);
  const capturedSession=structuredClone(saved.cartwiseSession);
  document.getElementById('demo').click();
  assert.equal(document.getElementById('demo-banner').hidden,false);
  assert.deepEqual(saved.cartwiseSession,capturedSession);
  document.getElementById('exit-demo').click();await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(document.getElementById('demo-banner').hidden,true);
  assert.equal(document.getElementById('item-count').textContent,'1');
  globalThis.fetch=async url=>({ok:false,status:429,url,text:async()=>''});
  document.getElementById('scan').click();
  while(document.getElementById('scan').disabled&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,25));
  assert.match(document.getElementById('status').textContent,/limited automated requests/);
  assert.equal(document.getElementById('cancel').hidden,true);
  document.getElementById('scan').click();document.getElementById('cancel').click();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(document.getElementById('scan').disabled,false);
  assert.match(document.getElementById('status').textContent,/Scan stopped/);
  document.getElementById('clear').click();await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(saved.cartwiseSession,undefined);assert.equal(document.getElementById('empty-state').hidden,false);
  tabs=[];
  document.getElementById('scan').click();await new Promise(resolve=>setTimeout(resolve,30));
  assert.match(document.getElementById('startup-note').textContent,/Open your Amazon.in cart/);
  assert.equal(document.getElementById('status').hidden,false);
  assert.equal(document.getElementById('scan').disabled,false);
});

test('toolbar and cart launcher pass automatic scan intent to the dashboard',async()=>{
  const vm=require('node:vm');
  let toolbar,listener;
  const opened=[],updated=[];
  let existing=[];
  const fakeChrome={
    runtime:{id:'test-extension',getURL:file=>'chrome-extension://test-extension/'+file,onMessage:{addListener:callback=>{listener=callback;}}},
    action:{onClicked:{addListener:callback=>{toolbar=callback;}}},
    tabs:{query:async()=>existing,create:async options=>opened.push(options),update:async(id,options)=>updated.push({id,...options})}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{chrome:fakeChrome,URL,console});
  await toolbar({id:42});
  const launch=new URL(opened[0].url);
  assert.equal(launch.searchParams.get('scan'),'1');
  assert.equal(launch.searchParams.get('source'),'42');
  existing=[{id:99}];
  let response;
  assert.equal(listener({type:'OPEN_FINDER'},{id:'test-extension',tab:{id:12,url:'https://www.amazon.in/gp/cart/view.html'}},value=>{response=value;}),true);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(updated[0].id,99);
  assert.equal(new URL(updated[0].url).searchParams.get('scan'),'1');
  assert.equal(new URL(updated[0].url).searchParams.get('source'),'12');
  assert.equal(response.ok,true);
  listener({type:'OPEN_FINDER'},{id:'test-extension',tab:{id:12,url:'https://evil.test/'}},()=>{throw new Error('Untrusted sender should not get a response');});
  assert.equal(updated.length,1);
});
