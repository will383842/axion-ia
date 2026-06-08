// Server Component — ⭐ « Votre territoire de vente ». SECTION VARIABLE =
// cœur anti-doorway. Données INSEE/economic-data RÉELLES. Refonte visuelle
// 2026-06-08 (Will : « trop textuel ») : gros chiffre repère, labels secteurs
// nettoyés (sans jargon NAF), barres de proportion, blocs aérés.

import type { ReactNode } from "react";
import { Building2, Map, Globe2, Briefcase, MapPin, Sparkles, Factory } from "lucide-react";
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

/** Tronque la spécificité locale à la 1re phrase (éviter le pavé technique). */
function shortSpecificite(s: string): string {
  const firstSentence = s.split(/(?<=[.!?])\s/)[0] ?? s;
  return firstSentence.length > 180 ? firstSentence.slice(0, 177).trimEnd() + "…" : firstSentence;
}

const AUDIENCE_FR = ["TPE & artisans", "Commerçants", "PME", "ETI", "Grandes entreprises"];
const AUDIENCE_EN = ["Micro & artisans", "Retailers", "SMEs", "Mid-caps", "Large enterprises"];

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
    grandsGroupes,
    communesBassin,
    specificite,
  } = props;
  const loc = isFr ? "fr" : "en";

  const perimeter = [
    { icon: Building2, label: isFr ? "Ville & agglo" : "City & metro", value: villeName },
    ...(departementLabel
      ? [{ icon: Map, label: isFr ? "Département" : "Department", value: departementLabel }]
      : []),
    ...(region ? [{ icon: Globe2, label: isFr ? "Région" : "Region", value: region }] : []),
    {
      icon: Briefcase,
      label: isFr ? "Votre portefeuille" : "Your portfolio",
      value: isFr ? "Conservé" : "Kept",
    },
  ];

  const maxCount = Math.max(...topSectors.map((s) => s.count ?? 0), 1);

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Votre territoire de vente" : "Your sales territory"}
      title={isFr ? "Un terrain de jeu large," : "A wide playing field,"}
      titleEm={isFr ? "à vous de le couvrir" : "yours to cover"}
      description={
        isFr
          ? `Vous couvrez ${villeName}, son agglomération, le département${departementLabel ? ` (${departementLabel})` : ""}${region ? ` et la région ${region}` : ""} — plus votre propre portefeuille, que vous gardez.`
          : `You cover ${villeName}, its metro area, the department${region ? ` and the ${region} region` : ""} — plus your own portfolio, which you keep.`
      }
    >
      <div className="space-y-8">
        {/* Gros chiffre repère */}
        {etablissementsActifs != null ? (
          <div className="border-terracotta/15 bg-halo-warm flex flex-wrap items-center gap-x-12 gap-y-4 rounded-3xl border-2 p-8">
            <div>
              <p className="text-terracotta-deep font-mono text-5xl font-semibold tabular-nums sm:text-6xl">
                {fmtNumber(etablissementsActifs, loc)}
              </p>
              <p className="text-fg-soft mt-1 text-lg">
                {isFr
                  ? `entreprises à prospecter à ${villeName}`
                  : `companies to prospect in ${villeName}`}
              </p>
            </div>
            {creationsEntreprises != null && anneeReference != null ? (
              <div className="border-terracotta/20 sm:border-l sm:pl-12">
                <p className="text-fg font-mono text-3xl font-semibold tabular-nums">
                  +{fmtNumber(creationsEntreprises, loc)}
                </p>
                <p className="text-fg-soft mt-1 text-sm">
                  {isFr
                    ? `nouvelles entreprises en ${anneeReference}`
                    : `new businesses in ${anneeReference}`}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Périmètre — strip à icônes */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {perimeter.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="border-border bg-bg flex items-center gap-3 rounded-xl border p-4"
              >
                <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-fg-muted text-[10px] font-semibold tracking-[0.12em] uppercase">
                    {p.label}
                  </p>
                  <p className="text-fg truncate text-sm font-semibold">{p.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audience — chips compactes */}
        <div className="flex flex-wrap gap-2">
          <span className="text-fg-muted mr-1 self-center text-sm">
            {isFr ? "Vous vendez à :" : "You sell to:"}
          </span>
          {(isFr ? AUDIENCE_FR : AUDIENCE_EN).map((a, i) => (
            <span
              key={i}
              className="border-border bg-bg text-fg rounded-full border px-3.5 py-1.5 text-sm font-medium"
            >
              {a}
            </span>
          ))}
        </div>

        {/* 2 colonnes — secteurs (barres) + grands comptes */}
        <div className="grid gap-6 lg:grid-cols-2">
          {topSectors.length > 0 ? (
            <div className="border-border bg-bg rounded-2xl border p-6">
              <h3 className="text-fg flex items-center gap-2 text-base font-semibold tracking-tight">
                <Factory aria-hidden="true" className="text-terracotta h-5 w-5" />
                {isFr ? "Les secteurs forts du territoire" : "The territory's strongest sectors"}
              </h3>
              <ul className="mt-5 space-y-4">
                {topSectors.map((s, i) => (
                  <li key={i}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-fg text-sm font-medium">{cleanSector(s.label)}</span>
                      {s.count != null ? (
                        <span className="text-terracotta-deep shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {fmtNumber(s.count, loc)}
                        </span>
                      ) : null}
                    </div>
                    {s.count != null ? (
                      <div className="bg-sand h-2.5 overflow-hidden rounded-full">
                        <div
                          className="from-terracotta to-terracotta-deep h-2.5 rounded-full bg-gradient-to-r"
                          style={{
                            width: `${Math.max(10, Math.round((s.count / maxCount) * 100))}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {grandsGroupes.length > 0 ? (
            <div className="border-border bg-bg rounded-2xl border p-6">
              <h3 className="text-fg text-base font-semibold tracking-tight">
                {isFr ? "Des grands comptes déjà sur place" : "Major accounts already here"}
              </h3>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                {isFr
                  ? "Un écosystème mûr pour l'IA — ça crédibilise votre démarche auprès des PME."
                  : "An AI-ready ecosystem — it lends credibility to your pitch with SMEs."}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {grandsGroupes.map((g, i) => (
                  <li
                    key={i}
                    className="border-terracotta/20 bg-halo-warm text-fg rounded-full border px-3 py-1.5 text-sm font-medium"
                    title={g.secteur}
                  >
                    {g.nom.replace(/\s*\([^)]*\)/g, "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Bassin + spécificité — ligne compacte */}
        <div className="grid gap-4 md:grid-cols-2">
          {communesBassin.length > 0 ? (
            <div className="border-border bg-sand flex gap-3 rounded-2xl border p-5">
              <MapPin aria-hidden="true" className="text-terracotta mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-fg text-sm font-semibold">
                  {isFr ? "Communes voisines dans votre zone" : "Neighbouring towns in your zone"}
                </p>
                <p className="text-fg-soft mt-1 text-sm leading-relaxed">
                  {communesBassin
                    .slice(0, 8)
                    .map((c) => c.nameFr)
                    .join(", ")}
                  {communesBassin.length > 8 ? "…" : "."}
                </p>
              </div>
            </div>
          ) : null}

          {specificite ? (
            <div className="border-primary/20 bg-primary-soft flex gap-3 rounded-2xl border p-5">
              <Sparkles aria-hidden="true" className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-fg-soft self-center text-sm leading-relaxed">
                {shortSpecificite(specificite)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
