/**
 * Le navigateur d'une personne, résumé pour une preuve (signature, consentement) — module
 * commun et pur (FAC-5), sorti de la signature des apporteurs. Jamais l'agent complet.
 */

/** « Chrome sur Android », « Safari sur iPhone »… ; jamais l'agent complet. */
export function resumerNavigateur(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navigateur inconnu";
  const sys = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return sys ? `${nav} sur ${sys}` : nav;
}
