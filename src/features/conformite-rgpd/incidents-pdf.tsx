/**
 * Conformité RGPD — le journal des incidents de données (art. 33.5), en PDF.
 * Même générateur, même charte et mêmes blocs que le registre (`registre-pdf.tsx`).
 * Les textes arrivent DÉCHIFFRÉS : le PDF n'est servi qu'aux administrateurs.
 *
 * NE PAS "use client" — rendu serveur exclusif.
 */

import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";

import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";

import type { Incident } from "./incidents-base";
import { Ligne, dateLongue, enBuffer, styles, txt } from "./registre-pdf";

function dateHeure(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function ouiNon(v: boolean | null, le: Date | null, motif: string | null): string {
  if (v === true) return le ? `Oui, le ${dateHeure(le)}` : "Oui";
  if (v === false) return `Non — ${motif ?? "motif non renseigné"}`;
  return "Pas encore décidé";
}

export function JournalIncidentsPdf({
  incidents,
  genereLe,
}: {
  incidents: ReadonlyArray<Incident>;
  genereLe: Date;
}) {
  const date = dateLongue(genereLe);
  return (
    <Document title="Journal des incidents de données" author={IDENTITE_LEGALE.legalName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.entite}>{txt(IDENTITE_LEGALE.legalName)}</Text>
        <Text style={styles.entite}>{txt(adresseSiegeUneLigne())}</Text>
        <Text style={styles.entite}>SIREN {IDENTITE_LEGALE.siren}</Text>
        <Text style={styles.titre}>Journal des incidents de données</Text>
        <Text style={styles.date}>
          {txt(`Article 33.5 du RGPD — état au ${date} — ${incidents.length} incident(s)`)}
        </Text>
        {incidents.map((i) => (
          <View key={i.id} style={styles.activite}>
            <Text style={styles.nom}>
              {txt(`Incident n° ${i.numero}${i.statut === "clos" ? " — clos" : ""}`)}
            </Text>
            <Ligne libelle="Découvert le" valeur={dateHeure(i.decouvertLe)} />
            <Ligne libelle="Survenu le" valeur={dateHeure(i.survenuLe)} />
            <Ligne libelle="Ce qui s'est passé" valeur={i.description} />
            <Ligne libelle="Données touchées" valeur={i.donneesConcernees} />
            <Ligne
              libelle="Nombre de personnes"
              valeur={i.nombrePersonnes === null ? null : `environ ${i.nombrePersonnes}`}
            />
            <Ligne libelle="Personnes touchées" valeur={i.categoriesPersonnes} />
            <Ligne libelle="Conséquences" valeur={i.consequences} />
            <Ligne libelle="Mesures prises" valeur={i.mesuresPrises} />
            <Ligne
              libelle="CNIL prévenue"
              valeur={ouiNon(i.declareCnil, i.declareCnilLe, i.motifNonDeclaration)}
            />
            <Ligne
              libelle="Personnes prévenues"
              valeur={ouiNon(i.personnesPrevenues, i.personnesPrevenuesLe, i.motifNonInformation)}
            />
            <Ligne libelle="Clos le" valeur={dateHeure(i.closLe)} />
          </View>
        ))}
        <View style={styles.pied} fixed>
          <Text>{txt(`${IDENTITE_LEGALE.legalName} — journal au ${date}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function rendreJournalIncidentsEnPdf(
  incidents: ReadonlyArray<Incident>,
  genereLe: Date,
): Promise<Buffer> {
  return enBuffer(<JournalIncidentsPdf incidents={incidents} genereLe={genereLe} />);
}
