/**
 * Adaptateur : données DÉJÀ présentes dans le dépôt (data économique sourcée, fiche locale, copy)
 * → `ContenuVille` pour la porte de qualité. Pur : ne lit rien lui-même, ne crée aucun contenu.
 * Les entrées sans source (ou à source non publique) restent dans les blocs : c'est la porte qui
 * les refuse, pas l'adaptateur (il ne trie pas à sa place).
 */

import type { VilleEconomicData } from "@/content/villes/economic-data/types";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";
import type { BlocFait, ContenuVille } from "./porte-qualite-ville";

export interface EntreeVille {
  readonly slug: string;
  readonly nameFr: string;
  readonly copy?: { readonly pitchFr?: string; readonly directAnswerFr?: string } | undefined;
  readonly economicData?: VilleEconomicData | undefined;
  readonly fiche?: FicheLocale | undefined;
  /** Exemple concret d'usage de l'IA propre à la ville. Aucune source de données aujourd'hui. */
  readonly exempleIa?: string | undefined;
}

interface Sourced {
  readonly source: string;
}

/** Un bloc par dimension : texte = libellés joints, source = sources distinctes jointes. */
function blocDepuis<T extends Sourced>(
  id: string,
  entrees: ReadonlyArray<T> | undefined,
  libelle: (e: T) => string,
): BlocFait | undefined {
  if (!entrees || entrees.length === 0) return undefined;
  const sources = [...new Set(entrees.map((e) => e.source.trim()))];
  // Une source vide parmi d'autres reste visible : le bloc porte alors une source invalide.
  const source = sources.includes("") ? "" : sources.join(" ; ");
  return { id, texte: entrees.map(libelle).join(", "), source };
}

export function contenuDepuisEntree(e: EntreeVille): ContenuVille {
  const blocs: BlocFait[] = [];
  const d = e.economicData;
  if (d) {
    const ajouts = [
      blocDepuis("secteurs-dominants", d.topSectorsNaf, (x) => x.label),
      blocDepuis("poles-competitivite", d.polesCompetitivite, (x) => `${x.nom} (${x.secteur})`),
      blocDepuis("zones-activite", d.zonesActivitesParcs, (x) => x.nom),
      blocDepuis("ecoles-universites", d.grandesEcolesEtUniversites, (x) => x.nom),
      blocDepuis("recherche", d.polesRechercheRD, (x) => x.nom),
      blocDepuis("grands-groupes", d.grandsGroupesImplantes, (x) => `${x.nom} (${x.secteur})`),
      blocDepuis("incubateurs", d.incubateursAccelerateurs, (x) => x.nom),
      blocDepuis("marques-historiques", d.marquesHistoriques, (x) => `${x.nom} (${x.secteur})`),
      blocDepuis("produits-igp-aop", d.produitsIgpAop, (x) => x.nom),
      blocDepuis("salons", d.salonsSectoriels, (x) => `${x.nom} (${x.secteur})`),
      blocDepuis(
        "specificites-locales",
        d.specificitesLocales,
        (x) => `${x.theme} : ${x.description}`,
      ),
    ];
    for (const b of ajouts) if (b) blocs.push(b);
    if (d.statsInsee) {
      const s = d.statsInsee;
      blocs.push({
        id: "stats-insee",
        texte: `établissements actifs ${s.etablissementsActifs ?? "n/d"}, créations d'entreprises ${s.creationsEntreprises ?? "n/d"}, année ${s.anneeReference}`,
        source: s.source,
      });
    }
  }
  const f = e.fiche;
  if (f) {
    blocs.push({
      id: "fiche-secteurs",
      texte: f.entreprises.secteurs
        .map((x) => `${x.libelle} ${x.etablissements} établissements ${x.salaries} salariés`)
        .join(", "),
      source: f.entreprises.urlSecteurs,
    });
    blocs.push({
      id: "fiche-institutions",
      texte: f.institutions.map((i) => `${i.nom} ${i.role}`).join(", "),
      source: f.institutions[0]?.url ?? "",
    });
    blocs.push({
      id: "fiche-epci",
      texte: `${f.epci.nom} ${f.epci.nombreCommunes} communes ${f.epci.population} habitants`,
      source: f.epci.url,
    });
  }
  const texteVisible = [
    e.copy?.pitchFr ?? "",
    e.copy?.directAnswerFr ?? "",
    f ? `${f.prose.tissu} ${f.prose.ecosysteme} ${f.prose.zone}` : "",
    ...blocs.map((b) => b.texte),
  ]
    .filter((t) => t.trim().length > 0)
    .join(" ");
  return {
    slug: e.slug,
    nom: e.nameFr,
    blocsFaits: blocs,
    texteVisible,
    ...(e.exempleIa ? { exempleIa: e.exempleIa } : {}),
  };
}
