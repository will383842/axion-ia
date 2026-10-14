/**
 * Contrat-cadre de sous-traitance de formation — VERSION 4 (étape 3 du C4).
 *
 * v4 — 14/10/2026, décisions de Will : art. 18.2 (attestation URSSAF à l'approche de
 * 5 000 € HT, avant une mission qui ferait dépasser ce seuil, puis tous les six mois ;
 * au-delà, le règlement attend l'attestation) ; harmonisés avec lui et avec la lettre de
 * mission v3 : 4.5, 16.1, 16.3, 16.7, 20.2 (bilan de fin de formation), annexes 1 et 2
 * (passées en version 2). La v3 est figée, mot pour mot, dans
 * `archives/contrat-cadre.v3.tsx` : ses exemplaires signés se rejouent avec elle.
 *
 * Un seul contrat pour un formateur indépendant et pour un organisme de
 * formation sous-traitant : seules les clauses marquées « si indépendant » ou
 * « si organisme » changent. Texte ARRÊTÉ le 10/10/2026 ; il est repris ici
 * mot pour mot. Toute retouche d'un mot rendu est une nouvelle version
 * (`gabarit-versions.ts`, `versions-arretees.ts`), jamais une correction en
 * place : les exemplaires signés se rejouent avec le texte qui les a produits.
 *
 * 🔑 COEXISTENCE. La version 2 (`contrat-sous-traitance.tsx`) reste celle
 * qu'émet le chemin actuel des organismes : ce fichier n'est émis par aucun
 * appelant tant que le lot d'émission n'est pas en ligne et allumé. Il est
 * rendable dès maintenant, pour que l'exemplaire signé d'une pièce v3 existe
 * le jour où la première est signée.
 *
 * 🔴 Les champs d'identité (capital, RCS, région de déclaration, certificateur,
 * adresse dédiée aux formateurs) sont DONNÉS par l'appelant, jamais écrits ici.
 * Un champ manquant s'imprime en blanc souligné ; `champsManquantsContratCadre`
 * permet à l'émetteur de refuser avant d'émettre.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  BulletList,
  DataTable,
  SignatureZone,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

/** Date d'arrêt de la version 4, imprimée en tête du contrat. */
export const DATE_ARRET_CONTRAT_CADRE_V4 = "14 octobre 2026";

export type NatureCocontractant = "independant" | "organisme";

/** Société par laquelle le cocontractant exerce. Absente = entreprise individuelle. */
export interface SocieteCocontractant {
  denomination: string;
  /** « SASU », « EURL », « SAS »… */
  forme: string;
  capital: string;
}

