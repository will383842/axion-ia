/**
 * VilleFicheLocale : contenu propre à la ville (Server Component, aucun JS client).
 *
 * Rend, à partir d'une `FicheLocale` sourcée : les entreprises en chiffres (tableau HTML),
 * l'écosystème (institutions publiques seulement), la zone desservie et l'accès, les
 * accompagnements, puis les sources et la date de mise à jour. Les questions locales sont
 * rendues par `VilleFaqGeolocalisee` (FAQPage en ligne), pas ici.
 */

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { CHEMIN_JOURNEE_IA } from "@/content/journee-ia-commun";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";

/** Passe à `true` quand la page /fr/cartographie est en ligne (PR 2125 fusionnée, route en 200). */
export const CARTOGRAPHIE_EN_LIGNE = false;

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** « 2026-11-18 » -> « 18 novembre 2026 ». */
export function dateEnFrancais(iso: string): string {
  const [a, m, j] = iso.split("-");
  const mois = MOIS[Number(m) - 1];
  return `${Number(j)} ${mois ?? ""} ${a}`.replace("  ", " ");
}

const nf = new Intl.NumberFormat("fr-FR");

function LienExterne({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-terracotta font-semibold underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

const CATEGORIE: Record<string, string> = {
  pole: "Pôle de compétitivité",
  technopole: "Technopôle",
  zone: "Zone d’activité",
  universite: "Université",
  ecole: "École",
  "french-tech": "French Tech",
  gare: "Gare",
  aeroport: "Aéroport",
  cci: "CCI",
};

export function VilleFicheLocale({ fiche }: { fiche: FicheLocale }) {
  const v = fiche.nomVille;
  const e = fiche.entreprises;
  const prix = formatTierPrice(JOURNEE_IA_TIER, "fr");
  const date = dateEnFrancais(fiche.dateFiche);
  const sources: Array<{ libelle: string; url: string }> = [
    { libelle: `${e.source}, total`, url: e.urlTotal },
    { libelle: `${e.source}, secteurs`, url: e.urlSecteurs },
    { libelle: fiche.population.source, url: fiche.population.url },
    {
      libelle: `${fiche.epci.source}, population de ${fiche.epci.nom}`,
      url: fiche.epci.urlPopulation,
    },
    { libelle: `${fiche.epci.source}, communes de ${fiche.epci.nom}`, url: fiche.epci.url },
    ...fiche.institutions.map((i) => ({ libelle: i.nom, url: i.url })),
  ];

  return (
    <>
      <section
        aria-labelledby="ville-chiffres"
        className="bg-paper border-border border-t py-14 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="ville-chiffres"
              className="text-fg text-[clamp(1.5rem,2.8vw,2.1rem)] leading-tight font-semibold tracking-tight"
            >
              {`Les entreprises de ${v} en chiffres`}
            </h2>
            <p className="text-fg-soft mt-5 text-base leading-relaxed">{fiche.prose.tissu}</p>
            <table className="mt-6 w-full border-collapse text-left text-[15px]">
              <caption className="text-fg-muted pb-2 text-left text-sm">
                {`Établissements employeurs du secteur privé à ${v}, au 31 décembre ${e.millesime}`}
              </caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Secteur
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">
                    Établissements
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Salariés
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-border border-b">
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    Ensemble des secteurs
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {nf.format(e.etablissements)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{nf.format(e.salaries)}</td>
                </tr>
                {e.secteurs.map((s) => (
                  <tr key={s.code} className="border-border border-b">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {s.libelle}
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {nf.format(s.etablissements)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{nf.format(s.salaries)}</td>
                  </tr>
                ))}
                <tr className="border-border border-b">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    Information et communication
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {nf.format(e.infoCom.etablissements)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{nf.format(e.infoCom.salaries)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-fg-muted mt-3 text-sm">
              {`Source : `}
              <LienExterne href={e.urlTotal}>Urssaf, total</LienExterne>
              {" · "}
              <LienExterne href={e.urlSecteurs}>Urssaf, secteurs</LienExterne>
              {` (consulté le ${dateEnFrancais(e.consulteLe)}). Périmètre : ${e.perimetre}, secteur privé ; les établissements sans salarié et le secteur public ne sont pas comptés.`}
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="ville-ecosysteme" className="bg-paper py-14 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="ville-ecosysteme"
              className="text-fg text-[clamp(1.5rem,2.8vw,2.1rem)] leading-tight font-semibold tracking-tight"
            >
              {`L’écosystème économique de ${v}`}
            </h2>
            <p className="text-fg-soft mt-5 text-base leading-relaxed">{fiche.prose.ecosysteme}</p>
            <ul className="mt-5 space-y-2 text-[15px]">
              {fiche.institutions.map((i) => (
                <li key={i.nom}>
                  <LienExterne href={i.url}>{i.nom}</LienExterne>
                  <span className="text-fg-soft">
                    {` : ${CATEGORIE[i.categorie] ?? i.categorie}, ${i.role}.`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="ville-zone" className="bg-paper py-14 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="ville-zone"
              className="text-fg text-[clamp(1.5rem,2.8vw,2.1rem)] leading-tight font-semibold tracking-tight"
            >
              Zone desservie et accès
            </h2>
            <p className="text-fg-soft mt-5 text-base leading-relaxed">{fiche.prose.zone}</p>
            <details className="mt-4 text-[15px]">
              <summary className="text-fg cursor-pointer font-semibold">
                {`Les ${fiche.epci.nombreCommunes} communes de ${fiche.epci.nom}`}
              </summary>
              <p className="text-fg-soft mt-3 leading-relaxed">{fiche.epci.communes.join(", ")}.</p>
            </details>
            <p className="mt-4 text-base">
              <Link
                href={"/politique-deplacement" as never}
                className="text-terracotta font-semibold underline-offset-4 hover:underline"
              >
                Notre politique de déplacement
              </Link>
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="ville-accompagnements" className="bg-paper py-14 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="ville-accompagnements"
              className="text-fg text-[clamp(1.5rem,2.8vw,2.1rem)] leading-tight font-semibold tracking-tight"
            >
              {`Nos accompagnements à ${v}`}
            </h2>
            <p className="text-fg-soft mt-5 text-base leading-relaxed">
              {`Le matin : audit (2 à 4 h selon l’entreprise) ; l’après-midi : formation de 4 h. ${prix} la journée, jusqu’à 15 personnes.`}
            </p>
            <ul className="mt-4 space-y-2 text-[15px]">
              <li>
                <Link
                  href={CHEMIN_JOURNEE_IA as never}
                  className="text-terracotta font-semibold underline-offset-4 hover:underline"
                >
                  Découvrir la Journée IA
                </Link>
              </li>
              {CARTOGRAPHIE_EN_LIGNE ? (
                <li>
                  <Link
                    href={"/cartographie" as never}
                    className="text-terracotta font-semibold underline-offset-4 hover:underline"
                  >
                    La Cartographie de l’entreprise
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  href={"/formations" as never}
                  className="text-terracotta font-semibold underline-offset-4 hover:underline"
                >
                  Les formations
                </Link>
              </li>
              <li>
                <Link
                  href={"/audit" as never}
                  className="text-terracotta font-semibold underline-offset-4 hover:underline"
                >
                  L’audit
                </Link>
              </li>
              <li>
                <Link
                  href={"/implementation" as never}
                  className="text-terracotta font-semibold underline-offset-4 hover:underline"
                >
                  L’implémentation
                </Link>
              </li>
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="ville-sources" className="bg-paper border-border border-t py-10">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 id="ville-sources" className="text-fg text-lg font-semibold">
              Sources
            </h2>
            <ul className="text-fg-soft mt-3 space-y-1 text-sm break-words">
              {sources.map((s) => (
                <li key={s.url}>
                  <LienExterne href={s.url}>{s.libelle}</LienExterne>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-4 text-sm">{`Mis à jour le ${date}.`}</p>
          </div>
        </Container>
      </section>
    </>
  );
}
