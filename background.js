'use strict';
function amazonTab(sender) {
  try { return sender.id === chrome.runtime.id && ['www.amazon.in', 'amazon.in'].includes(new URL(sender.tab?.url).hostname); } catch { return false; }
}
async function openFinder(tabId) {
  const launch = new URL(chrome.runtime.getURL('dashboard.html'));
  launch.searchParams.set('scan', '1');
  if (Number.isInteger(tabId)) launch.searchParams.set('source', String(tabId));
  const url = launch.href;
  const existing = await chrome.tabs.query({url: chrome.runtime.getURL('dashboard.html') + '*'});
  if (existing[0]) await chrome.tabs.update(existing[0].id, {active: true, url});
  else await chrome.tabs.create({url});
}
chrome.action.onClicked.addListener(tab => openFinder(tab.id).catch(console.error));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'OPEN_FINDER' && amazonTab(sender)) {
    openFinder(sender.tab.id).then(() => respond({ok: true})).catch(() => respond({ok: false}));
    return true;
  }
});
