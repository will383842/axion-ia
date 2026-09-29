// État du jeton de l'appareil, côté extension (fonction PURE).
//
// Jeton absent ou expiré : l'extension REFUSE de démarrer une capture
// (« renouvelez-le dans la console, prenez des notes à la main »). Badge orange
// à J-14, rouge à J-3.

const JOUR_MS = 86400000;
const FORMAT = /^[0-9a-f]{64}$/;

/**
 * @param {string | null | undefined} jeton
 * @param {string | null | undefined} expireLeIso  date d'expiration rendue par le site
 * @param {number} maintenantMs
 */
export function etatJeton(jeton, expireLeIso, maintenantMs) {
  if (!jeton || !FORMAT.test(jeton)) {
    return {
      peutDemarrer: false,
      niveau: "absent",
      message:
        "Aucun jeton : créez-le dans la console (Rendez-vous → Enregistreur) et collez-le dans les options.",
    };
  }
  if (!expireLeIso) {
    // Jamais vérifié par le site : on laisse démarrer, le site tranchera (401).
    return {
      peutDemarrer: true,
      niveau: "inconnu",
      message: "Jeton pas encore vérifié par le site.",
    };
  }
  const reste = Date.parse(expireLeIso) - maintenantMs;
  if (!Number.isFinite(reste) || reste <= 0) {
    return {
      peutDemarrer: false,
      niveau: "expire",
      message: "Jeton expiré : renouvelez-le dans la console, et prenez des notes à la main.",
    };
  }
  const jours = Math.floor(reste / JOUR_MS);
  if (jours <= 3)
    return {
      peutDemarrer: true,
      niveau: "rouge",
      message: `Le jeton expire dans ${jours} jour(s).`,
    };
  if (jours <= 14)
    return {
      peutDemarrer: true,
      niveau: "orange",
      message: `Le jeton expire dans ${jours} jours.`,
    };
  return { peutDemarrer: true, niveau: "ok", message: "" };
}

/** Un jeton rejeté par le site (401) : l'extension le marque expiré. */
export function jetonRefuseParLeSite(statutHttp) {
  return statutHttp === 401 || statutHttp === 403;
}
