import { detecterInterdits } from "@/lib/contenu/interdits-publication";
import { evaluerSujetCible } from "@/server/content-gen/sujet-cible";
import { normaliserUrl } from "@/server/content-gen/strategie/carte-requetes";
import type { Proposition, Signalement, Sortie } from "./types";

/**
 * Chemins (sans locale, minuscules) où toute action devient un signalement :
 * section tarifs, catégorie `legal`, pages alimentées par `pricing.ts`,
 * `journee-ia-commun.ts`, `positionnement.ts`. Préfixe de segments : `/tarifs`
 * couvre `/tarifs/x`, pas `/tarifs-complets`. `""` = l'accueil, exact.
 *
 * Liste DÉRIVÉE des imports et VERROUILLÉE par `garde-fous.spec.ts`, qui
 * parcourt `src/app/[locale]/**\/page.tsx`. Les pages dynamiques
 * (`blog/[slug]`, `implantations/[region]/[ville]`) servent aussi des pages
 * non protégées : elles ne sont pas listées (à arbitrer par Will).
 */
export const CHEMINS_PROTEGES: readonly string[] = [
  "",
  "/tarifs",
  "/prix-audit-ia",
  "/audit",
  "/un-a-un",
  "/journee-ia",
  "/formations",
  "/catalogue",
  "/cartographie",
  "/methodologie",
  "/a-propos",
  "/implantations",
  "/apporteur-affaires/video",
  "/reclamations",
  "/mentions-legales",
  "/conditions-generales",
  "/politique-confidentialite",
  "/politique-deplacement",
  "/reglement-interieur",
  "/rgpd",
  "/cookies",
];

function cheminSansLocale(url: string): string | null {
  const n = normaliserUrl(url);
  if (!n) return null;
  const chemin = new URL(n).pathname.replace(/\/+$/, "");
  return chemin.replace(/^\/(?:fr|en)(?=\/|$)/, "");
}

export function estCheminProtege(url: string): boolean {
  const c = cheminSansLocale(url);
  if (c === null) return true; // URL illisible : par prudence, protégée
  return CHEMINS_PROTEGES.some((p) => (p === "" ? c === "" : c === p || c.startsWith(`${p}/`)));
}

const OPTIONS = { actualite: false, financementPublicAutorise: false } as const;

/** Raisons de `evaluerSujetCible` qui écartent une requête pour tout type d'action. */
const RAISONS_ECARTEES_TOUJOURS = new Set(["grenoble"]);

function contientGrenoble(...textes: (string | undefined)[]): boolean {
  return textes.some(
    (t) => t !== undefined && /grenoble/i.test(t.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
  );
}

function ecartee(p: Proposition): boolean {
  if (contientGrenoble(p.requete, p.url, p.pageCible, p.motif)) return true;
  if (p.requete) {
    const v = evaluerSujetCible(p.requete);
    if (!v.accepte && RAISONS_ECARTEES_TOUJOURS.has(v.raison)) return true;
    // Un brief de page nouvelle ne doit jamais viser un sujet hors cible.
    if (p.action === "nouvelle_page" && !v.accepte && v.raison !== "sans_lien_ia") return true;
    if (detecterInterdits(p.requete, OPTIONS).length > 0) return true;
  }
  return false;
}

/** Appliqué à TOUTES les propositions et signalements, après les détecteurs. */
export function appliquerGardeFous(
  propositions: readonly Proposition[],
  signalements: readonly Signalement[] = [],
): Sortie {
  const sortiesProp: Proposition[] = [];
  const sortiesSig: Signalement[] = signalements.filter(
    (s) => !contientGrenoble(s.requete, s.url, s.motif),
  );
  for (const p of propositions) {
    if (ecartee(p)) continue;
    if (estCheminProtege(p.url)) {
      sortiesSig.push({
        kind: "page_protegee",
        detecteur: p.detecteur,
        url: p.url,
        ...(p.requete !== undefined ? { requete: p.requete } : {}),
        motif: `Page protégée : ${p.motif}`,
        actionEvitee: p.action,
      });
      continue;
    }
    sortiesProp.push(p);
  }
  return { propositions: sortiesProp, signalements: sortiesSig };
}
