/**
 * Qualiopi — Template PDF : Convocation à la formation.
 *
 * Mention réglementaire "À conserver". Contient les informations de session
 * (intitulé, dates, horaires heure de Paris, modalité, lieu/visio, formateur,
 * contact), les informations stagiaire, le matériel à prévoir (fiche de la
 * formation, hors distanciel pur), l'équipement requis et l'assistance à
 * distance (distanciel et mixte, art. D.6313-3-1), les documents mis à
 * disposition dans l'espace stagiaire et les mentions handicap/absence.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document } from "@react-pdf/renderer";
import { PageCharte, Carte, LigneChamp, ListePuces } from "../charte/v1";
import { NoteLegale, Paragraphe } from "./charte-documents-formation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  LIBELLE_MODALITE_HYBRIDE_MINUSCULE,
  libelleFinancement,
} from "@/server/qualiopi/documents/libelles-enumerations";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import {
  ASSISTANCE_COUPURE,
  ASSISTANCE_HORS_SESSION,
  ASSISTANCE_PENDANT_SESSION,
} from "@/server/qualiopi/legal/assistance-distance";
import {
  DISTANCIEL_CONNEXION,
  DISTANCIEL_ORDINATEUR,
  DISTANCIEL_VISIO,
} from "@/content/formations/materiel";
import { ENCART_VIOLENCES, TITRE_ENCART_VIOLENCES } from "@/content/prevention-violences";
import { phraseEffectifEtModalite } from "@/server/qualiopi/convocation-v2/decision";

/** Première lettre en majuscule : les éléments du matériel commencent en minuscule. */
function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ============================================================
// Types
// ============================================================

export interface ConvocationData {
  numero: string;
  estCopie?: boolean;
  // Infos session
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  /**
   * Plage(s) horaire(s) NUE(S), sans mention de fuseau — ex. « 09h00–17h00 » ou
   * « 09h00–12h30, 13h30–17h00 ». Le gabarit ajoute lui-même « (heure de
   * Paris) » : une valeur qui porte déjà la mention l'imprimerait en double sur
   * une pièce légale. L'ancien commentaire donnait justement l'exemple inverse.
   */
  horaires: string;
  dureeHeures: number;
  modalite: "présentiel" | "distanciel" | typeof LIBELLE_MODALITE_HYBRIDE_MINUSCULE;
  lieu?: string;
  /**
   * ⚠️ Modalité d'accès en distanciel — attendue par l'indicateur 9 au même
   * titre que l'adresse en présentiel. Le gabarit MASQUE `lieu` dès que la
   * modalité est « distanciel » : sans `lienVisio`, la convocation ne dit alors
   * strictement RIEN de la façon de rejoindre la session.
   *
   * 🔴 Constaté à l'audit blanc 2026-08-15 : le seul appelant
   * (`genererConvocationAction`, src/server/actions/qualiopi/documents.ts) ne
   * renseigne ni `lienVisio` ni `idReunion` ni `contactTelephone`, alors que la
   * session porte bien `lieuVisioUrl` en base. Toute convocation distancielle
   * part donc sans modalité d'accès. Correctif hors périmètre de ce fichier :
   * il se fait au point d'appel, pas ici.
   */
  lienVisio?: string;
  idReunion?: string;
  nomFormateur: string;
  contactEmail: string;
  contactTelephone?: string;
  // Infos stagiaire
  nomStagiaire: string;
  entreprise?: string;
  financement?: string;
  numeroOrdrePriseEnCharge?: string;
  /**
   * Matériel à prévoir sur place — le champ `moyens_techniques` DE LA
   * FORMATION, tel quel. Imprimé hors distanciel pur.
   *
   * 🔴 2026-09-18 — la convocation présentiel ne disait RIEN du matériel : la
   * section « Équipement requis » n'existait qu'en distanciel. Un stagiaire
   * convoqué en salle pouvait venir sans le poste que la formation suppose.
   * Règle GÉNÉRIQUE, décidée par le propriétaire : chaque formation déclare
   * son matériel dans sa fiche (certaines n'en exigent aucun), la convocation
   * le reprend — jamais une liste écrite ici. Absent → rien n'est imprimé :
   * aucun texte inventé sur une pièce remise au stagiaire.
   */
  materielAPrevoir?: string;
  /**
   * Chantier QNC, L05 — version du TEXTE. Absent ou 1 : la convocation actuelle,
   * mot pour mot. 2 : la convocation v2 (`qualiopi.convocation_v2.actif`) —
   * pièces jointes en PDF, émargement signé pendant chaque demi-journée,
   * réclamations, effectif, outil de visioconférence.
   *
   * La convocation n'est pas une pièce SIGNABLE : elle n'entre donc pas dans
   * `GABARIT_VERSIONS` (y entrer la ferait naître « en attente de signature »).
   * La version vit ici, et la pièce la porte dans `metadata.convocationV2`.
   */
  versionTexte?: 1 | 2;
  /** v2 : la session est un séminaire (effectif « jusqu'à 50 », présentiel seul). */
  seminaire?: boolean;
  /** v2, distanciel : l'outil nommé (« Zoom »). Jamais le lien lui-même (ADR 0048 §4.1). */
  outilVisio?: string;
  /**
   * v2, distanciel : ce que la pièce dit du lien. « Lien envoyé avant la
   * formation » quand le champ est vide ; sinon le lien arrive par le courriel.
   */
  mentionLienVisio?: string;
}

