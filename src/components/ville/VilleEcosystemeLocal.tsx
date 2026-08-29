/**
 * VilleEcosystemeLocal — Section « écosystème économique local » (Server Component).
 *
 * Sprint A · Phase 4 ville-1 (Will 2026-05-25). Rendu sur les pages hub ville
 * `/fr/implantations/{region}/{ville}` et les pages verticales
 * `/fr/implantations/{region}/{ville}/{verticale}` pour donner du fond éditorial
 * (intro factuelle, 3-5 secteurs économiques, institutions présentes dans le
 * tissu local). MATIÈRE éditoriale unique anti-doorway HCU 2024.
 *
 * RÈGLE ABSOLUE : aucune institution mentionnée n'est partenaire/client/
 * certificateur d'Axion-IA. Wording = « la ville accueille X », « siège
 * historique de Y », « campus de Z ». Pas de « certifié par », « partenaire »,
 * « validé par ».
 *
 * Data : utilise `ECONOMIC_DATA_BY_SLUG` (39 villes top, ~100% sources INSEE/
 * Wikipédia/sites officiels — voir `src/content/villes/economic-data/types.ts`)
 * + fallback générique pour les ~2060 autres villes du dataset.
 */

import type { City } from "@/lib/cities";
import type { VerticaleSlug } from "@/components/services/types";
import { ECONOMIC_DATA_BY_SLUG } from "@/content/villes/economic-data";

/**
 * Prop `ville` — accepte le type Prisma `City` (modèle `cities` du schema).
 * Aliasé `Ville` au sein du composant pour le wording FR canonique de la
 * marque. Tous les champs lus sont optionnels-safe au render.
 */
type Ville = City;

interface VilleEcosystemeLocalProps {
  readonly ville: Ville;
  readonly isFr: boolean;
  readonly verticale?: VerticaleSlug;
}

/**
 * Mapping fallback générique pour les villes hors `ECONOMIC_DATA_BY_SLUG`.
 * 5 secteurs B2B-pertinents universels — pas d'institution nommée (zéro invention).
 */
const FALLBACK_SECTEURS_FR: ReadonlyArray<string> = [
  "Commerce et services aux entreprises",
  "Santé et action sociale",
  "Industrie manufacturière",
  "Construction et BTP",
  "Hébergement et restauration",
];
const FALLBACK_SECTEURS_EN: ReadonlyArray<string> = [
  "Commerce and business services",
  "Health and social care",
  "Manufacturing industry",
  "Construction and BTP",
  "Hospitality and food services",
];

/** Statut chef-lieu (préfecture de département) déterminé à partir du code INSEE. */
function isPrefectureDepartement(ville: Ville): boolean {
  // Préfecture = code INSEE de la commune chef-lieu de département.
  // Approximation : si le code INSEE se termine par "XX001" ou "75056" (Paris),
  // beaucoup mais pas toutes le sont. On reste prudent — affichage uniquement
  // si on est sûr (top 13 préfectures régionales hardcodées).
  const TOP_PREFECTURES_INSEE = new Set([
    "75056", // Paris
    "13055", // Marseille
    "69123", // Lyon
    "31555", // Toulouse
    "06088", // Nice
    "44109", // Nantes
    "34172", // Montpellier
    "67482", // Strasbourg
    "33063", // Bordeaux
    "59350", // Lille
    "35238", // Rennes
    "21231", // Dijon
    "45234", // Orléans
    "76540", // Rouen
    "14118", // Caen
    "63113", // Clermont-Ferrand
    "57463", // Metz
    "54395", // Nancy
    "80021", // Amiens
    "51454", // Reims (sous-préfecture en réalité mais notable)
    "86194", // Poitiers
    "87085", // Limoges
    "25056", // Besançon
    "20004", // Ajaccio
  ]);
  return TOP_PREFECTURES_INSEE.has(ville.inseeCode);
}

/** Format population FR (espaces fines) / EN (commas). */
function formatPopulation(n: number, isFr: boolean): string {
  return new Intl.NumberFormat(isFr ? "fr-FR" : "en-US").format(n);
}

/**
 * Adaptation par verticale — phrase neutre rattachée au tissu économique.
 * Évite tout claim de partenariat / certification / client.
 */
