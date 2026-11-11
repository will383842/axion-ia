/**
 * VilleDonneesFactuelles — bloc « repères publics » d'une page ville (tâche X-4, vague 3).
 *
 * Composant SERVEUR (aucun `"use client"`, aucun hook) : zéro JS client ajouté.
 * N'affiche QUE des faits lus dans une source publique, chacun avec sa source et sa date.
 * Un fait absent n'a pas de ligne ; sans aucun fait, le composant ne rend rien.
 *
 * Rédaction : aucune présence locale (pas de « nos consultants à … »), aucun prix.
 */
import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import type {
  Fait,
  VilleDonneesFactuelles as Donnees,
} from "@/content/villes/donnees-factuelles/schema";
import { aDesFaits } from "@/content/villes/donnees-factuelles";
import { fmtNumber } from "@/lib/intl";

interface Props {
  readonly donnees: Donnees;
  readonly villeNameFr: string;
  readonly isFr: boolean;
}

const MOIS_FR = [
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
];

/** `2026-10` → « octobre 2026 » ; `2026-11-11` → « 11 novembre 2026 ». Sans fuseau horaire. */
export function formaterDateFait(date: string): string {
  const [annee, mois, jour] = date.split("-");
  const nomMois = MOIS_FR[Number(mois) - 1] ?? mois;
  return jour ? `${Number(jour)} ${nomMois} ${annee}` : `${nomMois} ${annee}`;
}

function MentionSource({ fait, isFr }: { fait: Fait<unknown>; isFr: boolean }) {
  const date = formaterDateFait(fait.date);
  const quand =
    fait.natureDate === "millesime"
      ? isFr
        ? `données de ${date}`
        : `data as of ${date}`
      : isFr
        ? `relevé le ${date}`
        : `retrieved ${date}`;
  return (
    <p className="text-fg-muted mt-1 text-xs" data-source>
      {isFr ? "Source : " : "Source: "}
      <a href={fait.url} rel="noopener" className="underline underline-offset-2">
        {fait.source}
      </a>
      {`, ${quand}.`}
    </p>
  );
}

function Ligne({
  libelle,
  fait,
  children,
  isFr,
}: {
  libelle: string;
  fait: Fait<unknown>;
  children: ReactNode;
  isFr: boolean;
}) {
  return (
    <div className="border-border border-t py-4">
      <dt className="text-fg-muted text-sm">{libelle}</dt>
      <dd className="mt-1">
        <div className="text-fg text-lg font-semibold">{children}</div>
        <MentionSource fait={fait} isFr={isFr} />
      </dd>
    </div>
  );
}

export function VilleDonneesFactuelles({ donnees, villeNameFr, isFr }: Props) {
  if (!aDesFaits(donnees)) return null;
  const locale = isFr ? "fr" : "en";
  const { population, departement, region, etablissementsActifs, secteursDominants } = donnees;

  return (
    <section
      aria-labelledby="ville-donnees-factuelles"
      className="bg-paper py-16 sm:py-20"
      data-testid="ville-donnees-factuelles"
    >
      <Container>
        <p className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
          {isFr ? "Données publiques" : "Public data"}
        </p>
        <h2
          id="ville-donnees-factuelles"
          className="text-fg mt-2 text-2xl font-semibold sm:text-3xl"
        >
          {isFr ? `${villeNameFr} en repères chiffrés` : `${villeNameFr} in figures`}
        </h2>
        <p className="text-fg-muted mt-3 max-w-2xl text-sm">
          {isFr
            ? "Chiffres repris tels quels de sources publiques, avec leur source et leur date. Un repère sans source n'est pas affiché."
            : "Figures taken as-is from public sources, with their source and date. A figure without a source is not shown."}
        </p>
        <dl className="mt-8 grid gap-x-10 sm:grid-cols-2">
          {population ? (
            <Ligne
              libelle={isFr ? "Population municipale" : "Municipal population"}
              fait={population}
              isFr={isFr}
            >
              {fmtNumber(population.valeur, locale)} {isFr ? "habitants" : "inhabitants"}
            </Ligne>
          ) : null}
          {departement ? (
            <Ligne libelle={isFr ? "Département" : "Département"} fait={departement} isFr={isFr}>
              {departement.valeur}
            </Ligne>
          ) : null}
          {region ? (
            <Ligne libelle={isFr ? "Région" : "Region"} fait={region} isFr={isFr}>
              {region.valeur}
            </Ligne>
          ) : null}
          {etablissementsActifs ? (
            <Ligne
              libelle={isFr ? "Établissements actifs" : "Active establishments"}
              fait={etablissementsActifs}
              isFr={isFr}
            >
              {fmtNumber(etablissementsActifs.valeur, locale)}
            </Ligne>
          ) : null}
          {secteursDominants ? (
            <Ligne
              libelle={
                isFr
                  ? "Secteurs les plus représentés (divisions NAF)"
                  : "Most represented sectors (NAF divisions)"
              }
              fait={secteursDominants}
              isFr={isFr}
            >
              <ul className="mt-1 space-y-1 text-base font-normal">
                {secteursDominants.valeur.map((s) => (
                  <li key={s.division}>
                    {s.libelle ??
                      (isFr ? `Division NAF ${s.division}` : `NAF division ${s.division}`)}
                    {" : "}
                    {fmtNumber(s.etablissements, locale)}{" "}
                    {isFr ? "établissements" : "establishments"}
                  </li>
                ))}
              </ul>
            </Ligne>
          ) : null}
        </dl>
      </Container>
    </section>
  );
}
