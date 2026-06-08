// Server Component — ⭐ « Votre territoire de vente ». SECTION VARIABLE =
// cœur anti-doorway, données INSEE/economic-data RÉELLES. Refonte 2026-06-08
// (Will) : 3 blocs aérés (marché / périmètre / secteur exclusif), labels
// nettoyés, SANS les « grands comptes » (trompeur : ce ne sont pas nos clients).

import type { ReactNode } from "react";
import { Factory, Map as MapIcon, ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { fmtNumber } from "@/lib/intl";

export interface TerritorySector {
  readonly label: string;
  readonly count?: number | undefined;
}
export interface TerritoryGroup {
  readonly nom: string;
  readonly secteur: string;
}
export interface TerritoryCommune {
  readonly nameFr: string;
  readonly distanceKm?: number | undefined;
}

export interface CommercialTerritoryProps {
  readonly isFr: boolean;
  readonly villeName: string;
  readonly departementLabel?: string | undefined;
  readonly region?: string | undefined;
  readonly etablissementsActifs?: number | undefined;
  readonly creationsEntreprises?: number | undefined;
  readonly anneeReference?: number | undefined;
  readonly topSectors: ReadonlyArray<TerritorySector>;
  readonly grandsGroupes: ReadonlyArray<TerritoryGroup>;
  readonly communesBassin: ReadonlyArray<TerritoryCommune>;
  readonly specificite?: string | undefined;
}

/** Nettoie un libellé secteur NAF du jargon « (sections G+H+I) » etc. */
function cleanSector(label: string): string {
  return label
    .replace(/\s*\(sections?[^)]*\)/gi, "")
    .replace(/\s+—.*$/, "")
    .trim();
}

export function CommercialTerritory(props: CommercialTerritoryProps): ReactNode {
  const {
    isFr,
    villeName,
    departementLabel,
    region,
    etablissementsActifs,
    creationsEntreprises,
    anneeReference,
    topSectors,
    communesBassin,
  } = props;
  const loc = isFr ? "fr" : "en";

  // Bloc 2 — lignes du périmètre.
  const perimeter: ReadonlyArray<{ label: string; value: string }> = [
    { label: isFr ? "Ville & agglomération" : "City & metro", value: villeName },
    ...(departementLabel
      ? [{ label: isFr ? "Département" : "Department", value: departementLabel }]
      : []),
    ...(region ? [{ label: isFr ? "Région" : "Region", value: region }] : []),
    {
      label: isFr ? "Votre portefeuille" : "Your portfolio",
      value: isFr ? "Conservé" : "Kept",
    },
  ];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Votre territoire de vente" : "Your sales territory"}
      title={isFr ? "Un terrain de jeu large," : "A wide playing field,"}
      titleEm={isFr ? "à vous de le couvrir" : "yours to cover"}
      description={
        isFr
          ? `Votre secteur n'est pas qu'une ville : ${villeName}, son agglomération et tout le département${departementLabel ? ` (${departementLabel})` : ""}${region ? `, jusqu'à la région ${region}` : ""} — plus votre propre portefeuille, que vous gardez.`
          : `Your sector isn't just a city: ${villeName}, its metro area and the whole department${region ? `, up to the ${region} region` : ""} — plus your own portfolio, which you keep.`
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {/* BLOC 1 — Le marché à prendre */}
        <div className="border-terracotta/20 bg-halo-warm flex flex-col rounded-3xl border-2 p-7">
          <span className="bg-paper text-terracotta mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
            <Factory aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-lg font-semibold tracking-tight">
            {isFr ? "Un marché à prendre" : "A market to win"}
          </h3>
          {etablissementsActifs != null ? (
            <p className="mt-3">
              <span className="text-terracotta-deep font-mono text-4xl font-semibold tabular-nums">
                {fmtNumber(etablissementsActifs, loc)}
              </span>
              <span className="text-fg-soft block text-sm">
                {isFr
                  ? `entreprises à prospecter${creationsEntreprises != null && anneeReference != null ? ` (+${fmtNumber(creationsEntreprises, loc)} créées en ${anneeReference})` : ""}`
                  : `companies to prospect${creationsEntreprises != null && anneeReference != null ? ` (+${fmtNumber(creationsEntreprises, loc)} created in ${anneeReference})` : ""}`}
              </span>
            </p>
          ) : (
            <p className="text-fg-soft mt-3 text-sm leading-relaxed">
              {isFr
                ? "Un large tissu d'entreprises à démarcher."
                : "A wide business fabric to prospect."}
            </p>
          )}
          {topSectors.length > 0 ? (
            <>
              <p className="text-fg-muted mt-5 text-[11px] font-semibold tracking-[0.12em] uppercase">
                {isFr ? "Secteurs forts" : "Strong sectors"}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {topSectors.slice(0, 4).map((s, i) => (
                  <li
                    key={i}
                    className="border-terracotta/20 bg-paper text-fg rounded-full border px-2.5 py-1 text-xs font-medium"
                  >
                    {cleanSector(s.label)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="text-fg-soft mt-auto pt-5 text-sm">
            {isFr
              ? "De la TPE à la grande entreprise."
              : "From micro-business to large enterprise."}
          </p>
        </div>

        {/* BLOC 2 — Votre périmètre */}
        <div className="border-border bg-bg flex flex-col rounded-3xl border p-7">
          <span className="bg-sand text-terracotta mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
            <MapIcon aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-lg font-semibold tracking-tight">
            {isFr ? "Votre périmètre" : "Your area"}
          </h3>
          <dl className="mt-4 space-y-3">
            {perimeter.map((p, i) => (
              <div
                key={i}
                className="border-border/70 flex items-baseline justify-between gap-3 border-b border-dashed pb-2 last:border-0"
              >
                <dt className="text-fg-muted text-xs">{p.label}</dt>
                <dd className="text-fg text-right text-sm font-semibold">{p.value}</dd>
              </div>
            ))}
          </dl>
          {communesBassin.length > 0 ? (
            <p className="text-fg-soft mt-auto pt-4 text-sm leading-relaxed">
              {isFr ? "Communes voisines : " : "Nearby towns: "}
              {communesBassin
                .slice(0, 6)
                .map((c) => c.nameFr)
                .join(", ")}
              {communesBassin.length > 6 ? "…" : "."}
            </p>
          ) : null}
        </div>

        {/* BLOC 3 — Votre secteur, rien qu'à vous */}
        <div className="border-primary/25 bg-primary-soft flex flex-col rounded-3xl border-2 p-7">
          <span className="bg-paper text-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-lg font-semibold tracking-tight">
            {isFr ? "Votre secteur, rien qu'à vous" : "Your sector, yours alone"}
          </h3>
          <p className="text-fg-soft mt-3 leading-relaxed">
            {isFr
              ? "Votre secteur est défini ensemble — selon vos souhaits, votre portefeuille existant et les besoins d'Axion-IA."
              : "Your sector is defined together — based on your wishes, your existing portfolio and Axion-IA's needs."}
          </p>
          <p className="text-primary mt-4 text-base leading-snug font-semibold">
            {isFr
              ? "Un secteur = un seul commercial. Aucune concurrence entre vous, un chiffre d'affaires assuré."
              : "One sector = one rep. No internal competition, guaranteed revenue."}
          </p>
        </div>
      </div>
    </Section>
  );
}