// ============================================================
// Composant
// ============================================================

export function ConvocationPdf({
  data,
  identite,
}: {
  data: ConvocationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const isDistanciel =
    data.modalite === "distanciel" || data.modalite === LIBELLE_MODALITE_HYBRIDE_MINUSCULE;
  const v2 = data.versionTexte === 2;
  const siteBase = identite.site.replace(/\/+$/, "");

  return (
    <Document>
      <PageCharte
        docTitle="Convocation à la formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention "À conserver" */}
        <Carte>
          <Paragraphe gras>
            Document à conserver — merci de le présenter le jour de la formation.
          </Paragraphe>
        </Carte>

        {/* Section 1 : Informations session */}
        <Carte titre="Informations sur la session">
          <LigneChamp label="Formation" value={data.intituleFormation} />
          <LigneChamp label="Date de début" value={data.dateDebut} />
          <LigneChamp label="Date de fin" value={data.dateFin} />
          <LigneChamp label="Horaires" value={`${data.horaires} (heure de Paris)`} />
          <LigneChamp
            label="Durée totale"
            value={`${data.dureeHeures} heure${data.dureeHeures > 1 ? "s" : ""}`}
          />
          <LigneChamp label="Modalité" value={data.modalite} />
          {data.modalite !== "distanciel" && data.lieu ? (
            <LigneChamp label="Lieu" value={data.lieu} />
          ) : null}
          {isDistanciel && data.lienVisio ? (
            <LigneChamp label="Lien visioconférence" value={data.lienVisio} />
          ) : null}
          {v2 && isDistanciel && data.outilVisio ? (
            <LigneChamp label="Outil de visioconférence" value={data.outilVisio} />
          ) : null}
          {v2 && isDistanciel && data.mentionLienVisio ? (
            <LigneChamp label="Lien de connexion" value={data.mentionLienVisio} />
          ) : null}
          {isDistanciel && data.idReunion ? (
            <LigneChamp label="ID de réunion" value={data.idReunion} />
          ) : null}
          <LigneChamp label="Formateur / Formatrice" value={data.nomFormateur} />
          <LigneChamp label="Contact" value={data.contactEmail} />
          {data.contactTelephone ? (
            <LigneChamp label="Téléphone contact" value={data.contactTelephone} />
          ) : null}
        </Carte>

        {/* Section 2 : Vos informations */}
        <Carte titre="Vos informations">
          <LigneChamp label="Nom et prénom" value={data.nomStagiaire} />
          {data.entreprise ? (
            <LigneChamp label="Entreprise / Structure" value={data.entreprise} />
          ) : null}
          {/* Libellé, jamais l'énumération brute (« france_travail ») — cf.
              `libelles-enumerations.ts` (audit des pièces réelles 2026-09-30). */}
          {data.financement ? (
            <LigneChamp label="Financement" value={libelleFinancement(data.financement)} />
          ) : null}
          {data.numeroOrdrePriseEnCharge ? (
            <LigneChamp label="N° prise en charge OPCO" value={data.numeroOrdrePriseEnCharge} />
          ) : null}
        </Carte>

        {/* Section 3a : Matériel à prévoir sur place — la fiche de la formation */}
        {data.modalite !== "distanciel" && data.materielAPrevoir ? (
          <Carte titre="Matériel à prévoir sur place">
            <Paragraphe>{data.materielAPrevoir}</Paragraphe>
          </Carte>
        ) : null}

        {/* Section 3b : Équipement requis (distanciel et mixte) — les éléments
            viennent de `content/formations/materiel.ts`, ceux que publient les
            fiches : la convocation exige ce que le site annonce. */}
        {isDistanciel ? (
          <Carte titre="Équipement requis (distanciel)">
            <Paragraphe>
              Pour participer dans de bonnes conditions, veuillez disposer de :
            </Paragraphe>
            <ListePuces
              items={[
                `${majuscule(DISTANCIEL_ORDINATEUR)} fonctionnels.`,
                `${majuscule(DISTANCIEL_CONNEXION)} (≥ 5 Mbit/s recommandé).`,
                `${DISTANCIEL_VISIO} : caméra, micro, son.`,
                "Un espace calme et éclairé.",
              ]}
            />
          </Carte>
        ) : null}

        {/* Section 3c : Assistance à distance (distanciel et mixte) — D.6313-3-1.
            Même texte que le livret d'accueil : `legal/assistance-distance.ts`. */}
        {isDistanciel ? (
          <Carte titre="Assistance à distance">
            <ListePuces items={[ASSISTANCE_PENDANT_SESSION, ASSISTANCE_HORS_SESSION]} />
            <Paragraphe gras>Si la visioconférence tombe</Paragraphe>
            <ListePuces items={[...ASSISTANCE_COUPURE]} />
          </Carte>
        ) : null}

        {/* Section 4 : Documents mis à disposition */}
        {/*
          🔴 Audit blanc 2026-08-15. Cette section s'intitulait « Documents joints
          à cette convocation » et affirmait « Les documents suivants vous sont
          transmis avec cette convocation ». Or l'e-mail de convocation
          (`envoyerConvocation`, notifications-service.ts) n'attache AUCUN
          fichier : il porte un lien personnel vers l'espace stagiaire, lequel
          délivre effectivement ces quatre éléments. La pièce attestait donc une
          transmission qui n'avait pas lieu sous la forme annoncée — et
          l'auditeur qui confronte la convocation au journal d'envoi relève la
          contradiction sans même ouvrir le portail.

          La formule décrit désormais ce qui se passe réellement. NE PAS la
          re-durcir en « joints » sans avoir d'abord attaché les pièces à
          l'e-mail : c'est la phrase qui suit le code, jamais l'inverse.
          Indicateur 9 (information sur les conditions de déroulement).
        */}
        {v2 ? (
          <Carte titre="Documents joints à cette convocation">
            <Paragraphe>
              Les documents suivants sont joints en PDF au courriel qui accompagne cette
              convocation. Ils restent disponibles dans votre espace stagiaire, par le lien
              personnel du même courriel :
            </Paragraphe>
            <ListePuces
              items={[
                "Convocation",
                "Programme de formation détaillé",
                "Règlement intérieur des stagiaires",
                "Livret d'accueil stagiaire",
              ]}
            />
            <Paragraphe>
              Le questionnaire de positionnement (à remplir avant la formation) se trouve dans votre
              espace stagiaire. Si une pièce jointe ne s'ouvre pas, signalez-le au contact indiqué
              ci-dessus : elle vous sera adressée par un autre moyen.
            </Paragraphe>
          </Carte>
        ) : (
          <Carte titre="Documents mis à votre disposition">
            <Paragraphe>
              Les documents suivants sont mis à votre disposition dans votre espace stagiaire,
              accessible par le lien personnel qui vous est adressé par courriel avec cette
              convocation :
            </Paragraphe>
            <ListePuces
              items={[
                "Programme de formation détaillé",
                "Règlement intérieur des stagiaires",
                "Livret d'accueil stagiaire",
                "Questionnaire de positionnement (à remplir avant la formation)",
              ]}
            />
            <Paragraphe>
              Si vous ne parvenez pas à accéder à votre espace stagiaire, signalez-le au contact
              indiqué ci-dessus : ces documents vous seront adressés par un autre moyen.
            </Paragraphe>
          </Carte>
        )}

        {v2 ? (
          <Carte titre="Déroulement de la formation">
            <ListePuces
              items={[
                phraseEffectifEtModalite(data.seminaire),
                "Émargement : vous signez votre présence pendant chaque demi-journée, en salle comme en visioconférence, avec le lien personnel de signature qui vous est adressé par courriel.",
                siteBase
                  ? `Une difficulté, une réclamation ? Vous pouvez la déposer à tout moment : ${siteBase}/reclamations`
                  : "Une difficulté, une réclamation ? Vous pouvez la déposer à tout moment : la procédure est publiée sur notre site, rubrique « Réclamations ».",
              ]}
            />
          </Carte>
        ) : null}

        {/* Section 5 : Situation handicap */}
        <Carte titre="Situation de handicap — référent dédié">
          <Paragraphe>
            Si vous êtes en situation de handicap et nécessitez un aménagement, contactez notre
            référent handicap au plus tôt avant la session :
          </Paragraphe>
          {/*
            Nom d'abord, puis les deux canaux. L'ancienne version n'affichait que
            l'email — et c'est le contact GÉNÉRAL de l'OF : le stagiaire lisait
            « Référent handicap : contact@axion-ia.com », une adresse générique
            qui n'identifie personne. L'indicateur 26 demande un référent
            IDENTIFIÉ et joignable.
            Le nom et le téléphone étaient en configuration depuis toujours.
          */}
          {identite.referentHandicapNom ? (
            <LigneChamp label="Référent handicap" value={identite.referentHandicapNom} />
          ) : null}
          {identite.referentHandicapEmail ? (
            <LigneChamp label="Email" value={identite.referentHandicapEmail} />
          ) : null}
          {identite.referentHandicapTelephone ? (
            <LigneChamp label="Téléphone" value={identite.referentHandicapTelephone} />
          ) : null}
          <NoteLegale>{LEGAL_MENTIONS.referentHandicap}</NoteLegale>
        </Carte>

        {/* Prévention des violences (indicateur 12, décret n° 2026-728) —
            même texte que le livret d'accueil (`src/content/prevention-violences.ts`).
            La convocation est la pièce que le stagiaire lit à coup sûr AVANT
            d'entrer : elle lui dit à qui signaler, sans détour par le règlement. */}
        <Carte titre={TITRE_ENCART_VIOLENCES}>
          {ENCART_VIOLENCES.map((paragraphe) => (
            <Paragraphe key={paragraphe.slice(0, 12)}>{paragraphe}</Paragraphe>
          ))}
        </Carte>

        {/* Section 6 : Absence / retard */}
        <Carte titre="Absence ou retard">
          <Paragraphe>
            Tout retard ou absence devra être signalé dès que possible auprès du contact indiqué
            ci-dessus. En cas d'annulation tardive, les conditions prévues aux Conditions Générales
            de Vente (CGV) s'appliquent.
          </Paragraphe>
        </Carte>

        {/* Mention légale — UNIQUEMENT si le NDA existe. Avant l'enregistrement,
            cette ligne affirmait « déclaration enregistrée auprès du préfet »
            alors que l'en-tête de la même page disait « non encore enregistrée » :
            deux mentions contradictoires, dont une fausse. L'en-tête suffit. */}
        {identite.nda ? <NoteLegale>{LEGAL_MENTIONS.declarationActivite}</NoteLegale> : null}
      </PageCharte>
    </Document>
  );
}