export interface ContratCadreData {
  numero: string;
  estCopie?: boolean;
  /** Formateur indépendant, ou organisme de formation sous-traitant. */
  nature: NatureCocontractant;
  cocontractant: {
    /** Prénom Nom du formateur, ou du représentant de l'organisme. */
    prenomNom: string;
    /**
     * Société. Obligatoirement présente pour un organisme ; pour un
     * indépendant, présente s'il exerce en société (SASU, EURL…).
     */
    societe?: SocieteCocontractant | null;
    /** Qualité du représentant (organisme seulement). */
    qualiteRepresentant?: string;
    siret: string;
    /** Adresse professionnelle (entreprise individuelle) ou du siège (société). */
    adresse: string;
    /** `null` = « en cours d'obtention » (indépendant seulement, article 19). */
    numeroDeclaration: string | null;
    /** Région de la déclaration d'activité (organisme). */
    regionDeclaration?: string;
    /** `null` = « sans objet ». */
    tvaIntracom: string | null;
    email: string;
  };
  /**
   * Mandat d'autofacturation (annexe 3). Toujours donné par un indépendant ;
   * un organisme peut le refuser à la signature (article 13.4). Porté par
   * l'instantané : `mandat-source.ts` ne dérive aucun mandat d'un contrat qui
   * porte `false`.
   */
  mandatAutofacturation: boolean;
  /** Champs d'Axion propres à ce contrat, absents de l'identité commune. */
  axion: {
    /** Région du préfet auprès duquel la déclaration d'activité d'Axion est enregistrée. */
    regionDeclaration: string;
    /** Certificateur Qualiopi — imprimé seulement si Axion est certifiée. */
    certificateur?: string;
    /** Adresse électronique dédiée aux formateurs (article 34). */
    adresseFormateurs: string;
  };
  dateContrat: string;
  /** Preuves de signature apposées, par partie (`sous_traitant`, `axionia`). */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Champs
// ============================================================

const BLANC = "____________";

function champ(valeur: string | null | undefined): string {
  const v = typeof valeur === "string" ? valeur.trim() : "";
  return v === "" ? BLANC : v;
}

/** « 1 000 » → « 1 000 € » ; une valeur qui porte déjà son unité reste telle quelle. */
function capital(valeur: string | null | undefined): string {
  const v = champ(valeur);
  return v === BLANC || v.includes("€") ? v : `${v} €`;
}

function vide(valeur: string | null | undefined): boolean {
  return typeof valeur !== "string" || valeur.trim() === "";
}

/**
 * Champs qui s'imprimeraient en blanc. L'émetteur refuse d'émettre tant que la
 * liste n'est pas vide : un blanc sur une pièce signée reste vide pour toujours.
 */
export function champsManquantsContratCadre(
  data: ContratCadreData,
  identite: OrganismeIdentite,
): string[] {
  const manquants: string[] = [];
  const exiger = (libelle: string, v: string | null | undefined) => {
    if (vide(v)) manquants.push(libelle);
  };
  exiger("Axion — capital", identite.capitalSocial);
  exiger("Axion — ville du RCS", identite.rcsVille);
  exiger("Axion — SIREN", identite.siren);
  exiger("Axion — siège", identite.adresseSiege);
  exiger("Axion — représentant", identite.representantLegalNom);
  exiger("Axion — qualité du représentant", identite.representantLegalQualite);
  exiger("Axion — numéro de déclaration d'activité", identite.nda);
  exiger("Axion — région de déclaration", data.axion.regionDeclaration);
  exiger("Axion — adresse dédiée aux formateurs", data.axion.adresseFormateurs);
  if (!vide(identite.qualiopi)) exiger("Axion — certificateur", data.axion.certificateur);

  const c = data.cocontractant;
  exiger("Prénom et nom", c.prenomNom);
  exiger("SIRET", c.siret);
  exiger("Adresse", c.adresse);
  exiger("Adresse électronique", c.email);
  if (c.societe) {
    exiger("Dénomination", c.societe.denomination);
    exiger("Forme", c.societe.forme);
    exiger("Capital", c.societe.capital);
  }
  if (data.nature === "organisme") {
    if (!c.societe) manquants.push("Dénomination");
    exiger("Qualité du représentant", c.qualiteRepresentant);
    exiger("Numéro de déclaration d'activité", c.numeroDeclaration);
    exiger("Région de déclaration", c.regionDeclaration);
    exiger("Numéro de TVA intracommunautaire", c.tvaIntracom);
  }
  return manquants;
}

// ============================================================
// Mise en forme
// ============================================================

const gras = { fontWeight: "bold" as const };

function P({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={pdfStyles.paragraph}>{children}</Text>;
}

function B({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={gras}>{children}</Text>;
}

/**
 * Le contrat est découpé en plusieurs feuillets (`Page` @react-pdf). D'un seul
 * tenant, ses quelque quinze pages font diverger la hauteur du pied de page
 * fixe d'une page à l'autre jusqu'à l'échec du rendu (« unsupported number »).
 * Chaque feuillet reprend en-tête, pied et numérotation continue.
 */
function Feuillet({
  data,
  identite,
  children,
}: {
  data: ContratCadreData;
  identite: OrganismeIdentite;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <QualiopiPage
      docTitle="Contrat-cadre de sous-traitance de formation"
      docNumber={data.numero}
      identite={identite}
      {...(data.estCopie ? { estCopie: true as const } : {})}
    >
      {children}
    </QualiopiPage>
  );
}

// ============================================================
// Composant
// ============================================================

export function ContratCadrePdf({
  data,
  identite,
}: {
  data: ContratCadreData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const ind = data.nature === "independant";
  const org = !ind;
  const c = data.cocontractant;
  const axionCertifiee = !vide(identite.qualiopi);

  return (
    <Document>
      <Feuillet data={data} identite={identite}>
        <Text style={pdfStyles.legalNote}>
          Version 4 du {DATE_ARRET_CONTRAT_CADRE_V4} · Annexe 1 version 2 · Annexe 2 version 2 ·
          Annexe 3 version 1 · Annexe 4 version 1
        </Text>

        <DocSection title="Article 1 — Les parties">
          <P>
            <B>1.1 Axion.</B> Axion-IA SAS, au capital de {capital(identite.capitalSocial)},
            immatriculée au RCS de {champ(identite.rcsVille)} sous le numéro {champ(identite.siren)}
            , dont le siège est situé {champ(identite.adresseSiege)}, représentée par{" "}
            {champ(identite.representantLegalNom)}, {champ(identite.representantLegalQualite)}.
            Déclaration d&apos;activité de prestataire de formation enregistrée sous le numéro{" "}
            {champ(identite.nda)} auprès du préfet de la région{" "}
            {champ(data.axion.regionDeclaration)}. Cet enregistrement ne vaut pas agrément de
            l&apos;État.
            {axionCertifiee
              ? ` Certification Qualiopi n° ${champ(identite.qualiopi)}, délivrée par ${champ(
                  data.axion.certificateur,
                )}, au titre de la catégorie « actions de formation ».`
              : ""}
          </P>
          <P>
            <B>1.2 Vous.</B>
          </P>
          {ind ? (
            <>
              {c.societe ? (
                <P>
                  {champ(c.prenomNom)}, formateur indépendant, exerçant par la société{" "}
                  {champ(c.societe.denomination)}, {champ(c.societe.forme)}, au capital de{" "}
                  {capital(c.societe.capital)}, immatriculée sous le numéro SIRET {champ(c.siret)},
                  dont le siège est situé {champ(c.adresse)}, représentée par {champ(c.prenomNom)},
                  son dirigeant, qui anime lui-même les formations.
                </P>
              ) : (
                <P>
                  {champ(c.prenomNom)}, formateur indépendant, exerçant en entreprise individuelle,
                  y compris sous le régime de la micro-entreprise, sous le numéro SIRET{" "}
                  {champ(c.siret)}, à l&apos;adresse professionnelle {champ(c.adresse)}.
                </P>
              )}
              <P>
                Numéro de déclaration d&apos;activité :{" "}
                {vide(c.numeroDeclaration)
                  ? "en cours d'obtention (article 19)."
                  : `${champ(c.numeroDeclaration)}.`}
              </P>
              <P>
                Numéro de TVA intracommunautaire :{" "}
                {vide(c.tvaIntracom) ? "sans objet." : `${champ(c.tvaIntracom)}.`}
              </P>
              <P>Adresse électronique de contact : {champ(c.email)}.</P>
            </>
          ) : (
            <>
              <P>
                {champ(c.societe?.denomination)}, {champ(c.societe?.forme)}, au capital de{" "}
                {capital(c.societe?.capital)}, immatriculée sous le numéro SIRET {champ(c.siret)},
                dont le siège est situé {champ(c.adresse)}, représentée par {champ(c.prenomNom)},{" "}
                {champ(c.qualiteRepresentant)}. Organisme de formation déclaré sous le numéro{" "}
                {champ(c.numeroDeclaration)} auprès du préfet de la région{" "}
                {champ(c.regionDeclaration)}. Numéro de TVA intracommunautaire :{" "}
                {champ(c.tvaIntracom)}. Adresse électronique de contact : {champ(c.email)}.
              </P>
              <P>
                Les personnes qui animent les formations pour votre compte sont appelées «
                intervenants désignés » (article 7).
              </P>
            </>
          )}
          <P>
            <B>1.3 Établissement en France.</B> Vous déclarez être établi en France. Ce contrat ne
            s&apos;applique pas à un formateur ou à un organisme établi hors de France.
          </P>
        </DocSection>

        <DocSection title="Article 2 — Les mots du contrat">
          <BulletList
            items={[
              "Mission : l'animation d'une formation précise, organisée par Axion pour un client, à des dates données.",
              "Proposition : le message par lequel Axion vous propose une mission dans votre espace et par e-mail. Il indique la formation, le client, les dates et horaires, le lieu ou la visio, les honoraires et, s'il y en a un, le forfait de déplacement.",
              "Lettre de mission : le document d'une page qui confirme une mission acceptée (article 5).",
              "Journée : une journée de formation d'environ 7 heures, composée de deux demi-journées, le matin et l'après-midi.",
              "Demi-journée : la séquence du matin ou celle de l'après-midi prévue au programme, réalisée et dont la feuille de présence est signée.",
              "Votre espace : votre espace personnel en ligne, ouvert par Axion, auquel vous accédez par un lien de connexion personnel.",
              "Votre département : le département de votre adresse professionnelle déclarée dans votre dossier.",
              "Durée de la relation : le temps écoulé depuis la prise d'effet de ce contrat (article 33).",
              "Jour ouvré : un jour du lundi au vendredi, hors jours fériés en France métropolitaine.",
            ]}
          />
        </DocSection>

        <DocSection title="Article 3 — Objet et nature du contrat">
          <P>
            <B>3.1</B> Ce contrat fixe une fois pour toutes les règles des missions d&apos;animation
            de formation qu&apos;Axion <B>peut</B> vous proposer. À lui seul, il ne crée aucune
            mission.
          </P>
          <P>
            <B>3.2</B> Axion ne vous garantit aucun nombre de missions, aucun volume de journées et
            aucun chiffre d&apos;affaires. Vous ne promettez à Axion aucune disponibilité.
          </P>
          <P>
            <B>3.3</B> Aucune exclusivité, dans un sens comme dans l&apos;autre. Vous restez libre
            de travailler pour d&apos;autres organismes, d&apos;autres clients ou pour votre propre
            compte, y compris dans le même domaine. Axion reste libre de confier ses formations à
            d&apos;autres intervenants.
          </P>
          <P>
            <B>3.4</B> Vous exercez en professionnel indépendant, immatriculé à ce titre. Aucun lien
            de subordination n&apos;existe entre vous et Axion.
          </P>
        </DocSection>

        <DocSection title="Article 4 — Comment une mission est proposée et acceptée">
          <P>
            <B>4.1 La proposition.</B> Axion vous propose une mission dans votre espace et vous en
            informe par e-mail. La proposition indique, <B>avant</B> toute réponse de votre part, la
            formation et son programme, le client, les dates et horaires convenus avec le client, le
            lieu ou la visio, le nombre de journées et de demi-journées, les honoraires et le
            forfait de déplacement éventuel.
          </P>
          <P>
            <B>4.2 Votre réponse.</B> Vous acceptez ou refusez librement, sans avoir à vous
            justifier. La proposition indique la date jusqu&apos;à laquelle elle reste ouverte. Sans
            réponse à cette date, elle se ferme et Axion peut la proposer à une autre personne. Un
            refus ou une absence de réponse n&apos;a aucune conséquence : ils ne sont enregistrés
            nulle part à votre détriment et ne changent rien aux propositions suivantes.
          </P>
          <P>
            <B>4.3 La mission est conclue par votre acceptation.</B> La mission est conclue au
            moment où vous cliquez « J&apos;accepte » dans votre espace. Ce clic est horodaté. La
            lettre de mission vient ensuite la confirmer (article 5).
          </P>
          <P>
            <B>4.4 Changement de dates.</B> Si les dates ou le lieu changent après votre acceptation
            et avant le début de la mission, Axion vous fait une nouvelle proposition. Vous êtes
            libre de l&apos;accepter ou non. Si vous ne l&apos;acceptez pas, les dates
            d&apos;origine sont considérées comme annulées par Axion à la date du changement, et
            l&apos;article 11 s&apos;applique.
          </P>
          <P>
            <B>4.5 Conditions pour recevoir une proposition.</B> Axion ne vous propose une mission
            que si ce contrat est en vigueur et que les pièces de l&apos;article 18 et de
            l&apos;annexe 2 sont à jour, en particulier le numéro de déclaration d&apos;activité
            (article 19) et, à partir du seuil de l&apos;article 18.2, l&apos;attestation URSSAF.
          </P>
          <P>
            <B>4.6 Formation attendant l&apos;accord de son financeur.</B> Lorsqu&apos;une formation
            attend l&apos;accord de l&apos;organisme qui la finance (par exemple un opérateur de
            compétences), la proposition le précise. Un refus du financeur notifié avant votre
            acceptation ne vous ouvre aucun droit. Un refus notifié après votre acceptation est
            traité comme une annulation par Axion (article 11).
          </P>
        </DocSection>

        <DocSection title="Article 5 — La lettre de mission et l'ordre des documents">
          <P>
            <B>5.1</B> Pour chaque mission acceptée, Axion vous adresse une lettre de mission
            d&apos;une page, dans votre espace et par e-mail. Elle reprend les données de la mission
            : formation, client, dates, lieu ou visio, journées et demi-journées, honoraires,
            forfait de déplacement, date limite de paiement et, le cas échéant, condition liée au
            financeur. Une mission peut durer une demi-journée, une journée ou plusieurs jours,
            consécutifs ou non : une seule lettre couvre toutes ses dates.
          </P>
          <P>
            <B>5.2</B> La lettre de mission est une condition particulière de ce contrat. Elle ne
            vous impose aucun engagement qui ne figure pas dans ce contrat. Vous la signez d&apos;un
            clic dans votre espace, sans code. Axion la contresigne. Cette contresignature
            n&apos;est pas nécessaire pour que la formation ait lieu.
          </P>
          <P>
            <B>5.3 Ordre des documents.</B> En cas de contradiction entre la lettre de mission et ce
            contrat, le contrat l&apos;emporte, sauf mention expresse contraire dans la lettre. Les
            données propres à la mission (formation, dates, lieu, journées et demi-journées,
            honoraires, forfait de déplacement) sont celles de la lettre, qui reprend la proposition
            acceptée. Une mention expresse ne peut pas vous imposer un engagement nouveau sans votre
            accord écrit distinct.
          </P>
          <P>
            <B>5.4</B> Une mission non encore confirmée par une lettre de mission signée reste régie
            par ce contrat dès votre acceptation.
          </P>
        </DocSection>

        <DocSection title="Article 6 — Votre indépendance dans l'exécution">
          <P>
            <B>6.1</B> Vous animez la formation selon le programme convenu entre Axion et le client
            et en visant les compétences qu&apos;il décrit. Vous choisissez librement vos méthodes
            d&apos;animation, vos exemples, vos exercices et l&apos;organisation de votre
            préparation.
          </P>
          <P>
            <B>6.2</B> Les dates et horaires des séances sont ceux du programme convenu avec le
            client et indiqués dans la proposition que vous avez acceptée. En dehors des séances,
            vous organisez votre temps comme vous l&apos;entendez.
          </P>
          <P>
            <B>6.3</B> Vous utilisez votre propre matériel (ordinateur, logiciels, outils de visio
            de votre choix lorsque le client n&apos;en fixe pas un). Pour une formation à distance,
            vous pouvez utiliser le lien de visio fourni par le client ou par Axion, ou le vôtre.
          </P>
          <P>
            <B>6.4</B> Axion ne vous transmet aucun script, ne fixe pas l&apos;ordre de vos
            séquences et ne vous demande aucun compte rendu de votre activité en dehors des pièces
            de l&apos;article 20.
          </P>
        </DocSection>

        <DocSection title="Article 7 — Qui anime, et le remplacement">
          {ind ? (
            <>
              <P>
                <B>7.1</B> Vous animez la mission vous-même.
              </P>
              <P>
                <B>7.2</B> Si vous êtes empêché, vous pouvez proposer à Axion une personne de
                qualification équivalente pour vous remplacer. Axion accepte ou non ce remplacement,
                au regard des compétences de la personne. Si Axion l&apos;accepte, la mission est
                confiée directement à cette personne, dans le cadre de son propre contrat avec
                Axion, et vous êtes libéré de la mission, sans indemnité ni pénalité de part et
                d&apos;autre.
              </P>
            </>
          ) : (
            <>
              <P>
                <B>7.1</B> Chaque proposition indique l&apos;intervenant désigné que vous avez
                présenté pour la mission. Vous transmettez son CV de moins de 24 mois avant la
                proposition.
              </P>
              <P>
                <B>7.2</B> Vous pouvez proposer de remplacer l&apos;intervenant désigné par une
                autre personne de qualification équivalente, avec son CV. Le remplacement n&apos;a
                lieu qu&apos;avec l&apos;accord écrit d&apos;Axion. Vous restez la partie au
                contrat, et c&apos;est vous qui recevez les honoraires.
              </P>
              <P>
                <B>7.3</B> Vous répondez du respect de ce contrat par vos intervenants désignés, en
                particulier des articles 8, 20, 22, 24 et 25.
              </P>
            </>
          )}
          <P>
            <B>7.4</B> Vous pouvez vous désister d&apos;une mission acceptée depuis votre espace,
            sans avoir à en donner la raison. Vous prévenez Axion dès que vous savez que vous ne
            pourrez pas animer la mission. Aucune pénalité ni indemnité n&apos;est due du seul fait
            de ce désistement.
          </P>
        </DocSection>

        <DocSection title="Article 8 — Votre nom et la marque Axion">
          <P>
            <B>8.1</B> Vous intervenez sous votre propre nom
            {org ? " et sous celui de votre organisme" : ""},{" "}
            {org ? "comme organisme sous-traitant" : "comme formateur indépendant"} désigné par
            Axion pour la formation.
          </P>
          <P>
            <B>8.2</B> Vous ne vous présentez jamais comme « formateur Axion », ni comme faisant
            partie de l&apos;équipe d&apos;Axion. Vous n&apos;utilisez pas d&apos;adresse
            électronique, de carte de visite, de signature électronique, de logo ou d&apos;intitulé
            au nom d&apos;Axion.
          </P>
          <P>
            <B>8.3</B> Vous pouvez mentionner, sur votre site ou vos profils, que vous animez, en
            indépendant, des formations organisées par Axion-IA. Vous n&apos;utilisez ni le logo
            d&apos;Axion ni la marque ou le logo Qualiopi, et vous ne faites aucune mention de
            certification, de label ou de financement liée à Axion.
          </P>
        </DocSection>

        <DocSection title="Article 9 — Honoraires">
          <P>
            <B>9.1</B> Les honoraires sont de <B>350 € HT par journée</B> et de{" "}
            <B>175 € HT par demi-journée</B>. Ils sont les mêmes en présentiel et à distance.
          </P>
          <P>
            <B>9.2</B> Chaque demi-journée réalisée et signée sur la feuille de présence ouvre droit
            à 175 € HT. Une journée complète donne 350 € HT, jamais plus, même si elle dépasse 7
            heures. Il n&apos;existe pas de taux horaire, ni de calcul au prorata des heures.
          </P>
          <P>
            <B>9.3</B> Les honoraires de chaque mission sont ceux de la proposition que vous avez
            acceptée. Ils couvrent la préparation et l&apos;animation de la formation.
          </P>
          <P>
            <B>9.4</B> Les montants sont hors taxes. La TVA s&apos;ajoute selon votre régime
            (article 14).
          </P>
        </DocSection>

        <DocSection title="Article 10 — Déplacements">
          <P>
            <B>10.1</B> Les déplacements dans votre département et les formations à distance sont
            compris dans les honoraires.
          </P>
          <P>
            <B>10.2</B> Pour une formation hors de votre département, la proposition indique, avant
            votre acceptation, un forfait de déplacement par journée de déplacement. Ce forfait ne
            dépasse jamais <B>150 € HT par journée</B>. Une demi-journée hors de votre département
            compte comme une journée de déplacement.
          </P>
          <P>
            <B>10.3</B> Le forfait couvre l&apos;ensemble des frais de transport, de repas et
            d&apos;hébergement. Aucune note de frais n&apos;est présentée ni remboursée.
          </P>
          <P>
            <B>10.4</B> Le forfait suit les journées réellement réalisées. Une journée annulée
            n&apos;ouvre pas droit au forfait.
          </P>
        </DocSection>

        <DocSection title="Article 11 — Annulation et report">
          <P>
            <B>11.1 Annulation par Axion à moins de 72 heures.</B> Si Axion annule une mission
            acceptée, ou certaines de ses journées, moins de 72 heures avant le début de la première
            journée annulée, la moitié des honoraires des journées et demi-journées annulées vous
            est due. Le forfait de déplacement n&apos;entre pas dans ce calcul.
          </P>
          <P>
            <B>11.2 Annulation par Axion à 72 heures ou plus.</B> Aucune somme n&apos;est due.
          </P>
          <P>
            <B>11.3</B> L&apos;indemnité de l&apos;article 11.1 est due dès votre acceptation de la
            mission, que la lettre de mission ait été signée ou non. Elle est payée au plus tard 30
            jours après la date de l&apos;annulation.
          </P>
          <P>
            <B>11.4 Report.</B> Un report vaut annulation des dates d&apos;origine et nouvelle
            proposition (article 4.4).
          </P>
          <P>
            <B>11.5 Désistement de votre part.</B> L&apos;article 7.4 s&apos;applique : aucune
            pénalité, aucune indemnité.
          </P>
          <P>
            <B>11.6 Force majeure.</B> En cas de force majeure au sens de l&apos;article 1218 du
            code civil, aucune indemnité n&apos;est due de part et d&apos;autre.
          </P>
        </DocSection>
      </Feuillet>
      <Feuillet data={data} identite={identite}>
        <DocSection title="Article 12 — Feuilles de présence et service fait">
          <P>
            <B>12.1</B> Les présences sont attestées par demi-journée. Vous faites signer la feuille
            de présence par les stagiaires et vous la signez.
          </P>
          <P>
            <B>12.2</B> Vous choisissez de faire signer les feuilles dans l&apos;outil d&apos;Axion
            ou sur une feuille papier, que vous signez et remettez à Axion, en la déposant dans
            votre espace ou par tout autre moyen convenu.
          </P>
          <P>
            <B>12.3</B> Le service fait est constaté par les feuilles de présence signées. Les
            journées et demi-journées payées sont celles qui y figurent.
          </P>
        </DocSection>

        <DocSection title="Article 13 — Facturation par Axion (autofacturation)">
          <P>
            <B>13.1</B> Vous donnez à Axion mandat d&apos;établir en votre nom et pour votre compte
            les factures de vos honoraires, de vos forfaits de déplacement et des sommes de
            l&apos;article 11.1. Les conditions de ce mandat figurent à l&apos;annexe 3. Elles font
            partie du contrat.
          </P>
          <P>
            <B>13.2</B> Axion émet l&apos;autofacture dès que les feuilles de présence de la mission
            (ou du mois, article 16.3) sont signées. Vous la recevez avec le relevé correspondant,
            dans votre espace et par e-mail. Vous disposez de 8 jours pour la contester (annexe 3).
          </P>
          <P>
            <B>13.3</B> Si vous révoquez le mandat (annexe 3, article A3.7), vous établissez
            vous-même vos factures après la fin du préavis de révocation. La date limite de paiement
            reste celle de l&apos;article 16.
          </P>
          {org ? (
            <P>
              <B>13.4</B> Vous pouvez choisir, à la signature, de ne pas donner ce mandat. Dans ce
              cas, vous établissez vos propres factures, à raison d&apos;une facture par mission ou
              par mois de journées réalisées, et la date limite de paiement reste celle de
              l&apos;article 16.
            </P>
          ) : null}
        </DocSection>

        <DocSection title="Article 14 — TVA">
          <P>
            <B>14.1</B> Vous déclarez votre régime de TVA dans votre dossier. L&apos;autofacture
            porte la mention qui y correspond :
          </P>
          <BulletList
            items={[
              "franchise en base : « TVA non applicable, art. 293 B du CGI » ;",
              "exonération des prestations de formation professionnelle continue : « Exonération de TVA, art. 261-4-4° a du CGI ». Vous ne choisissez ce régime que si vous disposez d'un numéro de déclaration d'activité et que vous bénéficiez de cette exonération ; vous le déclarez dans votre dossier ;",
              "TVA au taux normal : TVA de 20 % ajoutée aux montants hors taxes.",
            ]}
          />
          <P>
            <B>14.2</B> Vous informez Axion à l&apos;avance de tout changement de régime et de sa
            date d&apos;effet. Chaque journée est facturée selon le régime en vigueur à sa date.
          </P>
          <P>
            <B>14.3</B> Vous restez seul redevable de la TVA facturée en votre nom et de vos propres
            déclarations fiscales et sociales.
          </P>
          <P>
            <B>14.4</B> Toute référence à un article du code général des impôts vise aussi la
            disposition qui lui succède, y compris en cas de renumérotation ou de transfert dans un
            autre code.
          </P>
        </DocSection>

        <DocSection title="Article 15 — Facture électronique">
          <P>
            <B>15.1</B> Axion reçoit et émet ses factures par la plateforme agréée qu&apos;elle a
            choisie, actuellement Tiime.
          </P>
          <P>
            <B>15.2</B> Tant que vous n&apos;êtes pas soumis à l&apos;obligation d&apos;émettre vos
            factures sous forme électronique (article 289 bis du code général des impôts ou
            disposition qui lui succède), l&apos;autofacture vous est transmise par e-mail et dans
            votre espace. À partir de la date où cette obligation s&apos;applique à vous,
            l&apos;autofacture est établie au format électronique et déposée par Axion, par sa
            plateforme agréée, à destination de votre adresse de facturation inscrite à
            l&apos;annuaire national. Une copie lisible vous est adressée le même jour par e-mail.
            La date de dépôt horodatée par la plateforme vaut date d&apos;envoi.
          </P>
          <P>
            <B>15.3</B> Vous indiquez à Axion la plateforme agréée que vous avez choisie pour
            recevoir vos factures et vous tenez à jour votre adresse de facturation.
          </P>
        </DocSection>

        <DocSection title="Article 16 — Paiement">
          <P>
            <B>16.1 Date limite.</B> Axion vous paie par virement{" "}
            <B>au plus tard 30 jours après la dernière journée réalisée</B> de la mission, une fois
            les feuilles de présence contresignées (article 12) et, pour le dernier mois de la
            mission, le bilan de fin de formation remis (article 20.2) ; s&apos;ils sont remis plus
            tard, le délai court à partir de leur remise. La lettre de mission indique la date
            limite qui vaut quand ces pièces sont remises à temps. Ni la validation d&apos;un
            relevé, ni le paiement du client ne la déplacent.
          </P>
          <P>
            <B>16.2</B> Vous êtes payé que le client ait payé Axion ou non.
          </P>
          <P>
            <B>16.3 Formation sur plusieurs mois.</B> Pour une formation dont les journées
            s&apos;étalent sur plusieurs mois, Axion vous paie chaque mois les journées réalisées
            dans ce mois, au plus tard 30 jours après la dernière journée réalisée du mois, dans les
            conditions de l&apos;article 16.1. Seul le dernier mois attend le bilan de fin de
            formation.
          </P>
          <P>
            <B>16.4 Jour non ouvré.</B> Si la date limite tombe un samedi, un dimanche ou un jour
            férié, le virement part au plus tard le jour ouvré qui précède.
          </P>
          <P>
            <B>16.5 Contestation.</B> Une contestation porte sur une ligne précise. Elle ne retarde
            pas le paiement de la part non contestée. Si elle est reconnue fondée, Axion émet un
            avoir et une nouvelle autofacture, payée au plus tard à la date limite d&apos;origine
            ou, si elle est dépassée, dans les 8 jours.
          </P>
          <P>
            <B>16.6 Retard.</B> Tout retard de paiement au-delà de la date limite fait courir de
            plein droit, sans mise en demeure, des pénalités au taux de la Banque centrale
            européenne majoré de 10 points, ainsi qu&apos;une indemnité forfaitaire pour frais de
            recouvrement de 40 € (articles L441-10 et D441-5 du code de commerce). Aucun escompte
            n&apos;est accordé pour un paiement anticipé.
          </P>
          <P>
            <B>16.7 Attestation URSSAF.</B> À partir du seuil de l&apos;article 18.2, si votre
            attestation URSSAF n&apos;est pas à jour à la date du virement, le virement attend le
            dépôt d&apos;une attestation à jour. L&apos;autofacture est émise normalement.
          </P>
          <P>
            <B>16.8 Somme versée en trop.</B> Si Axion vous a versé une somme qui ne vous était pas
            due, elle vous adresse un avoir et vous en informe. Avec votre accord écrit, la somme
            est déduite de votre prochain relevé. À défaut, vous la remboursez dans les 30 jours de
            la demande.
          </P>
          <P>
            <B>16.9 Déclaration annuelle.</B> Axion déclare à l&apos;administration fiscale les
            honoraires qu&apos;elle vous verse, dans les conditions de l&apos;article 240 du code
            général des impôts.
          </P>
        </DocSection>

        <DocSection title="Article 17 — Coordonnées bancaires">
          <P>
            <B>17.1</B> Les virements sont faits sur le compte{" "}
            {org ? "au nom de l'organisme" : "à votre nom"} déclaré dans votre dossier.
          </P>
          <P>
            <B>17.2</B> Vous pouvez changer de compte depuis votre espace. Axion en informe votre
            adresse électronique déjà connue. Aucun virement ne part vers le nouveau compte avant un
            délai de 48 heures après votre demande et la confirmation du changement par Axion. Tant
            que ce changement n&apos;est pas confirmé, les virements continuent vers l&apos;ancien
            compte.
          </P>
        </DocSection>

        <DocSection title="Article 18 — Pièces à fournir et à tenir à jour">
          <P>
            <B>18.1</B> Les pièces nécessaires pour vous confier une mission, le moment où elles
            sont demandées et leur durée de validité figurent à l&apos;annexe 2.
          </P>
          <P>
            <B>18.2 Attestation URSSAF.</B> Vous nous transmettez une attestation de vigilance
            URSSAF dès que le cumul de vos honoraires avec nous approche 5 000 € hors taxes, puis
            tous les six mois. À partir de ce seuil, le règlement de vos honoraires attend cette
            attestation. Elle vous est aussi demandée avant une mission qui ferait dépasser ce
            seuil. Axion vérifie l&apos;authenticité de chaque attestation auprès de l&apos;URSSAF,
            avec son code de sécurité, et garde la trace de cette vérification. Axion vous prévient
            avant la fin de validité de votre attestation. À partir du seuil, tant qu&apos;une
            attestation à jour manque :
          </P>
          <BulletList
            items={[
              "aucune nouvelle mission ne vous est proposée ;",
              "les virements attendent le dépôt d'une attestation à jour (article 16.7) ;",
              "les autofactures sont émises normalement, et les missions déjà acceptées sont maintenues.",
            ]}
          />
          {org ? (
            <P>
              <B>18.3</B> Vous déposez aussi un extrait K ou K bis de moins de 3 mois, ou le
              document équivalent, et, si vous employez des travailleurs étrangers soumis à
              autorisation de travail, la liste nominative prévue à l&apos;article D8254-2 du code
              du travail. Ces pièces sont renouvelées tous les 6 mois.
            </P>
          ) : null}
          <P>
            <B>18.4 Entreprise active.</B> Axion consulte le registre public des entreprises à la
            signature, puis régulièrement. Vous informez Axion de toute cessation, radiation, mise
            en sommeil ou procédure collective qui concerne votre entreprise.
          </P>
          <P>
            <B>18.5 CV.</B> Vous déposez un CV de moins de 24 mois
            {org ? " pour chaque intervenant désigné" : ""}, que vous mettez à jour au moins tous
            les 24 mois.
          </P>
          <P>
            <B>18.6 Assurance.</B> À la signature, vous déclarez soit que vous détenez une assurance
            de responsabilité civile professionnelle couvrant votre activité de formation, soit que
            vous n&apos;en détenez pas. Axion vous la conseille. Elle n&apos;est pas une condition
            de ce contrat ni des missions.
          </P>
        </DocSection>

        <DocSection title="Article 19 — Numéro de déclaration d'activité">
          <P>
            <B>19.1</B> Le numéro de déclaration d&apos;activité est celui que la préfecture de
            région attribue à un prestataire de formation (articles L6351-1 et suivants du code du
            travail). Ce n&apos;est pas un accord de confidentialité.
          </P>
          <P>
            <B>19.2</B> Vous pouvez signer ce contrat sans numéro de déclaration d&apos;activité.
            Dans ce cas, vous déclarez dans votre dossier que vous déposez votre déclaration auprès
            de la préfecture de région, ce contrat pouvant servir de pièce à votre déclaration.
          </P>
          <P>
            <B>19.3</B> Axion ne vous propose aucune mission tant que votre numéro ne lui a pas été
            communiqué et n&apos;a pas été vérifié sur la liste publique des organismes de
            formation, ou à défaut sur le document de l&apos;administration qui vous
            l&apos;attribue.
          </P>
          <P>
            <B>19.4</B> Si vous n&apos;avez pas communiqué votre numéro dans les <B>3 mois</B> qui
            suivent la prise d&apos;effet du contrat, chaque partie peut mettre fin au contrat sans
            préavis, par e-mail. Ce délai est prolongé une fois de 3 mois si vous justifiez avoir
            déposé votre déclaration et attendre la réponse de l&apos;administration.
          </P>
          <P>
            <B>19.5</B> Vous informez Axion sans attendre si votre numéro devient caduc, notamment
            faute de bilan pédagogique et financier annuel, ou s&apos;il est annulé.
          </P>
        </DocSection>

        <DocSection title="Article 20 — Engagements qualité">
          <P>
            <B>20.1</B> Axion est l&apos;organisme qui organise la formation et qui en répond devant
            le client. Aucune certification Qualiopi ne vous est demandée. Vous concourez, pour les
            missions que vous acceptez, au respect des engagements qualité qu&apos;Axion a pris
            envers ses clients.
          </P>
          <P>
            <B>20.2</B> Pour chaque mission, vous :
          </P>
          <BulletList
            items={[
              "animez la formation conformément au programme et aux compétences visées ;",
              "tenez compte des adaptations qu'Axion vous signale pour une personne en situation de handicap, avec les moyens que vous jugez adaptés ;",
              "faites signer les feuilles de présence par demi-journée (article 12) ;",
              "après la dernière journée, faites depuis votre espace le bilan de fin de formation : l'évaluation finale des acquis de chaque stagiaire présent et votre avis sur la session ;",
              "remettez aux stagiaires les évaluations qu'Axion vous transmet, au début et à la fin de la formation, dans l'outil d'Axion ou sur papier, et les remettez à Axion ;",
              "transmettez à Axion, dès que vous en avez connaissance, toute réclamation ou difficulté exprimée par un stagiaire ou par le client, pour qu'Axion la traite.",
            ]}
          />
          <P>
            <B>20.3</B> Une fois par an, vous transmettez à Axion un élément de votre choix qui
            montre que vous tenez vos compétences à jour (formation suivie, veille, intervention,
            publication, certification, pratique professionnelle). Le choix du moyen vous
            appartient. Aucune formation particulière ne vous est demandée.
          </P>
          <P>
            <B>20.4</B> Vous permettez à Axion de présenter ces pièces à son organisme certificateur
            et aux autorités de contrôle.
          </P>
        </DocSection>

        <DocSection title="Article 21 — Présentation de la méthode Axion">
          <P>
            <B>21.1</B> Après la prise d&apos;effet du contrat, Axion peut vous proposer une
            présentation de sa méthode et de ses supports. Elle est <B>facultative</B>.
            L&apos;accepter ou la refuser ne change rien aux missions qui vous sont proposées.
          </P>
          <P>
            <B>21.2</B> Si vous la suivez, elle vous est payée une fois, une demi-journée, soit{" "}
            <B>175 € HT</B>, par autofacture, au plus tard 30 jours après la présentation.
          </P>
          <P>
            <B>21.3</B> Ce que vous apprenez lors de cette présentation est couvert par
            l&apos;article 22.
          </P>
        </DocSection>

        <DocSection title="Article 22 — Confidentialité">
          <P>
            <B>22.1</B> Cet article s&apos;applique dès votre signature, avant même la
            contresignature d&apos;Axion et donc avant toute présentation de la méthode.
          </P>
          <P>
            <B>22.2</B> Sont confidentiels : la méthode, les supports, les programmes non publiés,
            les outils et les prix d&apos;Axion ; les informations relatives à ses clients ; les
            informations relatives aux stagiaires ; et toute information reçue à l&apos;occasion
            d&apos;une mission et présentée comme confidentielle.
          </P>
          <P>
            <B>22.3</B> Vous ne les communiquez à personne et ne les utilisez que pour les missions.
            {org
              ? " Vous les communiquez à vos seuls intervenants désignés qui en ont besoin, et vous les engagez à la même confidentialité."
              : ""}
          </P>
          <P>
            <B>22.4</B> Ne sont pas confidentielles les informations publiques, celles que vous
            connaissiez déjà, celles qu&apos;un tiers vous a transmises sans manquer à un
            engagement, et celles qu&apos;une loi ou une autorité vous oblige à communiquer.
          </P>
          <P>
            <B>22.5</B> Cet engagement dure pendant le contrat et <B>5 ans</B> après sa fin. À la
            fin du contrat, vous rendez ou détruisez les documents confidentiels d&apos;Axion, sauf
            ceux qu&apos;une loi vous impose de garder.
          </P>
        </DocSection>
      </Feuillet>
      <Feuillet data={data} identite={identite}>
        <DocSection title="Article 23 — Propriété intellectuelle">
          <P>
            <B>23.1 Vos supports restent les vôtres.</B> Vous restez titulaire de tous vos droits
            sur les supports, exercices et contenus que vous créez ou apportez, qu&apos;ils existent
            avant la mission ou qu&apos;ils soient créés pour elle.
          </P>
          <P>
            <B>23.2 Ce que vous autorisez.</B> Pour chaque mission, vous autorisez gratuitement
            Axion, sans exclusivité :
          </P>
          <BulletList
            items={[
              "à remettre ces supports, sur papier ou en format numérique, aux stagiaires de la formation concernée, pour leur usage personnel ;",
              "à les conserver comme preuves de la formation, et à les présenter à son organisme certificateur, au client, au financeur et aux autorités de contrôle ;",
              "pour la seule durée de conservation des preuves de la formation, et au plus 6 ans après sa fin.",
            ]}
          />
          <P>
            Toute autre utilisation par Axion (réutilisation dans une autre formation, publication,
            modification) suppose votre accord écrit distinct.
          </P>
          <P>
            <B>23.3 Les supports d&apos;Axion.</B> Les supports, la méthode et les outils
            qu&apos;Axion vous transmet restent sa propriété. Vous les utilisez pour les seules
            missions qu&apos;Axion vous confie, sans les reproduire ni les modifier pour un autre
            usage. Aucune cession n&apos;est consentie par ce contrat, dans un sens comme dans
            l&apos;autre.
          </P>
        </DocSection>

        <DocSection title="Article 24 — Données personnelles">
          <P>
            <B>24.1 Rôles.</B> Pour les missions, vous traitez des données personnelles pour le
            compte d&apos;Axion, au sens de l&apos;article 28 du règlement (UE) 2016/679 (RGPD).
            Lorsqu&apos;Axion traite elle-même ces données pour le compte d&apos;un client, vous
            intervenez comme sous-traitant ultérieur, avec les mêmes engagements.
          </P>
          <P>
            <B>24.2 Ce qui est traité.</B>
          </P>
          <BulletList
            items={[
              "Objet et finalité : l'animation des formations confiées et la constitution de leurs preuves (présence, évaluations, réclamations).",
              "Durée : celle de la mission, augmentée du temps nécessaire pour remettre les pièces à Axion.",
              "Nature : consultation, collecte, transmission à Axion.",
              "Données : nom, prénom, entreprise, fonction, adresse électronique professionnelle, signatures de présence, réponses aux évaluations, et les seuls besoins d'adaptation qu'Axion vous communique.",
              "Personnes concernées : les stagiaires et les interlocuteurs du client.",
            ]}
          />
          <P>
            <B>24.3 Vos engagements.</B> Vous :
          </P>
          <BulletList
            items={[
              "traitez ces données sur les seules instructions écrites d'Axion, et l'avertissez si une instruction vous semble contraire à la réglementation ;",
              `veillez à ce que toute personne qui y accède${org ? " y compris vos intervenants désignés" : ""} soit tenue à la confidentialité ;`,
              "prenez des mesures de sécurité adaptées : appareils protégés par un mot de passe et verrouillés, pas d'ordinateur partagé, aucune copie sur un support non chiffré, aucun envoi à une adresse personnelle d'un tiers ;",
              "ne saisissez aucune donnée de stagiaire (nom, travaux, réponses, images, voix) dans un outil d'intelligence artificielle ou un service en ligne qu'Axion n'a pas validé par écrit ; la liste des outils validés figure dans votre espace ;",
              "ne réalisez aucune photo, vidéo ou enregistrement sonore des stagiaires ou des personnels du client, hors du cadre de l'article 25 et de l'annexe 4 ;",
              "ne faites appel à aucun autre sous-traitant pour ces données sans l'autorisation écrite d'Axion, et ne les transférez pas hors de l'Union européenne ;",
              "transmettez à Axion, dès réception et sans y répondre vous-même, toute demande d'une personne qui exerce ses droits (accès, rectification, effacement, opposition) ;",
              "aidez Axion, à sa demande, à assurer la sécurité des données et, le cas échéant, à réaliser une analyse d'impact ;",
              "informez Axion de toute violation de données (perte, vol, accès non autorisé, envoi par erreur) dans les plus brefs délais, et au plus tard 24 heures après en avoir eu connaissance ;",
              "au plus tard 30 jours après la dernière journée de la mission, remettez à Axion les pièces papier et effacez toutes les données des stagiaires de vos appareils et comptes, copies et photos de feuilles comprises, et le confirmez à Axion si elle le demande ;",
              "fournissez à Axion les informations utiles pour démontrer le respect de cet article et permettez les vérifications qu'elle mène, après un préavis raisonnable.",
            ]}
          />
          <P>
            <B>24.4 Vos propres données.</B> Axion traite vos données (identité, entreprise, pièces,
            missions, honoraires) pour gérer ce contrat, choisir l&apos;intervenant d&apos;une
            formation et respecter ses obligations légales et de certification. Elle tient pour son
            seul usage interne un historique des missions réalisées et des avis recueillis sur les
            formations, qui l&apos;aide à proposer les missions ; ces informations ne sont ni
            publiées ni communiquées à d&apos;autres formateurs, et le choix de l&apos;intervenant
            reste fait par une personne. Vos droits et les durées de conservation sont décrits dans
            la politique de confidentialité d&apos;Axion, à la section consacrée aux formateurs
            indépendants.
          </P>
        </DocSection>

        <DocSection title="Article 25 — Prises de vue et interviews filmées">
          <P>
            <B>25.1</B> Vous ne réalisez aucune photo, vidéo ni enregistrement sonore des stagiaires
            ou des personnels du client, sauf dans le cadre d&apos;une interview filmée organisée
            selon l&apos;annexe 4.
          </P>
          <P>
            <B>25.2</B> Les interviews filmées sont <B>facultatives</B> et ne sont pas payées. Vous
            êtes libre de ne jamais en réaliser. Un refus n&apos;a aucune conséquence.
          </P>
          <P>
            <B>25.3</B> Aucune interview n&apos;a lieu sans, <B>avant</B> toute prise de vue : une
            demande écrite d&apos;Axion pour la formation concernée, l&apos;accord écrit du client,
            et l&apos;autorisation de chaque personne filmée, recueillie par Axion par voie
            électronique. Tant qu&apos;Axion ne vous a pas confirmé par écrit qu&apos;elle est en
            mesure de recueillir ces autorisations, aucune interview n&apos;a lieu.
          </P>
          <P>
            <B>25.4</B> Les vidéos sont destinées à Axion, dans les conditions de l&apos;annexe 4.
          </P>
          <P>
            <B>25.5</B> Votre propre image et votre propre voix ne sont utilisées par Axion
            qu&apos;avec une autorisation séparée de ce contrat, facultative et que vous pouvez
            retirer à tout moment pour l&apos;avenir.
          </P>
        </DocSection>

        <DocSection title="Article 26 — Non-sollicitation">
          <P>
            <B>26.1</B> Pendant le contrat et pendant <B>12 mois</B> après votre dernière mission,
            vous ne démarchez pas, de votre propre initiative, pour des prestations de formation de
            même nature, les clients qu&apos;Axion vous a présentés à l&apos;occasion d&apos;une
            mission.
          </P>
          <P>
            <B>26.2</B> Cet article ne vise que votre démarche active. Un client qui vient vers vous
            de lui-même, sans sollicitation de votre part, reste libre de travailler avec vous. Ce
            n&apos;est pas une interdiction de concurrence : vous restez libre d&apos;exercer votre
            activité auprès de tout autre client.
          </P>
          <P>
            <B>26.3</B> En cas de manquement, Axion peut demander réparation du préjudice
            qu&apos;elle prouve.
          </P>
        </DocSection>

        <DocSection title="Article 27 — Si vous êtes aussi apporteur d'affaires d'Axion">
          <P>
            Si vous êtes aussi apporteur d&apos;affaires d&apos;Axion, aucune commission
            d&apos;apporteur n&apos;est due sur une formation que vous animez vous-même. Vos
            honoraires de formateur pour cette formation restent dus.
          </P>
        </DocSection>

        <DocSection title="Article 28 — Vos autres activités et vos déclarations">
          <P>
            <B>28.1</B> Si vous exercez par ailleurs un emploi, une fonction publique ou un autre
            mandat, vous déclarez que votre activité de formateur indépendant est compatible avec
            vos engagements envers votre employeur ou votre administration. Vous en restez seul
            responsable.
          </P>
          <P>
            <B>28.2</B> À la signature, vous déclarez :
          </P>
          <BulletList
            items={[
              "exercer en indépendant, être immatriculé et à jour de vos déclarations sociales et fiscales ;",
              "que les informations et les pièces de votre dossier sont exactes ;",
              "votre régime de TVA (article 14) ;",
              "détenir, ou ne pas détenir, une assurance de responsabilité civile professionnelle (article 18.6) ;",
              "disposer d'un numéro de déclaration d'activité, ou déposer votre déclaration (article 19).",
            ]}
          />
          <P>
            <B>28.3</B> Vous informez Axion de tout changement de ces informations.
          </P>
        </DocSection>

        <DocSection title="Article 29 — Responsabilité et force majeure">
          <P>
            <B>29.1</B> Chaque partie répond des dommages directs causés à l&apos;autre par un
            manquement à ce contrat. Le désistement prévu à l&apos;article 7.4 n&apos;est pas un
            manquement.
          </P>
          <P>
            <B>29.2</B> La responsabilité de chaque partie est limitée, pour chaque mission, au
            montant hors taxes des honoraires de cette mission. Cette limite ne s&apos;applique pas
            aux sommes dues au titre des articles 9 à 11 et 16, ni en cas de faute lourde ou
            intentionnelle, ni en cas d&apos;atteinte aux personnes. Aucune partie ne répond des
            dommages indirects, comme une perte de chiffre d&apos;affaires ou de clientèle.
          </P>
          <P>
            <B>29.3</B> Aucune partie n&apos;est responsable d&apos;un manquement dû à un cas de
            force majeure au sens de l&apos;article 1218 du code civil. La partie empêchée prévient
            l&apos;autre sans attendre.
          </P>
        </DocSection>

        <DocSection title="Article 30 — Durée, préavis et fin du contrat">
          <P>
            <B>30.1</B> Le contrat est conclu pour une durée indéterminée.
          </P>
          <P>
            <B>30.2</B> Chaque partie peut y mettre fin à tout moment, sans avoir à se justifier,
            par e-mail ou depuis votre espace, avec un préavis de :
          </P>
          <BulletList
            items={[
              "30 jours si la durée de la relation est inférieure à un an à la date de l'envoi ;",
              "60 jours si elle est comprise entre un et deux ans ;",
              "90 jours si elle dépasse deux ans.",
            ]}
          />
          <P>Pendant le préavis, vous restez libre de refuser toute nouvelle proposition.</P>
          <P>
            <B>30.3</B> Les missions déjà acceptées à la date de l&apos;envoi sont menées à terme et
            payées selon ce contrat, même si leurs dates tombent après la date de fin, sauf accord
            contraire des deux parties.
          </P>
          <P>
            <B>30.4 Fin sans préavis.</B> Axion peut mettre fin au contrat sans préavis, par une
            lettre de fin adressée par e-mail :
          </P>
          <BulletList
            items={[
              "si votre entreprise est cessée ou radiée au registre public ;",
              "si votre numéro de déclaration d'activité est caduc ou annulé, ou n'a pas été communiqué dans le délai de l'article 19.4 ;",
              "en cas de manquement grave à l'article 22 (confidentialité) ou 24 (données personnelles), de pièce falsifiée, ou de comportement portant atteinte à la sécurité ou à la dignité d'un stagiaire.",
            ]}
          />
          <P>
            Dans le dernier cas, sauf si le manquement ne peut pas être réparé, Axion vous adresse
            d&apos;abord une mise en demeure par e-mail, restée sans effet pendant 8 jours.
          </P>
          <P>
            <B>30.5</B> En cas de fin sans préavis, les journées déjà réalisées sont payées selon ce
            contrat. Les missions qui n&apos;ont pas commencé sont retirées, sans l&apos;indemnité
            de l&apos;article 11.1.
          </P>
          <P>
            <B>30.6</B> Vous pouvez de la même façon mettre fin au contrat sans préavis en cas de
            manquement grave d&apos;Axion, notamment un défaut de paiement à la date limite resté
            sans effet 8 jours après une mise en demeure par e-mail.
          </P>
        </DocSection>

        <DocSection title="Article 31 — Ce qui continue après la fin du contrat">
          <P>
            Continuent de s&apos;appliquer après la fin du contrat, pour la durée qui leur est
            propre : le paiement des missions réalisées ou maintenues (articles 16 et 30) ; le
            mandat d&apos;autofacturation pour toutes les missions réalisées avant la fin, ou
            maintenues après elle (annexe 3) ; la confidentialité (article 22) ; l&apos;autorisation
            de l&apos;article 23.2 ; les données personnelles (article 24) ; l&apos;annexe 4 pour
            les vidéos déjà réalisées ; la non-sollicitation (article 26) ; la responsabilité
            (article 29) ; les articles 34 et 35.
          </P>
        </DocSection>

        <DocSection title="Article 32 — Nouvelles versions du contrat">
          <P>
            <B>32.1</B> Chaque version du contrat porte un numéro et une date. La version que vous
            signez est conservée telle quelle.
          </P>
          <P>
            <B>32.2</B> Une nouvelle version qui ne fait que vous être plus favorable (par exemple
            une hausse des honoraires ou une réduction d&apos;un engagement) s&apos;applique sans
            nouvelle signature. Axion vous en informe par e-mail et la met dans votre espace.
          </P>
          <P>
            <B>32.3</B> Une nouvelle version qui vous ajoute un engagement ne s&apos;applique
            qu&apos;après votre signature. Si vous ne la signez pas, la version que vous avez signée
            continue de s&apos;appliquer.
          </P>
          <P>
            <B>32.4</B> Une mission reste régie par la version en vigueur à la date de son
            acceptation.
          </P>
          <P>
            <B>32.5</B> Ce contrat remplace, pour l&apos;avenir, tout contrat ou lettre-cadre
            antérieur entre les parties ayant le même objet. Les missions acceptées sous
            l&apos;ancien texte restent régies par lui.
          </P>
        </DocSection>

        <DocSection title="Article 33 — Signature, preuve et prise d'effet">
          <P>
            <B>33.1</B> Vous signez ce contrat en ligne, dans votre dossier : vous lisez le texte
            intégral et ses annexes, vous cochez les déclarations de l&apos;article 28.2, vous tapez
            votre nom et vous saisissez le code à usage unique reçu à votre adresse électronique.
            C&apos;est une signature électronique au sens des articles 1366 et 1367 du code civil.
          </P>
          <P>
            <B>33.2</B> Axion conserve la preuve de votre signature : texte exact signé et son
            empreinte numérique, date et heure, utilisation du code, informations techniques de
            connexion. Une copie du contrat signé, avec son certificat de signature, vous est
            adressée aussitôt par e-mail et reste disponible dans votre espace.
          </P>
          <P>
            <B>33.3</B> Axion contresigne après avoir vérifié votre dossier. Le contrat prend effet
            à la date de cette contresignature. Si Axion ne contresigne pas, le contrat ne prend pas
            effet, et Axion vous en informe ; l&apos;article 22 continue de s&apos;appliquer aux
            informations déjà reçues.
          </P>
          <P>
            <B>33.4</B> La version signée par les deux parties vous est adressée par e-mail et reste
            disponible dans votre espace.
          </P>
        </DocSection>

        <DocSection title="Article 34 — Communications entre les parties">
          <P>
            Les communications prévues par ce contrat se font par e-mail, aux adresses indiquées à
            l&apos;article 1, ou dans votre espace. Chaque partie informe l&apos;autre de tout
            changement d&apos;adresse. Axion écrit à : {champ(data.axion.adresseFormateurs)}.
          </P>
        </DocSection>

        <DocSection title="Article 35 — Droit applicable et différends">
          <P>
            <B>35.1</B> Ce contrat est régi par le droit français. Le français est la seule langue
            qui fait foi.
          </P>
          <P>
            <B>35.2</B> En cas de différend, les parties cherchent d&apos;abord une solution
            amiable, par écrit, pendant 30 jours à compter de la première demande.
          </P>
          <P>
            <B>35.3</B> À défaut d&apos;accord, le litige est porté devant le tribunal compétent
            selon les règles de droit commun. Si les deux parties ont la qualité de commerçant, il
            est porté devant le tribunal compétent du ressort du siège d&apos;Axion, à{" "}
            {champ(identite.rcsVille)}.
          </P>
        </DocSection>
      </Feuillet>
      <Feuillet data={data} identite={identite}>
        <DocSection title="Annexe 1 — Honoraires, déplacements et annulation (version 2)">
          <DataTable
            columns={[
              { key: "element", header: "Élément", flex: 3 },
              { key: "regle", header: "Montant ou règle", flex: 3 },
            ]}
            rows={[
              {
                element: "Journée de formation (environ 7 h, deux demi-journées)",
                regle: "350 € HT",
              },
              { element: "Demi-journée (matin ou après-midi, feuille signée)", regle: "175 € HT" },
              { element: "Plafond par jour calendaire", regle: "350 € HT, même au-delà de 7 h" },
              { element: "Formation à distance", regle: "même tarif qu'en présentiel" },
              { element: "Déplacement dans votre département ou à distance", regle: "compris" },
              {
                element: "Déplacement hors de votre département",
                regle:
                  "forfait par journée de déplacement, indiqué dans la proposition, plafonné à 150 € HT par journée ; une demi-journée compte comme une journée",
              },
              { element: "Note de frais", regle: "aucune" },
              {
                element: "Annulation par Axion à moins de 72 h",
                regle: "50 % des honoraires des journées et demi-journées annulées, hors forfait",
              },
              { element: "Annulation par Axion à 72 h ou plus", regle: "rien" },
              { element: "Refus du financeur avant votre acceptation", regle: "rien" },
              {
                element: "Refus du financeur après votre acceptation",
                regle: "comme une annulation par Axion",
              },
              { element: "Désistement de votre part", regle: "aucune pénalité" },
              {
                element: "Présentation facultative de la méthode Axion",
                regle: "175 € HT, une fois",
              },
              {
                element: "Date limite de paiement",
                regle:
                  "dernière journée réalisée + 30 jours (par mois pour une formation sur plusieurs mois), une fois les feuilles de présence contresignées et, pour le dernier mois, le bilan de fin de formation remis ; s'ils sont remis plus tard, 30 jours à partir de leur remise (article 16.1)",
              },
            ]}
          />
        </DocSection>

        <DocSection title="Annexe 2 — Pièces à fournir et durée de validité (version 2)">
          <DataTable
            columns={[
              { key: "piece", header: "Pièce", flex: 3 },
              { key: "quand", header: "Quand", flex: 2 },
              { key: "validite", header: "Validité", flex: 2 },
              { key: "manque", header: "Si elle manque ou n'est plus à jour", flex: 3 },
            ]}
            rows={[
              {
                piece: "Inscription de votre entreprise au registre public (consultée par Axion)",
                quand: "à la signature, puis régulièrement",
                validite: "tant que l'entreprise est active",
                manque: "contrat non contresigné ; fin possible (article 30.4)",
              },
              {
                piece: "Attestation de vigilance URSSAF, vérifiée par Axion avec son code",
                quand:
                  "dès que vos honoraires avec Axion approchent 5 000 € HT, et avant une mission qui ferait dépasser ce seuil (article 18.2)",
                validite: "6 mois",
                manque:
                  "à partir du seuil : aucune nouvelle mission ; virement en attente ; autofacture émise normalement",
              },
              {
                piece: "Numéro de déclaration d'activité",
                quand: "avant la première mission, au plus tard 3 mois après la prise d'effet",
                validite: "tant qu'il n'est pas caduc",
                manque: "aucune mission ; fin possible au-delà de 3 mois",
              },
              {
                piece: org ? "CV de chaque intervenant désigné" : "CV",
                quand: "avant la première mission",
                validite: "24 mois",
                manque: "aucune nouvelle mission jusqu'à sa mise à jour",
              },
              {
                piece: "Déclaration de régime de TVA",
                quand: "dans le dossier",
                validite: "jusqu'à un changement, déclaré à l'avance",
                manque: "l'autofacture ne peut pas être émise",
              },
              {
                piece: "Coordonnées bancaires à votre nom",
                quand: "dans le dossier",
                validite: "jusqu'à un changement (article 17)",
                manque: "virement en attente",
              },
              {
                piece: "Déclaration d'assurance de responsabilité civile professionnelle",
                quand: "dans le dossier",
                validite: "annuelle",
                manque: "aucune incidence",
              },
              {
                piece: "Élément d'actualisation de vos compétences, de votre choix",
                quand: "une fois par an",
                validite: "12 mois",
                manque:
                  "Axion vous le redemande ; aucune nouvelle mission tant qu'il manque depuis plus de 3 mois",
              },
              {
                piece: "Plateforme agréée de réception et adresse de facturation",
                quand: "dès que l'obligation s'applique à vous",
                validite: "jusqu'à un changement",
                manque: "autofacture transmise par e-mail en attendant",
              },
              ...(org
                ? [
                    {
                      piece: "Extrait K ou K bis",
                      quand: "dans le dossier",
                      validite: "6 mois",
                      manque: "aucune nouvelle mission ; virement en attente",
                    },
                    {
                      piece:
                        "Liste nominative des travailleurs étrangers soumis à autorisation de travail (si vous en employez)",
                      quand: "dans le dossier",
                      validite: "6 mois",
                      manque: "aucune nouvelle mission ; virement en attente",
                    },
                  ]
                : []),
            ]}
          />
        </DocSection>
      </Feuillet>
      <Feuillet data={data} identite={identite}>
        <DocSection title="Annexe 3 — Mandat d'autofacturation (version 1)">
          <P>Article 289, I-2 du code général des impôts.</P>
          <P>
            <B>A3.1 Le mandat.</B> Vous donnez mandat à Axion, qui l&apos;accepte, d&apos;établir en
            votre nom et pour votre compte les factures des sommes que vous facturez à Axion au
            titre du contrat : honoraires d&apos;animation, forfaits de déplacement, honoraires de
            la présentation de la méthode et, le cas échéant, sommes dues au titre de l&apos;article
            11.1. Ce mandat est donné par écrit, avant l&apos;émission de toute facture.
          </P>
          <P>
            <B>A3.2 Les mentions.</B> Chaque autofacture porte la mention « Autofacturation », un
            numéro unique dans une série propre à Axion, toutes les mentions exigées par le code
            général des impôts (notamment votre identité, votre SIREN et, si vous en avez un, votre
            numéro de TVA intracommunautaire), la catégorie de l&apos;opération (« prestation de
            services »), les dates des journées facturées, et la mention de TVA qui correspond à
            votre régime (article 14).
          </P>
          <P>
            <B>A3.3 Le moment.</B> Axion émet l&apos;autofacture dès que le service est fait,
            c&apos;est-à-dire dès que les feuilles de présence de la mission, ou du mois pour une
            formation sur plusieurs mois, sont signées.
          </P>
          <P>
            <B>A3.4 La transmission.</B> L&apos;autofacture vous est transmise dès son émission,
            avec le relevé correspondant, dans votre espace et par e-mail, ou par la plateforme
            agréée dans les conditions de l&apos;article 15.
          </P>
          <P>
            <B>A3.5 Acceptation ou contestation.</B> Vous disposez de <B>8 jours</B> à compter de la
            transmission pour contester une autofacture, par le bouton prévu dans votre espace ou en
            répondant à l&apos;e-mail. Sans contestation dans ce délai, elle est réputée acceptée.
            Si votre contestation est fondée, Axion émet un avoir et une nouvelle autofacture. Une
            autofacture émise n&apos;est jamais modifiée.
          </P>
          <P>
            <B>A3.6 Vos engagements fiscaux.</B> Vous restez le fournisseur de la prestation. Vous
            restez seul redevable de la TVA mentionnée sur les autofactures émises en votre nom, et
            vous la déclarez. Vous informez Axion sans attendre de tout changement de votre régime
            de TVA, de votre numéro de TVA ou de votre situation (article 14.2).
          </P>
          <P>
            <B>A3.7 Révocation.</B> Vous pouvez révoquer ce mandat à tout moment, depuis votre
            espace ou par e-mail, avec un préavis d&apos;<B>un mois</B>. Axion peut y mettre fin de
            la même façon. Les autofactures émises avant la fin du préavis restent valables. Après
            le préavis, vous établissez vos propres factures et les déposez dans votre espace ; la
            date limite de paiement reste celle de l&apos;article 16.
          </P>
          <P>
            <B>A3.8 Durée.</B> Le mandat a la même durée que le contrat. Après la fin du contrat, il
            continue de s&apos;appliquer aux missions réalisées avant la fin, ou maintenues après
            elle, jusqu&apos;à leur complet règlement.
          </P>
        </DocSection>

        <DocSection title="Annexe 4 — Interviews filmées (version 1)">
          <P>
            <B>A4.1 Facultatives.</B> Les interviews filmées de stagiaires ou de représentants du
            client sont facultatives et non payées. Vous êtes libre de ne jamais en réaliser. Un
            refus n&apos;a aucune conséquence.
          </P>
          <P>
            <B>A4.2 Avant de filmer.</B> Aucune prise de vue n&apos;a lieu sans que soient réunies,{" "}
            <B>avant</B> de filmer : la demande écrite d&apos;Axion pour la formation concernée ;
            l&apos;accord écrit du client ; l&apos;autorisation de chaque personne filmée,
            recueillie par Axion par voie électronique, qu&apos;Axion vous confirme. Tant
            qu&apos;Axion ne vous a pas confirmé par écrit qu&apos;elle peut recueillir ces
            autorisations, aucune interview n&apos;a lieu.
          </P>
          <P>
            <B>A4.3 Après avoir filmé.</B> Vous déposez les fichiers dans l&apos;espace prévu par
            Axion, puis vous les effacez de vos appareils et de vos comptes au plus tard 48 heures
            après la prise de vue. Vous n&apos;en gardez aucune copie.
          </P>
          <P>
            <B>A4.4 Les vidéos sont destinées à Axion.</B> Si vous avez, comme auteur de la prise de
            vue, des droits sur ces vidéos, vous les cédez à Axion, gratuitement, dans les
            conditions suivantes :
          </P>
          <BulletList
            items={[
              "droits cédés : reproduction, représentation, adaptation (montage, sous-titrage, extraits) ;",
              "destination : communication d'Axion sur ses formations, sur son site, ses réseaux sociaux, ses présentations et ses documents commerciaux ;",
              "territoire : le monde entier, compte tenu de la diffusion en ligne ;",
              "durée : 10 ans à compter de la prise de vue.",
            ]}
          />
          <P>
            <B>A4.5 Les personnes filmées.</B> L&apos;utilisation de l&apos;image et de la voix des
            personnes filmées suit l&apos;autorisation que chacune a donnée à Axion. Si une personne
            retire son autorisation, Axion cesse les nouvelles diffusions.
          </P>
          <P>
            <B>A4.6 Votre image.</B> Si vous apparaissez vous-même à l&apos;image ou au son,
            l&apos;article 25.5 s&apos;applique.
          </P>
        </DocSection>

        <>
          <Text style={pdfStyles.legalNote}>
            Signatures : {org ? "représentant de l'organisme" : "formateur"} — signature
            électronique avec code (article 33) ; Axion-IA SAS, représentée par{" "}
            {champ(identite.representantLegalNom)} — contresignature électronique. Certificat de
            signature joint.
          </Text>
          <SignatureZone
            parties={[
              {
                titre: org ? "Pour l'organisme sous-traitant" : "Le formateur indépendant",
                signature: data.signatures?.sous_traitant ?? null,
                nom: org
                  ? `${champ(c.societe?.denomination)}, représentée par ${champ(c.prenomNom)}`
                  : champ(c.prenomNom),
                mention: "Signature électronique avec code (article 33)",
              },
              {
                titre: "Pour Axion-IA SAS",
                signature: data.signatures?.axionia ?? null,
                nom: champ(identite.representantLegalNom),
                mention: "Contresignature électronique",
              },
            ]}
          />
        </>
      </Feuillet>
    </Document>
  );
}
