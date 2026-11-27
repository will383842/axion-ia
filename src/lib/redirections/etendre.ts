// S1 (SEO, 404 et chaînes de redirection) — étend et aplatit les règles de `redirects()`.
//
// Problème : une règle `/:locale(fr|en)/X → /:locale/Y` envoie `/en/X` vers `/en/Y`, que le
// proxy renvoie vers `/fr/Y` (2 sauts) ; une adresse sans langue passe par le proxy (qui
// ajoute `/fr`) puis par `next.config` (2 sauts) ; un ancien slug qui pointe vers un autre
// ancien slug fait aussi 2 sauts. Ce module part du tableau littéral de `next.config.ts`
// (inchangé) et le rend « un seul saut » À LA COMPILATION : aucun coût dans le proxy.
//
// Règles générées (jamais une liste à la main) :
//   1. `/:locale(fr|en)/X` → trois règles : `/fr/X`, `/en/X`, `/X`, toutes vers la cible FR ;
//   2. `/fr/X` gagne sa forme sans langue `/X` ;
//   3. une destination `/en/...` passe par `mapEnToFr` (dérivé de `routing.pathnames`) ;
//   4. chaque slug EN de la table EN→FR dont la cible FR est elle-même redirigée reçoit
//      une règle vers la cible finale ;
//   5. aplatissement : une destination qui est elle-même une source est remplacée par la
//      destination finale ; un cycle fait échouer le build.
// Politique : les règles « apporteur », « facebook », « tarifs », « pricing » ne sont JAMAIS
// modifiées (ni étendues ni aplaties) : offres, prix, pages légales et apporteurs restent
// tels que décidés.

import type { Redirect } from "next/dist/lib/load-custom-routes";
import { mapEnToFr, EN_TO_FR_PREFIXES } from "../i18n/en-to-fr-redirect";

export type RegleRedirection = Redirect;

const PREFIXE_LOCALE = "/:locale(fr|en)";
const MOTIF_INTOUCHABLE =
  /apporteur|facebook|tarifs|pricing|journee-ia|mentions-legales|conditions-generales|politique-/;

/** Règles que la politique interdit de toucher. */
export function estIntouchable(r: { source: string; destination: string }): boolean {
  return MOTIF_INTOUCHABLE.test(r.source) || MOTIF_INTOUCHABLE.test(r.destination);
}

function aDesParametres(chemin: string): boolean {
  return chemin.includes(":");
}

function cle(r: RegleRedirection): string {
  return r.has || r.missing ? `${r.source}|${JSON.stringify(r.has ?? r.missing)}` : r.source;
}

export function etendreRedirections(
  regles: readonly RegleRedirection[],
  options: { racinesApp?: readonly string[] } = {},
): RegleRedirection[] {
  const racines = new Set(options.racinesApp ?? []);
  const sortie: RegleRedirection[] = [];
  const vues = new Set<string>();
  const ajouter = (r: RegleRedirection) => {
    const k = cle(r);
    if (vues.has(k)) return;
    vues.add(k);
    sortie.push(r);
  };
  const sansLangue = (r: RegleRedirection, source: string, destination: string) => {
    const premier = source.split("/")[1]?.split(":")[0] ?? "";
    if (racines.has(premier)) return; // jamais une route racine (tour-france-ia, qr, ...)
    ajouter({ ...r, source, destination });
  };

  // Next applique la PREMIÈRE règle qui correspond : une règle `/:locale(fr|en)/X` d'origine
  // capterait `/en/X` avant la forme `/en/X` générée. Chaque règle `:locale` (hors
  // intouchables) est donc REMPLACÉE, à sa place, par ses formes développées.
  for (const r of regles) {
    if (estIntouchable(r)) {
      ajouter(r);
    } else if (r.source.startsWith(`${PREFIXE_LOCALE}/`) || r.source === PREFIXE_LOCALE) {
      const reste = r.source.slice(PREFIXE_LOCALE.length);
      const dest = r.destination.replace(/^\/:locale(?=\/|$)/, "/fr");
      ajouter({ ...r, source: `/fr${reste}`, destination: dest });
      ajouter({ ...r, source: `/en${reste}`, destination: dest });
      sansLangue(r, reste, dest);
    } else {
      ajouter(r);
      if (r.source.startsWith("/fr/")) sansLangue(r, r.source.slice(3), r.destination);
    }
  }

  // 3. destinations /en/... → équivalent FR (un seul saut au lieu de deux).
  for (let i = 0; i < sortie.length; i++) {
    const r = sortie[i]!;
    if (!estIntouchable(r) && r.destination.startsWith("/en/")) {
      sortie[i] = { ...r, destination: mapEnToFr(r.destination) };
    }
  }

  // 4. slugs EN dont la cible FR est elle-même redirigée.
  const sourcesFr = new Set(sortie.filter((r) => !r.has).map((r) => r.source));
  for (const [en, fr] of EN_TO_FR_PREFIXES) {
    if (en.endsWith("/") || aDesParametres(en)) continue;
    if (sourcesFr.has(fr)) {
      const cible = sortie.find((r) => r.source === fr && !r.has)!;
      ajouter({ source: en, destination: cible.destination, permanent: true });
    }
  }
  // Taxonomies du blog en EN : `/en/blog/author/x` → `/fr/blog/auteur/x` → `/fr/blog`.
  ajouter({
    source: "/en/blog/:taxo(author|sector|size)/:rest*",
    destination: "/fr/blog",
    permanent: true,
  });

  // 5. aplatissement.
  const table = new Map<string, RegleRedirection>();
  for (const r of sortie)
    if (!r.has && !r.missing && !aDesParametres(r.source)) table.set(r.source, r);
  for (let i = 0; i < sortie.length; i++) {
    const r = sortie[i]!;
    if (estIntouchable(r)) continue;
    let dest = r.destination;
    const vus = new Set<string>([r.source]);
    for (;;) {
      const suivante = table.get(dest);
      if (!suivante || estIntouchable(suivante)) break;
      if (vus.has(dest)) throw new Error(`Redirection en boucle : ${[...vus, dest].join(" → ")}`);
      vus.add(dest);
      dest = suivante.destination;
    }
    if (dest !== r.destination) sortie[i] = { ...r, destination: dest };
  }
  return sortie;
}
