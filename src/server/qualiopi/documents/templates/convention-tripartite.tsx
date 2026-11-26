/**
 * Qualiopi — Convention de formation tripartite (OF + Client + OPCO).
 *
 * Extension de la convention bipartite avec subrogation de paiement OPCO.
 * Conforme aux articles L.6353-1 et D.6353-1 du Code du travail (L.6353-2, abrogé
 * depuis le 01/01/2019, était cité jusqu'à la v2 — archivée dans `archives/`).
 * Rendu serveur exclusif — NE PAS "use client".
 *
 * ## 🔴 Sous-lot 8B — la pièce que lit l'OPCO était la MOINS complète des deux
 *
 * Constat de l'audit OPCO du 15/08 (`_AUDIT/OPCO-COMMERCIAL-2026-08-15/`, T6) :
 * le 02/08, la convention BIPARTITE a reçu les trois mentions exigées par
 * L.6353-1 — moyens pédagogiques et techniques, suivi de l'exécution et
 * appréciation des résultats, sanction de la formation — puis cinq sections de
 * fond (obligations, RGPD, propriété intellectuelle, responsabilité, droit
 * applicable). **La tripartite n'a reçu ni les unes ni les autres.** Son type ne
 * portait même pas les champs, et son corps s'arrêtait à « 4. Annulation ».
 *
 * Elle invoquait pourtant L.6353-1 en tête de page. Une convention qui cite le
 * texte sans en porter les mentions est incomplète au regard de ce qu'elle
 * invoque — et c'est la première chose que lit un instructeur.
 *
 * Ce qui rendait l'écart coûteux : c'est la pièce **transmise au financeur**.
 * L'OPCO ne paie que sur pièces ; celle-ci était la plus exposée et la plus
 * pauvre. Elle est désormais alignée sur la bipartite, section pour section.
 *
 * ⚠️ La numérotation des sections a changé (annexes 5 → 10, signatures 6 → 11).
 * Vérifié avant de renuméroter : **aucun renvoi par rang** n'existe, ni dans la
 * pièce, ni dans les specs, ni dans les kits financeurs. Renuméroter une liste
 * référencée par rang casserait ses renvois — ce n'est pas le cas ici.
 */

import type { LIBELLE_MODALITE_HYBRIDE } from "@/server/qualiopi/documents/libelles-enumerations";
import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  SignatureZone,
  assainirEspacesPdf,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import { BlocSignature, EncadreDoux, PageCharte } from "@/server/qualiopi/documents/charte/v1";
import {
  Champ,
  ChampListe,
  ChampNda,
  SectionCarte,
  stylesPiece,
} from "@/server/qualiopi/documents/templates/pieces-charte";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  libelleSeuilClause,
  type ParametresClauseConditionSuspensiveOpco,
} from "@/server/qualiopi/financements/condition-suspensive";

// ============================================================
// Types
// ============================================================

export interface ConventionTripartiteData {
  numero: string;
  estCopie?: boolean;
  /** Injecte par `generateDocument` quand l'identite de l'OF est incomplete. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  // Partie cliente
  client: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    contact: string;
  };
  // Partie OPCO
  opco: {
    nom: string;
    numeroPriseEnCharge: string;
    adresse?: string;
    contact?: string;
  };
  // Objet de la formation
  intitule: string;
  objectifs: string[];
  publicVise: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: "Présentiel" | "Distanciel" | typeof LIBELLE_MODALITE_HYBRIDE;
  lieu: string;
  effectif: number;
  /**
   * Les trois mentions du contenu de la convention (D.6353-1) — sous-lot 8B.
   *
   * Optionnelles, avec les mêmes replis que la bipartite : ces replis décrivent
   * le dispositif RÉEL de la plateforme (émargement par demi-journée,
   * positionnement, évaluation des acquis, attestation). Les réinventer session
   * par session les ferait diverger de ce que le système produit vraiment, et
   * une convention qui décrit un dispositif absent est pire qu'une convention
   * muette.
   */
  moyensPedagogiques?: string;
  modalitesEvaluation?: string;
  sanction?: string;
  // Conditions financières
  prixHt: number;
  /**
   * Montant TOTAL pris en charge par le financeur, en euros.
   *
   * 🔴 `null` = **non établi**, et il faut le dire. Ce champ recevait
   * auparavant `priseEnChargeMontantCents / 100` — c'est-à-dire un TARIF lu
   * comme un total : un OPCO couvrant 40 €/h sur 14 h et 8 participants faisait
   * imprimer « 40,00 € » au lieu de 4 480 €, sur une pièce signée par trois
   * parties, avec un reste à charge faux du même écart.
   *
   * ⚠️ Ne JAMAIS remplacer ce `null` par 0 : un zéro affirme que le financeur
   * ne prend rien en charge. L'absence de donnée n'est pas une donnée nulle.
   */
  montantPrisEnCharge: number | null;
  /** Reste à charge, en euros. `null` quand la prise en charge n'est pas établie. */
  resteAChargeClient: number | null;
  // Date convention
  dateConvention: string;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * Renseignées, `SignatureZone` rend le tracé, l'horodatage et l'empreinte.
   * Sans ce branchement, la preuve n'existait QU'en base : le signataire signait
   * et la pièce qu'on lui remettait affichait encore des cadres vides.
   */
  signatures?: PreuvesParPartie;
  /**
   * INT-T65-A — paramètres de la clause de condition suspensive OPCO, posés
   * quand la case a été cochée à la génération. Absent ou `null` : aucune
   * clause, et le texte imprimé est celui de la v4 (cf. `gabarit-versions.ts`).
   */
  conditionSuspensiveOpco?: ParametresClauseConditionSuspensiveOpco | null;
}

