(function () {
  'use strict';
  if (globalThis.__cartwiseLoaded) return;
  globalThis.__cartwiseLoaded = true;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'READ_CART') {
      respond({items: CartDOM.extractCart(document), isCart: /\/(?:gp\/cart|cart)\//.test(location.pathname), blocked: CartDOM.blocked(document)});
    } else if (message?.type === 'READ_PRODUCT') {
      respond({product: CartDOM.extractProduct(document, location.href, true), blocked: CartDOM.blocked(document)});
    } else if (message?.type === 'READ_SEARCH') {
      respond({products: CartDOM.extractSearch(document), blocked: CartDOM.blocked(document)});
    }
  });
  if (!/\/(?:gp\/cart|cart)\//.test(location.pathname)) return;
  const host = document.createElement('div');
  host.id = 'cartwise-launcher';
  const shadow = host.attachShadow({mode: 'closed'});
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;bottom:24px;right:24px;z-index:2147483646}button{border:0;border-radius:100px;background:#123a30;color:#fff;padding:15px 22px;font:600 14px system-ui;box-shadow:0 4px 22px #0003;cursor:pointer}button:hover{background:#1e5747}button:focus-visible{outline:3px solid #dcad64;outline-offset:3px}';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '✦ Find SBI offers';
  button.addEventListener('click', () => chrome.runtime.sendMessage({type: 'OPEN_FINDER'}).catch(() => {button.textContent = 'Reload this page to reconnect';}));
  shadow.append(style, button);
  document.body.append(host);
})();
