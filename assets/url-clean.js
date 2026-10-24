/* ANTOO · Mantiene la URL limpia sin alterar las rutas ni los parámetros funcionales. */
(function () {
  "use strict";
  try {
    const url = new URL(window.location.href);
    const tracking = /^(utm_[a-z0-9_]+|fbclid|gclid|gbraid|wbraid|msclkid|igshid|yclid|mc_cid|mc_eid)$/i;
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (tracking.test(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      // Conserva rutas, otros parámetros, fragmentos y el historial actual.
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch (_) {
    // Nunca impedir que una página abra por problemas con URL/history.
  }
})();