// ============================================================
// Styles locaux
// ============================================================

const local = {
  annexeList: { marginTop: 4 },
  annexeItem: stylesPiece.annexe,
  listItem: stylesPiece.puce,
  amountRow: stylesPiece.ligneMontant,
  amountLabel: stylesPiece.libelleMontant,
  amountValue: stylesPiece.valeurMontant,
  subrogationNote: stylesPiece.note,
};

// ============================================================
// Helpers
// ============================================================

// 🔴 Correctif glyphes 2026-07-26. `Intl` fr-FR emet U+202F (fine insecable)
// comme separateur de milliers ; aucune police du projet ne possede ce glyphe,
// @react-pdf bascule sur Helvetica/WinAnsi et ecrit l'octet 0x2F, soit « / ».
// Tout montant >= 1 000 EUR sortait donc « 1/440,00 € ». Detail mesure dans
// `assainirEspacesPdf` (base-layout.tsx). Ce duplicat local echappait au
// correctif du helper partage : il doit assainir lui aussi.
function formatEur(montant: number): string {
  return assainirEspacesPdf(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(montant),
  );
}

// ============================================================
// INT-T65-A — clause de condition suspensive OPCO
// ============================================================

/**
 * 🔴 TEXTE DE LA JURISTE (A07), MOT POUR MOT — validé par Williams le
 * 2026-10-04 à 09h19 UTC, « clause validée, on garde le point 5 »
 * (axion-apporteurs#656, commentaire 5978462914). Il ne se reformule PAS ici :
 * `condition-suspensive-opco-clause.spec.tsx` compare chaque caractère, et la
 * jumelle de cette fonction, dans l'autre convention, porte le même texte
 * (`les-deux-conventions-portent-le-meme-socle.spec.ts`).
 *
 * Imprimée SEULEMENT si la case a été cochée à la génération. Ses trois
 * paramètres sont posés par la convention ; aucun nombre n'est écrit dans le
 * texte : `{opco}` (libellé de l'OPCO du client), `{dateLimite}` (jour civil de
 * Paris, jj/mm/aaaa) et `{seuil}` (« 50 % du prix hors taxes de la
 * présente convention », ou un montant en euros, centimes entiers).
 */
