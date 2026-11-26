/**
 * Maillage vérifié de l'équipe éditoriale (PR 8).
 *
 * - un lien interne n'est accepté que s'il vise une route connue du routage i18n ;
 * - un lien externe est contrôlé par HTTP (HEAD, puis GET de repli) : on refuse
 *   toute redirection et tout code ≠ 200 ;
 * - une source de faible fiabilité (niveau `low`, ou `excluded`) est refusée.
 *
 * Tout est éteint par défaut : seul `CONTENT_EQUIPE_EDITORIALE=true` l'active.
 * Éteint, `filtrerLiensMaillage` rend les liens tels quels, sans aucun appel réseau.
 */

import { routing } from "@/i18n/routing";
import { computeTrustTier, extractDomain } from "../links/trust-tier";

export const DELAI_CONTROLE_HTTP_MS = 4000;

export function equipeEditorialeActive(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env["CONTENT_EQUIPE_EDITORIALE"] === "true";
}

export type NiveauSource = "official" | "high" | "standard" | "low" | "excluded";

export interface VerdictLien {
  readonly ok: boolean;
  readonly raison?: string;
}

const ROUTES_CONNUES: readonly string[] = Object.keys(routing.pathnames);

function segments(p: string): string[] {
  return p.split("/").filter(Boolean);
}

/** Vrai si le chemin correspond à une clé de `pathnames` (segments `[x]` = joker). */
export function estRouteInterneConnue(
  url: string,
  routes: readonly string[] = ROUTES_CONNUES,
): boolean {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return false;
  const chemin = url.split(/[?#]/)[0] ?? "";
  let segs = segments(chemin);
  // EN est désactivé (/en/* → 301) : jamais de lien /en/…
  if (segs[0] === "en") return false;
  if (segs[0] === "fr") segs = segs.slice(1);
  if (url.includes("\\")) return false;
  if (segs.some((s) => s === "." || s === "..")) return false;
  return routes.some((route) => {
    const modele = segments(route);
    if (modele.length !== segs.length) return false;
    return modele.every((m, i) => (m.startsWith("[") && m.endsWith("]") ? true : m === segs[i]));
  });
}

export function verifierLienInterne(
  url: string,
  routes: readonly string[] = ROUTES_CONNUES,
): VerdictLien {
  return estRouteInterneConnue(url, routes)
    ? { ok: true }
    : { ok: false, raison: "route-inconnue" };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface OptionsLienExterne {
  readonly fetchImpl?: FetchLike;
  readonly delaiMs?: number;
  /** Niveau connu de la source (sinon déduit du domaine). */
  readonly niveau?: NiveauSource | undefined;
}

function hoteInterdit(h: string): boolean {
  const hote = h.toLowerCase().replace(/\.+$/, "");
  return (
    !hote.includes(".") ||
    hote === "localhost" ||
    hote.endsWith(".localhost") ||
    hote.endsWith(".internal") ||
    hote.endsWith(".local") ||
    hote.startsWith("[") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hote)
  );
}

/** Niveau du domaine ; un sous-domaine d'un domaine exclu est exclu. */
function niveauDuDomaine(domaine: string): NiveauSource {
  const parts = domaine.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (computeTrustTier(parts.slice(i).join(".")) === "excluded") return "excluded";
  }
  return computeTrustTier(domaine);
}

async function requete(
  fetchImpl: FetchLike,
  url: string,
  method: "HEAD" | "GET",
  delaiMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), delaiMs);
  try {
    return await fetchImpl(url, { method, redirect: "manual", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function verifierLienExterne(
  url: string,
  options: OptionsLienExterne = {},
): Promise<VerdictLien> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, raison: "url-invalide" };
  }
  if (u.protocol !== "https:") return { ok: false, raison: "protocole" };
  if (u.port !== "" && u.port !== "443") return { ok: false, raison: "port" };
  if (hoteInterdit(u.hostname)) return { ok: false, raison: "hote-interdit" };

  const domaine = extractDomain(url) ?? u.hostname;
  const niveau: NiveauSource = options.niveau ?? niveauDuDomaine(domaine);
  if (niveau === "low" || niveau === "excluded") return { ok: false, raison: "source-faible" };

  const fetchImpl: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init));
  const delai = options.delaiMs ?? DELAI_CONTROLE_HTTP_MS;

  let rep: Response | null = null;
  try {
    rep = await requete(fetchImpl, url, "HEAD", delai);
  } catch {
    rep = null;
  }
  // HEAD refusé ou en échec : on retente en GET avant de conclure.
  if (rep !== null && [403, 405, 501].includes(rep.status))
    await rep.body?.cancel().catch(() => {});
  if (rep === null || rep.status === 405 || rep.status === 501 || rep.status === 403) {
    try {
      rep = await requete(fetchImpl, url, "GET", delai);
    } catch {
      return { ok: false, raison: "injoignable" };
    }
  }
  await rep.body?.cancel().catch(() => {});
  if (rep.status >= 300 && rep.status < 400) return { ok: false, raison: "redirection" };
  if (rep.status !== 200) return { ok: false, raison: `code-${rep.status}` };
  return { ok: true };
}

export interface LienACtrl {
  readonly url: string;
  readonly niveau?: NiveauSource;
}

export interface LienControle extends LienACtrl {
  readonly verdict: VerdictLien;
}

/**
 * Contrôle une liste de liens. Interrupteur éteint : liens rendus tels quels
 * (verdict `ok`), aucun contrôle ni réseau — comportement d'avant.
 */
export async function filtrerLiensMaillage(
  liens: readonly LienACtrl[],
  options: OptionsLienExterne & { env?: Record<string, string | undefined> } = {},
): Promise<LienControle[]> {
  if (!equipeEditorialeActive(options.env ?? process.env)) {
    return liens.map((l) => ({ ...l, verdict: { ok: true } }));
  }
  return Promise.all(
    liens.map(async (l) => ({
      ...l,
      verdict: l.url.startsWith("/")
        ? verifierLienInterne(l.url)
        : await verifierLienExterne(l.url, { ...options, niveau: l.niveau ?? options.niveau }),
    })),
  );
}
