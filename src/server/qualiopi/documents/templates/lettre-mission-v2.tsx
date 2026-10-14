/**
 * Qualiopi — Lettre de mission, VERSION 3 (étape 3 du C4 ; v2 = lot S5, texte
 * ARRÊTÉ par Will le 10/10/2026).
 *
 * v3 — 14/10/2026, décision (d) de Will : la section 4 dit que les honoraires sont
 * réglés au plus tard 30 jours après la dernière journée, une fois les feuilles
 * contresignées et, pour le dernier mois, le bilan de fin de formation remis — le délai
 * courant de leur remise s'ils arrivent plus tard ; et que, au seuil de 5 000 € HT, le
 * règlement attend l'attestation URSSAF (art. 18.2 du contrat-cadre). La v2 est figée,
 * mot pour mot, dans `archives/lettre-mission-v2.v2.tsx`. Le fichier garde son nom :
 * ses types (`LettreMissionV2Data`) sont ceux du calcul.
 *
 * Une page : la lettre ne dit que ce qui change d'une formation à l'autre (la
 * formation, les dates, le lieu, les journées, les honoraires) ; le reste vit
 * dans le contrat-cadre de sous-traitance, qui l'emporte en cas de
 * contradiction. Une lettre couvre 1 à N jours, consécutifs ou non.
 *
 * Réservée aux formateurs INDÉPENDANTS et aux ORGANISMES sous-traitants. La v1
 * (`lettre-mission.tsx`) reste la version émise par défaut et celle de toute
 * pièce déjà émise ; cette v2 est une version ARRÊTÉE (`versions-arretees.ts`).
 *
 * Données entièrement CALCULÉES avant le rendu (`lettre-mission-v2-calcul.ts`) :
 * le gabarit n'additionne rien, il imprime. Montants en centimes entiers.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  DataTable,
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formaterEurosCents } from "@/server/qualiopi/formateurs-independants/lettre-mission-v2-calcul";

export interface JourLettreV2 {
  /** jj/mm/aaaa */
  readonly date: string;
  /** « 09:00-17:00 » */
  readonly horaires: string;
  readonly demiJournees: 1 | 2;
  /** Adresse, ou « à distance ». */
  readonly lieu: string;
}