function getVerticaleSentence(
  verticale: VerticaleSlug | undefined,
  villeName: string,
  isFr: boolean,
): string | null {
  if (!verticale) return null;
  if (isFr) {
    switch (verticale) {
      case "audits":
        return `Audits IA réalisables dans le tissu économique de ${villeName} — PME, ETI et grands groupes inclus.`;
      case "implementations":
        return `Projets d'implémentation IA typiques pour les organisations de ${villeName} et de son bassin économique.`;
      case "interventions":
        return `Interventions terrain et formations IA adaptées aux secteurs représentés à ${villeName}.`;
      case "un-a-un":
        return `Accompagnement individuel de dirigeants exerçant à ${villeName} ou dans son bassin.`;
      case "sites-web-ia":
        return `Sites web et solutions digitales IA pensés pour les organisations implantées à ${villeName}.`;
      default:
        return null;
    }
  }
  switch (verticale) {
    case "audits":
      return `AI audits feasible in the ${villeName} economic fabric — micro-businesses, SMEs, mid-caps and large groups included.`;
    case "implementations":
      return `Typical AI implementation projects for organisations in ${villeName} and its economic area.`;
    case "interventions":
      return `On-site AI interventions and training tailored to sectors represented in ${villeName}.`;
    case "un-a-un":
      return `One-to-one coaching for executives operating in ${villeName} or its economic area.`;
    case "sites-web-ia":
      return `AI-powered websites and digital solutions designed for organisations established in ${villeName}.`;
    default:
      return null;
  }
}

/**
 * Construit la liste des institutions présentes (≤ 4) à partir de la data
 * économique enrichie. Phrasing factuel uniquement.
 */
function buildInstitutionsList(slug: string): ReadonlyArray<string> {
  const data = ECONOMIC_DATA_BY_SLUG[slug];
  if (!data) return [];
  const out: string[] = [];

  // Pôles compétitivité (institutions de l'écosystème, pas partenaires Axion-IA)
  if (data.polesCompetitivite && data.polesCompetitivite.length > 0) {
    const pole = data.polesCompetitivite[0];
    if (pole) out.push(pole.nom);
  }
  // Pôles recherche publique (Inria, CEA, CNRS…)
  if (data.polesRechercheRD && data.polesRechercheRD.length > 0) {
    const recherche = data.polesRechercheRD[0];
    if (recherche) out.push(recherche.nom);
  }
  // Grandes écoles / universités
  if (data.grandesEcolesEtUniversites && data.grandesEcolesEtUniversites.length > 0) {
    const ecole = data.grandesEcolesEtUniversites[0];
    if (ecole) out.push(ecole.nom);
  }
  // Incubateur (Station F, Wilco, NUMA…)
  if (data.incubateursAccelerateurs && data.incubateursAccelerateurs.length > 0) {
    const incub = data.incubateursAccelerateurs[0];
    if (incub) out.push(incub.nom);
  }
  // French Tech (capitale ou communauté)
  if (data.capitaleFrenchTech?.nomChapitre) {
    out.push(data.capitaleFrenchTech.nomChapitre);
  }

  return out.slice(0, 4);
}

/**
 * Construit la liste des 3-5 secteurs économiques principaux.
 * Priorité : `topSectorsNaf` (sourcé INSEE). Fallback générique sinon.
 */
function buildSecteursList(slug: string, isFr: boolean): ReadonlyArray<string> {
  const data = ECONOMIC_DATA_BY_SLUG[slug];
  if (data?.topSectorsNaf && data.topSectorsNaf.length > 0) {
    return data.topSectorsNaf.slice(0, 5).map((s) => s.label);
  }
  return (isFr ? FALLBACK_SECTEURS_FR : FALLBACK_SECTEURS_EN).slice(0, 5);
}

/**
 * JSON-LD `Place` schema.org — décrit la ville comme lieu géographique
 * contenu dans la région. Pas de geo.latitude/longitude (la ville a ces
 * champs mais on ne les expose pas ici — réservé aux pages LocalBusiness).
 */
function buildPlaceJsonLd(ville: Ville): string {
  const place = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: ville.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: ville.name,
      addressRegion: ville.regionName,
      addressCountry: "FR",
    },
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: ville.regionName,
    },
  };
  return JSON.stringify(place);
}

/**
 * Section écosystème local — intro factuelle ville (population, statut),
 * grid 3-5 secteurs, mention institutions de l'écosystème (sans claim
 * partenariat), adaptation par verticale optionnelle.
 */