function ClauseConditionSuspensiveOpco({
  p,
}: {
  p: ParametresClauseConditionSuspensiveOpco;
}): React.ReactElement {
  const opco = p.opco;
  const dateLimite = p.dateLimite;
  const seuil = libelleSeuilClause(p.seuil);
  const gras = { fontWeight: "bold" as const };
  return (
    <SectionCarte title="5 bis. Condition suspensive de prise en charge par l'opérateur de compétences">
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"1. La condition."}</Text>
        {` La présente convention est conclue sous la condition suspensive que l'opérateur de compétences du Client, ${opco}, accorde par écrit, au plus tard le ${dateLimite}, une prise en charge de l'action au moins égale à ${seuil}.`}
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"2. Les diligences."}</Text>
        {
          " Le Client dépose sa demande de prise en charge auprès de son opérateur de compétences dans les délais et selon les modalités fixés par celui-ci ; Axion-IA lui remet sans délai les pièces nécessaires. La condition est réputée accomplie si le Client en a empêché l'accomplissement (article 1304-3 du code civil)."
        }
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"3. L'accomplissement."}</Text>
        {
          " Si l'accord écrit est obtenu dans le délai, la condition est accomplie et la convention produit ses effets "
        }
        <Text style={gras}>{"à compter de sa date de signature"}</Text>
        {
          " (article 1304-6 du code civil). La part du prix non prise en charge reste due par le Client, dans les conditions des conditions générales de vente."
        }
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"4. La renonciation."}</Text>
        {
          " La condition est stipulée dans l'intérêt exclusif du Client. Il peut y renoncer par écrit tant qu'elle n'est ni accomplie ni défaillie (article 1304-4 du code civil) : la convention produit alors ses effets à compter de sa date de signature, et le prix est dû dans les conditions des conditions générales de vente."
        }
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"5. La défaillance."}</Text>
        {` À défaut d'accord écrit au moins égal à ${seuil} au ${dateLimite}, ou en cas de refus ou d'accord inférieur notifié avant cette date, la condition défaille : la convention est caduque de plein droit et réputée n'avoir jamais existé. Aucune somme n'est due par le Client et les sommes versées lui sont restituées. Aucune action n'est exécutée avant l'accomplissement de la condition ou la renonciation du Client.`}
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"6. Après la défaillance."}</Text>
        {
          " Un accord de prise en charge obtenu après la défaillance ne fait pas revivre la présente convention. Les parties peuvent conclure une nouvelle convention, qui prend effet à sa propre date de signature."
        }
      </Text>
      <Text style={stylesPiece.paragraphe}>
        <Text style={gras}>{"7. Champ de la clause."}</Text>
        {
          " La présente clause ne s'applique que si elle figure à la convention. À défaut, la prise en charge par l'opérateur de compétences ne conditionne pas la convention, et elle est régie par les conditions générales de vente."
        }
      </Text>
    </SectionCarte>
  );
}

// ============================================================
// Composant
// ============================================================