export interface LettreMissionV2Data {
  numero: string;
  /** Formateur indépendant, ou organisme sous-traitant (intervenant désigné). */
  partie:
    | {
        forme: "independant";
        nomPrenom: string;
        /** Société du formateur, le cas échéant (représentée par `nomPrenom`). */
        denomination?: string;
        siret: string;
        nda: string;
      }
    | {
        forme: "organisme";
        denomination: string;
        siret: string;
        nda: string;
        intervenant: string;
      };
  contratCadre: { version: number; signeLe: string };
  /** « 12/10/2026 à 09:41 » — le « J'accepte » horodaté. */
  accordLe: string;
  formation: {
    intitule: string;
    reference: string;
    client: string;
    stagiaires: number;
    /** Adaptation signalée pour une personne en situation de handicap. */
    adaptationHandicap?: string;
  };
  jours: ReadonlyArray<JourLettreV2>;
  journees: number;
  demiJournees: number;
  tarifJourneeHtCents: number;
  honorairesHtCents: number;
  /** `null` = déplacement compris dans les honoraires. */
  deplacement: {
    forfaitParJourHtCents: number;
    joursDeplacement: number;
    totalHtCents: number;
  } | null;
  totalHtCents: number;
  mentionTva: string;
  /** jj/mm/aaaa — dernière journée + 30 jours, jour ouvré précédent. */
  echeancePaiement: string;
  /** Plusieurs mois : un virement par mois (jj/mm/aaaa chacun). */
  echeancesParMois?: ReadonlyArray<string>;
  /** Mandat d'autofacturation en vigueur (sinon : « vous adressez votre facture »). */
  autofacturation: boolean;
  /** La formation attend l'accord de son financeur. */
  financeurEnAttente: boolean;
  /** « Aucune » par défaut : jamais un engagement ajouté sans accord écrit distinct. */
  mentionExpresse: string | null;
  dateMission: string;
  signatures?: PreuvesParPartie;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

export function LettreMissionV2Pdf({
  data,
  identite,
}: {
  data: LettreMissionV2Data;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const p = data.partie;
  const tarifDemi = data.tarifJourneeHtCents / 2;
  const nomSignataire = p.forme === "organisme" ? p.denomination : p.nomPrenom;
  return (
    <Document>
      <QualiopiPage
        docTitle="Lettre de mission"
        docNumber={data.numero}
        identite={identite}
        eyebrow="Conditions particulières du contrat-cadre de sous-traitance de formation"
      >
        <DocSection title="Les parties">
          <FieldRow
            label="Axion"
            value={`${identite.raisonSociale || "Axion-IA SAS"} · SIRET ${identite.siret} · Numéro de déclaration d'activité ${identite.nda ?? "—"}`}
          />
          {p.forme === "independant" ? (
            <FieldRow
              label="Formateur indépendant"
              value={`${p.denomination ? `${p.denomination}, représentée par ${p.nomPrenom}` : p.nomPrenom} · SIRET ${p.siret} · Numéro de déclaration d'activité ${p.nda}`}
            />
          ) : (
            <FieldRow
              label="Organisme sous-traitant"
              value={`${p.denomination} · SIRET ${p.siret} · Numéro de déclaration d'activité ${p.nda} · Intervenant désigné : ${p.intervenant}`}
            />
          )}
          <FieldRow
            label="Contrat-cadre"
            value={`Version ${data.contratCadre.version}, signé le ${data.contratCadre.signeLe}, en vigueur`}
          />
          <FieldRow
            label="Votre accord"
            value={`Mission acceptée dans votre espace le ${data.accordLe}`}
          />
        </DocSection>

        <DocSection title="1. La formation">
          <Text style={pdfStyles.paragraph}>
            {data.formation.intitule} · référence {data.formation.reference} · client :{" "}
            {data.formation.client} · {pluriel(data.formation.stagiaires, "stagiaire")} prévu
            {data.formation.stagiaires > 1 ? "s" : ""}. Le programme et les compétences visées sont
            joints à cette lettre.
            {data.formation.adaptationHandicap
              ? ` Adaptations signalées pour une personne en situation de handicap : ${data.formation.adaptationHandicap}.`
              : ""}
          </Text>
        </DocSection>

        <DocSection title="2. Dates et lieu">
          <DataTable
            columns={[
              { key: "date", header: "Date", flex: 1 },
              { key: "horaires", header: "Horaires", flex: 1 },
              { key: "demi", header: "Demi-journées", flex: 1 },
              { key: "lieu", header: "Lieu", flex: 2 },
            ]}
            rows={data.jours.map((j) => ({
              date: j.date,
              horaires: j.horaires,
              demi: String(j.demiJournees),
              lieu: j.lieu,
            }))}
          />
          <Text style={pdfStyles.paragraph}>
            Total : {pluriel(data.journees, "journée")} et{" "}
            {pluriel(data.demiJournees, "demi-journée")}.
          </Text>
        </DocSection>

        <DocSection title="3. Honoraires">
          <Text style={pdfStyles.paragraph}>
            {formaterEurosCents(data.tarifJourneeHtCents)} HT par journée × {data.journees} +{" "}
            {formaterEurosCents(tarifDemi)} HT par demi-journée × {data.demiJournees} ={" "}
            {formaterEurosCents(data.honorairesHtCents)} HT.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Déplacement :{" "}
            {data.deplacement === null
              ? "compris dans les honoraires."
              : `forfait de ${formaterEurosCents(data.deplacement.forfaitParJourHtCents)} HT par journée de déplacement × ${data.deplacement.joursDeplacement} = ${formaterEurosCents(data.deplacement.totalHtCents)} HT.`}
          </Text>
          <Text style={pdfStyles.paragraph}>
            Total de la mission : {formaterEurosCents(data.totalHtCents)} HT. TVA :{" "}
            {data.mentionTva}.
          </Text>
        </DocSection>

        <DocSection title="4. Facture et paiement">
          {data.autofacturation ? (
            <Text style={pdfStyles.paragraph}>
              Axion établit la facture à votre nom (autofacture) dès que les feuilles de présence
              sont signées. Vous la recevez dans votre espace et par e-mail, et vous pouvez la
              contester dans les 8 jours.
            </Text>
          ) : (
            <Text style={pdfStyles.paragraph}>Vous adressez votre facture à Axion.</Text>
          )}
          <Text style={pdfStyles.paragraph}>
            Vos honoraires sont réglés au plus tard 30 jours après la dernière journée, une fois les
            feuilles de présence contresignées et, pour le dernier mois de la mission, le bilan de
            fin de formation remis ; s&apos;ils sont remis plus tard, le délai court à partir de
            leur remise.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Si tout est remis à temps,{" "}
            <Text style={{ fontWeight: "bold" }}>
              le virement part au plus tard le {data.echeancePaiement}
            </Text>
            , que le client ait réglé ou non. À partir de 5 000 € hors taxes d&apos;honoraires avec
            nous, le règlement attend aussi votre attestation de vigilance URSSAF (article 18.2 du
            contrat-cadre).
          </Text>
          {data.echeancesParMois && data.echeancesParMois.length > 1 ? (
            <Text style={pdfStyles.paragraph}>
              Un virement par mois de journées réalisées : au plus tard le{" "}
              {data.echeancesParMois.join(", le ")}.
            </Text>
          ) : null}
        </DocSection>

        <DocSection title="5. Feuilles de présence">
          <Text style={pdfStyles.paragraph}>
            Elles sont signées par demi-journée, dans l&apos;outil d&apos;Axion ou sur papier, puis
            remises à Axion.
          </Text>
        </DocSection>

        <DocSection title="6. Annulation">
          <Text style={pdfStyles.paragraph}>
            Si Axion annule moins de 72 heures avant la première journée annulée, la moitié des
            honoraires des journées annulées vous est due, hors forfait de déplacement. Rien
            n&apos;est dû pour une annulation à 72 heures ou plus.
          </Text>
          {data.financeurEnAttente ? (
            <Text style={pdfStyles.paragraph}>
              Cette formation attend l&apos;accord de son financeur. Un refus notifié avant votre
              acceptation n&apos;ouvre aucun droit. Un refus notifié après votre acceptation est
              traité comme une annulation par Axion.
            </Text>
          ) : null}
        </DocSection>

        <DocSection title="7. Si vous êtes empêché">
          <Text style={pdfStyles.paragraph}>
            Prévenez Axion dès que possible, depuis votre espace. Aucune pénalité n&apos;est due.
            Vous pouvez proposer une personne de qualification équivalente pour vous remplacer ;
            Axion accepte ou non.
            {p.forme === "organisme"
              ? " Le remplacement de l'intervenant désigné suppose l'accord écrit d'Axion."
              : ""}
          </Text>
        </DocSection>

        <DocSection title="8. Tout le reste est dans le contrat-cadre">
          <Text style={pdfStyles.paragraph}>
            Vous animez la formation avec vos propres méthodes, dans le respect du programme joint.
            La confidentialité, les données personnelles, les prises de vue, la propriété de vos
            supports, la non-sollicitation, la responsabilité et la fin des relations suivent le
            contrat-cadre. Cette lettre ne vous impose aucun engagement supplémentaire.
          </Text>
        </DocSection>

        <DocSection title="9. Ordre des documents">
          <Text style={pdfStyles.paragraph}>
            En cas de contradiction entre cette lettre et le contrat-cadre, le contrat-cadre
            l&apos;emporte, sauf mention expresse ci-dessous. Les données propres à la mission
            (formation, dates, lieu, journées et demi-journées, honoraires, forfait de déplacement)
            sont celles de cette lettre.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Mention expresse : {data.mentionExpresse ?? "Aucune"}.
          </Text>
        </DocSection>

        <DocSection title="Signatures">
          <SignatureZone
            faitLe={`Le ${data.dateMission}`}
            parties={[
              {
                titre: p.forme === "organisme" ? "Pour l'organisme" : "Pour le formateur",
                signature: data.signatures?.formateur ?? null,
                nom: nomSignataire,
                mention: "Signé dans son espace",
              },
              {
                titre: "Pour Axion-IA SAS",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
            ]}
          />
          <Text style={pdfStyles.legalNote}>
            La contresignature d&apos;Axion n&apos;est pas nécessaire pour que la formation ait
            lieu.
          </Text>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