export function VilleEcosystemeLocal({ ville, isFr, verticale }: VilleEcosystemeLocalProps) {
  // Will 2026-05-26 : `secteurs` plus utilisé ici (section retirée pour éviter
  // duplication avec VilleTissuEconomique). Conservé en helper pour build
  // mais nettoyé du rendu — préfixe `_` pour ESLint no-unused-vars.
  const _secteurs = buildSecteursList(ville.slug, isFr);
  const institutions = buildInstitutionsList(ville.slug);
  const isPrefecture = isPrefectureDepartement(ville);
  const verticaleSentence = getVerticaleSentence(verticale, ville.name, isFr);
  const headingId = `ville-ecosysteme-${ville.slug}`;

  // Intro ville — population + statut. Gracieux si population = 0 (improbable).
  const populationStr = ville.population > 0 ? formatPopulation(ville.population, isFr) : null;
  const introFr = (() => {
    const parts: string[] = [];
    if (populationStr) {
      parts.push(
        `${ville.name} compte environ ${populationStr} habitants dans le département ${ville.departmentName}.`,
      );
    } else {
      parts.push(`${ville.name} est située dans le département ${ville.departmentName}.`);
    }
    if (isPrefecture) {
      parts.push(
        `Préfecture de département, elle joue un rôle structurant pour son bassin économique.`,
      );
    }
    return parts.join(" ");
  })();
  const introEn = (() => {
    const parts: string[] = [];
    if (populationStr) {
      parts.push(
        `${ville.name} has around ${populationStr} inhabitants in the ${ville.departmentName} department.`,
      );
    } else {
      parts.push(`${ville.name} is located in the ${ville.departmentName} department.`);
    }
    if (isPrefecture) {
      parts.push(`As prefecture, it plays a structuring role for its economic area.`);
    }
    return parts.join(" ");
  })();

  return (
    <section
      aria-labelledby={headingId}
      className="bg-paper text-ink relative py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Données et institutions" : "Données et institutions"}
        </p>

        {/* H2 — Will 2026-05-26 : renommé pour lever la redondance avec
            VilleTissuEconomique qui parle aussi de tissu économique. Cette
            section = data INSEE + institutions ; VilleTissuEconomique = secteurs
            B2B + leviers IA. Rôles clairement distincts. */}
        <h2
          id={headingId}
          className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? (
            <>
              L&apos;écosystème de <span className="text-terracotta italic">{ville.name}</span>
            </>
          ) : (
            <>
              L&apos;écosystème de <span className="text-terracotta italic">{ville.name}</span>
            </>
          )}
        </h2>

        {/* Intro factuelle */}
        <p className="text-fg-soft mt-6 max-w-3xl text-base leading-relaxed sm:text-lg">
          {isFr ? introFr : introEn}
        </p>

        {/* Adaptation verticale (optionnelle) */}
        {verticaleSentence ? (
          <p className="text-fg-soft mt-3 max-w-3xl text-base leading-relaxed sm:text-lg">
            {verticaleSentence}
          </p>
        ) : null}

        {/* Sous-section « Secteurs économiques principaux » RETIRÉE
            (Will 2026-05-26) — dupliquait VilleTissuEconomique. Les secteurs
            macro NAF sont remplacés par le tableau B2B « Secteurs et leviers IA »
            du composant TissuEconomique qui suit. Conservation ici de la
            section Institutions (donnée unique à ce composant). */}

        {/* Institutions présentes (sans claim partenariat) */}
        {institutions.length > 0 ? (
          <div className="mt-14">
            <h3
              className="text-fg mb-4 text-xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr
                ? `Institutions présentes dans l'écosystème de ${ville.name}`
                : `Institutions present in the ${ville.name} ecosystem`}
            </h3>
            <p className="text-fg-soft mb-5 max-w-3xl text-base leading-relaxed">
              {isFr
                ? `${ville.name} accueille plusieurs institutions structurantes pour son tissu économique :`
                : `${ville.name} hosts several structuring institutions for its economic fabric:`}
            </p>
            <ul role="list" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              {institutions.map((nom, idx) => (
                <li
                  key={`${ville.slug}-inst-${idx}`}
                  className="bg-bg border-border-strong/30 text-fg inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                  />
                  <span className="font-medium">{nom}</span>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-4 max-w-3xl text-xs leading-relaxed">
              {isFr
                ? "Mention informative de l'écosystème local. Axion-IA n'a aucune relation commerciale, partenariat ou certification avec ces institutions."
                : "Informative mention of the local ecosystem. Axion-IA has no commercial relationship, partnership, or certification with these institutions."}
            </p>
          </div>
        ) : null}

        {/* JSON-LD Place (schema.org) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildPlaceJsonLd(ville) }}
        />
      </div>
    </section>
  );
}
