// Utility for client-side routing in MyDeepwork

export function parseRoute() {
  const hash = window.location.hash || '';
  let pathname = window.location.pathname || '/';

  // Support hash routing fallback e.g. #/crm or #/login or #crm
  if ((pathname === '/' || pathname === '') && hash) {
    const hashMatch = /^#\/?([a-zA-Z0-9_-]+)/.exec(hash);
    if (hashMatch && !hash.startsWith('#p.') && !hash.startsWith('#s.')) {
      pathname = '/' + hashMatch[1];
    }
  }

  // Detect public share links: /p/:sid or #p.:sid or #p.slug.sid
  const mPubPath = /^\/p\/([a-zA-Z0-9_-]+)$/i.exec(pathname);
  if (mPubPath) return { name: 'public', sid: mPubPath[1], pathname, search: window.location.search };
  const mPubHash = /^#p\.(?:([A-Za-z0-9_-]+)\.)?([a-zA-Z0-9_-]+)$/i.exec(hash);
  if (mPubHash) return { name: 'public', sid: mPubHash[2], pathname, search: window.location.search };

  // Detect private in-app share links: /s/:sid or #s.:sid
  const mSharePath = /^\/s\/([a-zA-Z0-9_-]+)$/i.exec(pathname);
  if (mSharePath) return { name: 'share', sid: mSharePath[1], pathname, search: window.location.search };
  const mShareHash = /^#s\.(?:([A-Za-z0-9_-]+)\.)?([a-zA-Z0-9_-]+)$/i.exec(hash);
  if (mShareHash) return { name: 'share', sid: mShareHash[2], pathname, search: window.location.search };

  const clean = (pathname.replace(/\/+$/, '') || '/').toLowerCase();

  if (clean === '/' || clean === '') {
    return { name: 'root', pathname: '/', search: window.location.search };
  }
  if (clean === '/login') {
    return { name: 'login', pathname: '/login', search: window.location.search };
  }
  if (clean === '/crm') {
    return { name: 'crm', pathname: '/crm', search: window.location.search };
  }
  if (clean === '/journal') {
    return { name: 'journal', pathname: '/journal', search: window.location.search };
  }
  if (clean === '/lists') {
    return { name: 'lists', pathname: '/lists', search: window.location.search };
  }
  if (clean === '/notes') {
    return { name: 'notes', pathname: '/notes', search: window.location.search };
  }
  if (clean === '/admin') {
    return { name: 'admin', pathname: '/admin', search: window.location.search };
  }

  return { name: 'unknown', pathname: clean, search: window.location.search };
}

export function navigate(to, { replace = false } = {}) {
  if (to.startsWith('http://') || to.startsWith('https://')) {
    if (replace) {
      window.location.replace(to);
    } else {
      window.location.href = to;
    }
    return;
  }

  const current = window.location.pathname + window.location.search + window.location.hash;
  if (!replace && current === to) {
    return;
  }

  if (replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }

  window.dispatchEvent(new Event('popstate'));
}
