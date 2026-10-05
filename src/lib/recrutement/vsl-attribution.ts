/**
 * Prélèvement du `fbclid` (identifiant de clic Meta) pour la page VSL apporteurs.
 *
 * ── Pourquoi on le garde ──────────────────────────────────────────────────
 * Le formulaire a deux étapes sur la même page, puis part ailleurs : si on ne le
 * retient pas à l'arrivée, il est perdu (plan 01 §3.3). Avec l'HEURE du clic, le
 * serveur fabrique un `fbc` correct pour l'API de conversions.
 *
 * ── Consentement ──────────────────────────────────────────────────────────
 * Le `fbclid` ne sert qu'à Meta : il n'est retenu QUE si le visiteur a accepté
 * la bannière publicitaire (comme `_fbp`). Sans « accepté », rien n'est écrit.
 *
 * Stockage : `sessionStorage` (meurt avec l'onglet), jamais un cookie ni
 * `localStorage`. Toute erreur de stockage est avalée.
 */

const CLE = "axion-vsl-fbclid";

/** Les `fbclid` réels sont alphanumériques avec `_`, `-` ; on borne et on filtre. */
const FBCLID_RE = /^[A-Za-z0-9_-]{8,500}$/;

export function extraireFbclid(search: string): string | null {
  const m = /[?&]fbclid=([^&#]+)/.exec(search);
  const v = m?.[1];
  return v && FBCLID_RE.test(v) ? v : null;
}

export interface FbclidMemorise {
  fbclid: string;
  at: number;
}

export function lireFbclid(): FbclidMemorise | null {
  try {
    const brut = window.sessionStorage.getItem(CLE);
    if (!brut) return null;
    const o = JSON.parse(brut) as Partial<FbclidMemorise>;
    if (typeof o.fbclid === "string" && FBCLID_RE.test(o.fbclid) && typeof o.at === "number") {
      return { fbclid: o.fbclid, at: o.at };
    }
  } catch {
    // illisible : ignoré
  }
  return null;
}

/**
 * Retient le `fbclid` de l'adresse — seulement si `consentementAccepte`. Garde le
 * premier clic : une page rechargée plus tard ne repousse pas l'heure.
 */
export function memoriserFbclid(
  search: string,
  consentementAccepte: boolean,
  maintenant: number = Date.now(),
): void {
  if (!consentementAccepte) return;
  const fbclid = extraireFbclid(search);
  if (!fbclid) return;
  try {
    if (lireFbclid()?.fbclid === fbclid) return;
    window.sessionStorage.setItem(CLE, JSON.stringify({ fbclid, at: maintenant }));
  } catch {
    // Stockage indisponible : le contexte partira sans `fbclid`, ce n'est pas bloquant.
  }
}