export function ConventionTripartitePdf({
  data,
  identite,
}: {
  data: ConventionTripartiteData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <PageCharte
        docTitle="Convention de formation tripartite"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* Mention légale de tête */}
        <EncadreDoux>{LEGAL_MENTIONS.convention}</EncadreDoux>

        {/* 1. Parties */}
        <SectionCarte title="1. Parties">
          <Text style={stylesPiece.sousTitre}>Organisme de formation (prestataire)</Text>
          <Champ label="Raison sociale" value={identite.raisonSociale} required />
          <Champ label="SIRET" value={identite.siret} required />
          <ChampNda nda={identite.nda} />
          {/*
            🔴 F29 — la ligne n'apparaît QUE si le numéro existe.
            Marquée `required`, elle imprimait « Non renseigné » dans le style
            des champs manquants sur chaque convention, contrat et certificat —
            c'est-à-dire précisément les pièces qui partent chez le client, chez
            l'OPCO et chez le certificateur. Attirer l'œil en rouge sur une
            absence est pire que l'omettre : un organisme non encore certifié
            n'a simplement pas de numéro Qualiopi à porter, et la ligne n'a
            aucune raison d'exister. Même traitement que la facture et le devis.
          */}
          {identite.qualiopi ? (
            <Champ label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          <Champ label="Siège social" value={identite.adresseSiege} required />
          <Champ label="Email" value={identite.email || "—"} />

          <Text style={[stylesPiece.sousTitre, { marginTop: 8 }]}>
            Client (employeur / commanditaire)
          </Text>
          <Champ label="Raison sociale" value={data.client.raisonSociale} />
          <Champ label="SIRET" value={data.client.siret} />
          <Champ label="Adresse" value={data.client.adresse} />
          <Champ label="Contact" value={data.client.contact} />

          <Text style={[stylesPiece.sousTitre, { marginTop: 8 }]}>OPCO (organisme financeur)</Text>
          <Champ label="Nom de l'OPCO" value={data.opco.nom} />
          <Champ label="N° de prise en charge" value={data.opco.numeroPriseEnCharge} />
          {data.opco.adresse ? <Champ label="Adresse" value={data.opco.adresse} /> : null}
          {data.opco.contact ? <Champ label="Contact" value={data.opco.contact} /> : null}

          <Text style={local.subrogationNote}>
            En application de la subrogation de paiement, l'OPCO versera directement sa
            participation à l'organisme de formation. Le solde restant à charge reste dû par le
            client.
          </Text>
        </SectionCarte>

        {/* 2. Objet */}
        <SectionCarte title="2. Objet de la convention">
          <Champ label="Intitulé" value={data.intitule} />
          <ChampListe label="Objectifs" items={data.objectifs} />
          <Champ label="Public visé" value={data.publicVise} />
          <Champ
            label="Durée"
            value={`${data.dureeHeures} heure${data.dureeHeures > 1 ? "s" : ""}`}
          />
          <Champ label="Date de début" value={data.dateDebut} />
          <Champ label="Date de fin" value={data.dateFin} />
          <Champ label="Modalité" value={data.modalite} />
          <Champ label="Lieu" value={data.lieu} />
          <Champ
            label="Effectif prévu"
            value={`${data.effectif} stagiaire${data.effectif > 1 ? "s" : ""}`}
          />

          {/*
            🔴 Sous-lot 8B — les TROIS mentions du contenu (D.6353-1). Elles
            manquaient à cette pièce alors qu'elle invoque le texte en tête, et
            alors que la bipartite les porte depuis le 02/08. Mêmes libellés,
            mêmes replis : deux formulations divergentes de la même obligation
            légale sur deux pièces du même dossier se lisent comme une
            incohérence, et c'est le financeur qui les compare.
          */}
          <Champ
            label="Moyens pédagogiques et techniques"
            value={
              data.moyensPedagogiques ||
              "Apports méthodologiques, démonstrations et mises en situation ; supports pédagogiques remis à chaque participant ; poste de travail et outils numériques nécessaires à la mise en pratique."
            }
          />
          <Champ
            label="Suivi de l'exécution et évaluation"
            value={
              data.modalitesEvaluation ||
              "Feuille d'émargement signée par demi-journée en présentiel, relevé de connexion horodaté en distanciel. Questionnaire de positionnement en amont, évaluation des acquis au regard des objectifs en fin d'action, recueil de la satisfaction des participants."
            }
          />
          <Champ
            label="Sanction de la formation"
            value={
              data.sanction ||
              "Attestation de fin de formation (dernier alinéa de l'article L.6313-7 du Code du travail)."
            }
          />
        </SectionCarte>

        {/* 3. Conditions financières */}
        <SectionCarte title="3. Conditions financières">
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prix total HT</Text>
            <Text style={local.amountValue}>{formatEur(data.prixHt)}</Text>
          </View>
          {/* 🔴 Un montant NON ÉTABLI se dit, il ne s'imprime pas à zéro.
              « 0,00 € » sur une convention affirme que le financeur ne prend
              rien en charge — une affirmation, et fausse. « À déterminer »
              décrit exactement l'état du dossier : le barème n'a pas encore été
              relevé, ou son unité n'a pas été saisie. */}
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prise en charge OPCO ({data.opco.nom})</Text>
            <Text style={local.amountValue}>
              {data.montantPrisEnCharge !== null
                ? formatEur(data.montantPrisEnCharge)
                : "À déterminer"}
            </Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Reste à charge client</Text>
            <Text style={local.amountValue}>
              {data.resteAChargeClient !== null
                ? formatEur(data.resteAChargeClient)
                : "À déterminer"}
            </Text>
          </View>
          {data.montantPrisEnCharge === null ? (
            <Text style={local.subrogationNote}>
              Le montant de prise en charge sera arrêté par le financeur dans son accord écrit ; le
              solde correspondant restera dû par le client.
            </Text>
          ) : null}
          {/*
            🔴 F25 — la mention TVA vient du régime CONFIGURÉ, jamais d'une
            constante. L'exonération 261-4-4° était imprimée en dur alors que
            `regime_tva` vaut « assujetti » : on annonçait une exonération non
            détenue sur une pièce contractuelle et sur les kits financeurs.
            `null` en régime assujetti → aucun bloc, ce qui est correct.
          */}
          {identite.mentionTvaRegime ? (
            <Text style={stylesPiece.mention}>{identite.mentionTvaRegime}</Text>
          ) : null}
        </SectionCarte>

        {/* 4. Conditions d'annulation */}
        <SectionCarte title="4. Conditions d'annulation et acompte">
          {/*
            🔴 26/11/2026 — décision du dirigeant : dès qu'un acompte est versé, il reste acquis
            si le client annule, SANS condition de délai. L'ancienne ligne « Annulation à plus de
            15 jours ouvrés avant le début : 0 % » (acomptes remboursés) est supprimée. Les
            montants dus au-delà de l'acompte (50 % / 100 %) sont inchangés mais ne sont jamais
            inférieurs à l'acompte versé. TVA : aucune exonération.
          */}
          <Text style={stylesPiece.paragraphe}>
            En cas de désistement du client, l&apos;acompte prévu au devis ou à la présente
            convention, dès qu&apos;il a été versé, reste acquis à l&apos;organisme, quel que soit
            le délai d&apos;annulation. Il est conservé à titre de dédit et d&apos;indemnité
            (article 1231-5 du Code civil, qui laisse au juge la faculté de modérer une pénalité
            manifestement excessive). Cette règle vise le client professionnel ; elle ne
            s&apos;applique pas à la personne morale non professionnelle (articles 6.5 et 53.3 des
            conditions générales de vente), pour laquelle l&apos;acompte est restitué en
            totalité en cas d&apos;annulation avant le début. Les sommes suivantes sont dues ;
            pour le client professionnel, l&apos;acompte versé s&apos;impute sur elles et, sauf
            dans les cas prévus au dernier alinéa, n&apos;est pas restitué ; la somme due ne
            dépasse pas le prix HT :
          </Text>
          <Text style={local.listItem}>
            • Annulation à plus de 15 jours ouvrés avant le début : aucune somme en plus de
            l&apos;acompte versé, qui reste acquis à l&apos;organisme lorsque le client est
            professionnel
          </Text>
          <Text style={local.listItem}>
            • Annulation entre 8 et 15 jours ouvrés avant le début : 50 % du prix HT
          </Text>
          <Text style={local.listItem}>
            • Annulation à moins de 8 jours ouvrés avant le début : 100 % du prix HT
          </Text>
          <Text style={local.listItem}>
            • Pour le client professionnel, la somme due n&apos;est jamais inférieure au montant
            hors taxes de l&apos;acompte versé.
          </Text>
          <Text style={local.listItem}>
            • Dans tous les cas, la prestation est reportable une fois sans frais à une date
            convenue entre les parties, le report se substituant alors à l&apos;annulation ;
            l&apos;acompte versé reste alors imputé sur le prix.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Les sommes ainsi conservées ou dues, acompte compris, constituent un dédit : elles ne
            sont pas le prix d&apos;une action de formation, sont facturées à part (mention «
            Indemnité de dédit – ne constitue pas une dépense de formation professionnelle »), ne
            peuvent être imputées sur les fonds de la formation professionnelle ni prises en charge
            par un opérateur de compétences, et restent à la charge du client. Seules les heures de
            formation effectivement réalisées constituent une dépense de formation ; les autres
            sommes perçues pour des heures non réalisées et non couvertes par le dédit sont
            remboursées (article L.6354-1 du Code du travail). En cas d&apos;annulation par le
            client, la facture d&apos;acompte est annulée par avoir et son montant porté sur la
            facture de dédit. La taxe sur la valeur ajoutée s&apos;applique à ces sommes comme au
            prix, sans exonération. L&apos;acompte n&apos;est pas acquis si l&apos;annulation
            résulte d&apos;un manquement ou d&apos;une annulation de l&apos;organisme, d&apos;un cas
            de force majeure, de l&apos;exercice d&apos;un droit de rétractation légal, ou de tout
            autre cas prévu à l&apos;article 6.5 des conditions générales de vente.
            {data.conditionSuspensiveOpco
              ? " La défaillance de la condition suspensive de l'article 5 bis rend la présente convention caduque ; les sommes versées sont alors restituées."
              : ""}
          </Text>
        </SectionCarte>

        {/*
          🔴 Sous-lot 8B — les cinq sections de fond, absentes de cette pièce.

          La bipartite les a reçues le 02/08 (obligations, RGPD, propriété
          intellectuelle, responsabilité, droit applicable) après le constat
          qu'elle ne couvrait que l'objet, le prix et l'annulation : en cas de
          litige — support recopié, résultat déçu, incident de traitement —
          l'organisme n'opposait aucun texte, et le RGPD restait muet sur la
          pièce même qui fait traiter des données de stagiaires.

          Le raisonnement vaut à l'identique ici, et davantage : la présence
          d'un troisième signataire n'ajoute aucune clause, elle ajoute
          seulement un lecteur de plus. Les textes sont donc REPRIS À
          L'IDENTIQUE de la bipartite — deux rédactions différentes du même
          engagement, sur deux pièces du même dossier, s'interpréteraient l'une
          contre l'autre.
        */}

        {/* 5. Obligations des parties */}
        <SectionCarte title="5. Obligations des parties">
          <Text style={stylesPiece.paragraphe}>
            L&apos;organisme s&apos;engage à réaliser l&apos;action conformément au programme
            annexé, à mettre à disposition les moyens décrits ci-dessus, à remettre au client les
            documents attestant de la réalisation (feuille d&apos;émargement, attestation) et à
            respecter la confidentialité des informations dont il a connaissance.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Le client s&apos;engage à assurer la présence des participants inscrits, à informer
            l&apos;organisme de toute contrainte d&apos;accessibilité au plus tôt afin que les
            adaptations nécessaires soient étudiées, et — lorsque la formation se déroule sur site —
            à mettre à disposition un local et les équipements convenus, conformes aux règles
            d&apos;hygiène et de sécurité qui lui incombent.
          </Text>
          {/*
            La seule clause PROPRE à la tripartite. Elle ne double pas la note de
            subrogation du § 1 : celle-ci dit qui verse, celle-là dit ce qui se
            passe quand le versement n'arrive pas. C'est précisément le trou
            relevé à l'audit (Q3) — techniquement le système sait facturer N
            payeurs, mais aucun texte ne permettait de réémettre au client.
          */}
          <Text style={stylesPiece.paragraphe}>
            La prise en charge par l&apos;OPCO est subordonnée à son accord écrit préalable et au
            respect de ses règles de financement. En cas de refus, de réduction, de caducité de
            l&apos;accord ou de non-paiement par l&apos;OPCO, les sommes correspondantes
            redeviennent exigibles auprès du client, qui demeure le débiteur du prix convenu à
            l&apos;article 3, sous réserve des conditions de dédit et d&apos;abandon en cours
            d&apos;exécution prévues aux conditions générales de vente, et sauf lorsque la
            réduction, la caducité ou le non-paiement résulte d&apos;un manquement de
            l&apos;organisme à ses propres obligations (inexécution de tout ou partie de
            l&apos;action, défaut des justificatifs de réalisation qui lui incombent).
          </Text>
        </SectionCarte>

        {/* 5 bis. INT-T65-A — imprimée SEULEMENT si la case a été cochée. */}
        {data.conditionSuspensiveOpco ? (
          <ClauseConditionSuspensiveOpco p={data.conditionSuspensiveOpco} />
        ) : null}

        {/* 6. Données personnelles */}
        <SectionCarte title="6. Données à caractère personnel">
          <Text style={stylesPiece.paragraphe}>
            Chaque partie agit en qualité de responsable de traitement pour les données qu&apos;elle
            collecte. L&apos;organisme traite les données d&apos;identité, d&apos;émargement et
            d&apos;évaluation des participants aux seules fins d&apos;exécuter la présente
            convention et de satisfaire à ses obligations légales, notamment la conservation des
            pièces justificatives pendant cinq (5) ans.
          </Text>
          {/*
            Spécifique à la tripartite : la transmission au financeur est un
            traitement de plus, et il doit être annoncé sur la pièce que le
            financeur lui-même reçoit. L'omettre reviendrait à faire circuler
            des données d'émargement et d'évaluation sans base annoncée.
          */}
          <Text style={stylesPiece.paragraphe}>
            Les pièces justificatives de réalisation (feuille d&apos;émargement, attestation,
            facture) sont transmises à l&apos;OPCO aux seules fins d&apos;instruction et de
            règlement du dossier de prise en charge, en exécution de la présente convention.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Les personnes concernées disposent des droits d&apos;accès, de rectification,
            d&apos;effacement, de limitation et d&apos;opposition prévus par le Règlement (UE)
            2016/679, exerçables auprès de {identite.dpoEmail || identite.email || "l'organisme"}.
            Elles peuvent introduire une réclamation auprès de la CNIL. Aucune donnée n&apos;est
            cédée à des tiers à des fins commerciales.
          </Text>
        </SectionCarte>

        {/* 7. Propriété intellectuelle et confidentialité */}
        <SectionCarte title="7. Propriété intellectuelle et confidentialité">
          <Text style={stylesPiece.paragraphe}>
            Les supports pédagogiques, méthodes et contenus demeurent la propriété exclusive de
            l&apos;organisme. Ils sont remis aux participants pour leur usage professionnel
            personnel ; toute reproduction, diffusion à des tiers, revente ou utilisation à des fins
            de formation par le client est soumise à l&apos;accord écrit préalable de
            l&apos;organisme.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Chaque partie s&apos;engage à ne pas divulguer les informations confidentielles portées
            à sa connaissance à l&apos;occasion de l&apos;action, pendant sa durée et les deux (2)
            années qui suivent son terme.
          </Text>
        </SectionCarte>

        {/* 8. Responsabilité et force majeure */}
        <SectionCarte title="8. Responsabilité et force majeure">
          <Text style={stylesPiece.paragraphe}>
            L&apos;organisme est tenu d&apos;une obligation de moyens quant à l&apos;atteinte des
            objectifs pédagogiques, dont la réalisation dépend de l&apos;implication des
            participants. Sa responsabilité éventuelle est limitée au montant hors taxes
            effectivement réglé au titre de la présente convention, à l&apos;exclusion des dommages
            indirects tels que perte d&apos;exploitation, de clientèle ou de chiffre
            d&apos;affaires.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Aucune des parties ne peut être tenue responsable d&apos;un manquement résultant
            d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil. La partie
            empêchée en informe l&apos;autre sans délai ; l&apos;action est alors reportée à une
            date convenue entre les parties.
          </Text>
        </SectionCarte>

        {/* 9. Différends */}
        <SectionCarte title="9. Droit applicable et différends">
          <Text style={stylesPiece.paragraphe}>
            La présente convention est régie par le droit français. En cas de différend relatif à sa
            formation, son exécution ou son interprétation, les parties s&apos;efforceront de
            trouver une solution amiable. À défaut d&apos;accord dans un délai de trente (30) jours
            à compter de la première notification écrite, le litige sera porté devant le tribunal
            compétent du ressort du siège de l&apos;organisme.
          </Text>
          <Text style={stylesPiece.paragraphe}>
            Toute réclamation relative au déroulement de l&apos;action peut être adressée à{" "}
            {identite.email || "l'organisme"} ; elle est enregistrée, traitée et fait l&apos;objet
            d&apos;une réponse motivée.
          </Text>
        </SectionCarte>

        {/* 10. Annexes */}
        <SectionCarte title="10. Documents annexés">
          <Text style={local.annexeItem}>– Programme détaillé de la formation</Text>
          <Text style={local.annexeItem}>– Règlement intérieur des stagiaires</Text>
          <Text style={local.annexeItem}>– Conditions générales de vente (CGV)</Text>
          <Text style={local.annexeItem}>
            – Accord de prise en charge OPCO n° {data.opco.numeroPriseEnCharge}
          </Text>
        </SectionCarte>

        {/* Handicap (L15, NC12, indicateur 26) — non numérotée, pour ne renuméroter
            aucune section : référent, contact et possibilité d'adaptation. */}
        <SectionCarte title="Accessibilité et situation de handicap">
          <Text style={stylesPiece.paragraphe}>
            {
              "Situation de handicap : notre référent handicap étudie avec vous, avant la formation, les adaptations possibles (supports, rythme, accès, modalités). Contact : handicap@axion-ia.com."
            }
          </Text>
        </SectionCarte>

        {/* 11. Signatures — 3 parties */}
        {/* « Fait à » = ville du siège — même raisonnement que la convention : un
            blanc sur une pièce signée électroniquement reste vide pour toujours. */}
        <BlocSignature titre="11. Signatures">
          <SignatureZone
            intro="La présente convention est établie en trois exemplaires originaux, un pour chaque partie."
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateConvention}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Pour le client",
                signature: data.signatures?.client ?? null,
                nom: data.client.raisonSociale,
              },
              {
                titre: "Pour l'OPCO",
                signature: data.signatures?.financeur ?? null,
                nom: data.opco.nom,
              },
            ]}
          />
        </BlocSignature>
      </PageCharte>
    </Document>
  );
}
