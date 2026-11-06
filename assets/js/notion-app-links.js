/* Android Chrome: prefer the installed Notion app for user-clicked Notion links.
 * Keep the original HTTPS href for copying, accessibility, and web fallback.
 * A direct anchor navigation is used to preserve Chrome's user-gesture requirement.
 */
(() => {
  'use strict';

  const ua = navigator.userAgent || '';
  if (!/\bAndroid\b/i.test(ua) || !/\b(?:Chrome|EdgA)\/\d+/i.test(ua)) return;

  const notionHosts = new Set(['app.notion.com', 'www.notion.so', 'notion.so']);

  function notionIntent(rawHref) {
    let url;
    try { url = new URL(rawHref, document.baseURI); }
    catch { return null; }

    if (url.protocol !== 'https:' || url.username || url.password ||
        !notionHosts.has(url.hostname.toLowerCase())) return null;

    // Encode an existing fragment as data, not as a second #Intent delimiter.
    const fragment = url.hash ? '%23' + encodeURIComponent(url.hash.slice(1)) : '';
    const destination = url.host + url.pathname + url.search + fragment;
    return 'intent://' + destination +
      '#Intent;scheme=https;action=android.intent.action.VIEW;' +
      'category=android.intent.category.BROWSABLE;package=notion.id;' +
      'S.browser_fallback_url=' + encodeURIComponent(url.href) + ';end';
  }

  document.addEventListener('click', (event) => {
    // Preserve modified clicks, downloads, and existing cancelled interactions.
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey) return;

    const element = event.target?.closest ? event.target : event.target?.parentElement;
    const anchor = element?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;

    const originalHref = anchor.getAttribute('href');
    const intentHref = notionIntent(originalHref);
    if (!intentHref) return;

    const originalTarget = anchor.getAttribute('target');
    // Rewrite synchronously before the anchor's default click action: Chrome
    // sees a real, user-initiated intent: navigation rather than a popup.
    anchor.setAttribute('href', intentHref);
    anchor.removeAttribute('target');
    window.setTimeout(() => {
      if (anchor.getAttribute('href') !== intentHref) return;
      anchor.setAttribute('href', originalHref);
      if (originalTarget === null) anchor.removeAttribute('target');
      else anchor.setAttribute('target', originalTarget);
    }, 0);
  }, true);
})();
