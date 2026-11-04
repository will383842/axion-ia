/**
 * Site d'audit servi dans la console : quel document pour quel client.
 *
 * Variable `SITE_AUDIT_DOCUMENTS` (lue par le SITE seul, au déploiement) :
 * entrées séparées par des virgules, format `clientId:projetId:documentId`
 * (trois UUID). Entrée invalide ignorée ; absente ou vide → null.
 * Module PUR : aucun accès base.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function siteAuditDuClient(
  clientId: string,
  env: Record<string, string | undefined> = process.env,
): { projetId: string; documentId: string } | null {
  const brut = env.SITE_AUDIT_DOCUMENTS;
  if (!brut) return null;
  const cherche = clientId.trim().toLowerCase();
  if (!UUID.test(cherche)) return null;
  for (const entree of brut.split(",")) {
    const morceaux = entree.trim().toLowerCase().split(":");
    if (morceaux.length !== 3 || !morceaux.every((m) => UUID.test(m))) continue;
    const [c, projetId, documentId] = morceaux as [string, string, string];
    if (c === cherche) return { projetId, documentId };
  }
  return null;
}

const HOTE_VALIDE = /^[a-z0-9.-]+(:\d+)?$/;

/**
 * Pas de `sandbox` (décision D1). Réseau : UNIQUEMENT le chemin de ce site
 * d'audit (enregistrement automatique) ; hôte illisible → `'none'`.
 */
export function cspSiteAudit(host: string | null | undefined, clientId: string): string {
  const h = (host ?? "").trim().toLowerCase();
  let connect = "'none'";
  if (HOTE_VALIDE.test(h) && UUID.test(clientId.toLowerCase())) {
    const proto = h.startsWith("localhost") || h.startsWith("127.0.0.1") ? "http" : "https";
    connect = `${proto}://${h}/api/admin/site-audit/${clientId.toLowerCase()}/`;
  }
  return `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src ${connect}; form-action 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'`;
}

export function entetesSiteAudit(
  host: string | null | undefined,
  clientId: string,
): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": cspSiteAudit(host, clientId),
  };
}

/** En-têtes des réponses texte (refus) de toutes les routes du site d'audit. */
export const SANS_CACHE: Record<string, string> = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};
