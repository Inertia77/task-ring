/* Android Notion links: direct app attempt without an automatic web fallback.
 * If the Android browser rejects the intent, keep the user in this site
 * with an explicit retry and copy-original-link escape hatch.
 */
(() => {
  'use strict';

  if (!/\bAndroid\b/i.test(navigator.userAgent || '')) return;

  const notionHosts = new Set(['app.notion.com', 'www.notion.so', 'notion.so']);
  let guide = null;
  let activeUrl = '';
  let activeIntent = '';

  function resolveNotion(raw) {
    let url;
    try { url = new URL(raw, document.baseURI); }
    catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password ||
        !notionHosts.has(url.hostname.toLowerCase())) return null;
    return url;
  }

  function toIntent(url) {
    const fragment = url.hash ? '%23' + encodeURIComponent(url.hash.slice(1)) : '';
    return 'intent://' + url.host + url.pathname + url.search + fragment +
      '#Intent;scheme=https;action=android.intent.action.VIEW;' +
      'category=android.intent.category.BROWSABLE;package=notion.id;end';
  }

  function closeGuide() {
    if (guide) guide.hidden = true;
  }

  function ensureGuide() {
    if (guide) return guide;

    const style = document.createElement('style');
    style.dataset.notionLinkGuideStyle = '';
    style.textContent = [
      '.notion-link-guide-root[hidden]{display:none!important}',
      '.notion-link-guide-root{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding:12px;font-family:system-ui,-apple-system,sans-serif}',
      '.notion-link-guide-shade{position:absolute;inset:0;background:rgba(0,0,0,.55)}',
      '.notion-link-guide-panel{position:relative;width:min(100%,440px);box-sizing:border-box;padding:23px;border-radius:20px;background:#171b26;color:#f5f7ff;box-shadow:0 18px 65px rgba(0,0,0,.45)}',
      '.notion-link-guide-panel h2{font-size:18px;font-weight:700;margin:0 0 12px}',
      '.notion-link-guide-panel p{font-size:14px;line-height:1.6;color:#c6ccd9;margin:0 0 16px}',
      '.notion-link-guide-panel .notion-link-guide-action{display:block;box-sizing:border-box;width:100%;margin-top:9px;border:0;border-radius:11px;padding:13px;text-align:center;text-decoration:none;font:600 15px system-ui,-apple-system,sans-serif;cursor:pointer}',
      '.notion-link-guide-panel .notion-link-guide-primary{background:#458dff;color:white}',
      '.notion-link-guide-panel .notion-link-guide-secondary{background:#323849;color:#f5f7ff}',
      '.notion-link-guide-panel .notion-link-guide-close{position:absolute;top:12px;right:13px;border:0;background:transparent;color:#e4e8f1;font-size:23px;cursor:pointer;padding:2px 8px}',
      '@media(min-width:600px){.notion-link-guide-root{align-items:center}}'
    ].join('\n');
    document.head.appendChild(style);

    guide = document.createElement('div');
    guide.className = 'notion-link-guide-root';
    guide.setAttribute('data-notion-link-guide', '');
    guide.hidden = true;
    guide.innerHTML =
      '<div class="notion-link-guide-shade" data-notion-close></div>' +
      '<section class="notion-link-guide-panel" role="dialog" aria-modal="true" aria-labelledby="notionLinkGuideTitle">' +
      '<button type="button" class="notion-link-guide-close" data-notion-close aria-label="关闭">×</button>' +
      '<h2 id="notionLinkGuideTitle">正在尝试打开 Notion App</h2>' +
      '<p>如果没有跳转到 Notion，请点击下方的“重新尝试”。此处不会自动打开不兼容的系统浏览器。</p>' +
      '<a class="notion-link-guide-action notion-link-guide-primary" data-notion-retry>重新尝试打开 Notion App</a>' +
      '<button type="button" class="notion-link-guide-action notion-link-guide-secondary" data-notion-copy>复制原始 Notion 链接</button>' +
      '</section>';
    document.body.appendChild(guide);
    guide.addEventListener('click', (event) => {
      if (event.target.closest('[data-notion-close]')) closeGuide();
    });
    guide.querySelector('[data-notion-copy]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(activeUrl);
        button.textContent = '已复制链接';
      } catch {
        // A selectable field works even when clipboard permission is denied.
        const field = document.createElement('textarea');
        field.value = activeUrl;
        field.setAttribute('readonly', '');
        field.style.cssText = 'width:100%;height:75px;margin-top:10px';
        guide.querySelector('.notion-link-guide-panel').appendChild(field);
        field.focus();
        field.select();
        button.textContent = '请选择并复制下方链接';
      }
    });
    return guide;
  }

  function showGuide(url, intent) {
    activeUrl = url;
    activeIntent = intent;
    const panel = ensureGuide();
    const retry = panel.querySelector('[data-notion-retry]');
    retry.href = activeIntent;
    retry.removeAttribute('target');
    panel.querySelector('[data-notion-copy]').textContent = '复制原始 Notion 链接';
    panel.hidden = false;
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey) return;
    const element = event.target?.closest ? event.target : event.target?.parentElement;
    if (element?.closest?.('[data-notion-link-guide]')) return;
    const anchor = element?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;

    const originalHref = anchor.getAttribute('href');
    const notion = resolveNotion(originalHref);
    if (!notion) return;
    const intent = toIntent(notion);
    showGuide(notion.href, intent);

    const originalTarget = anchor.getAttribute('target');
    anchor.setAttribute('href', intent);
    anchor.removeAttribute('target');
    window.setTimeout(() => {
      if (anchor.getAttribute('href') !== intent) return;
      anchor.setAttribute('href', originalHref);
      if (originalTarget === null) anchor.removeAttribute('target');
      else anchor.setAttribute('target', originalTarget);
    }, 0);
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) closeGuide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGuide();
  });
})();
