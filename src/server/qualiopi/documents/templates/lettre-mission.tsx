/**
 * Qualiopi — Lettre de mission formateur sous-traitant.
 *
 * Définit le périmètre de mission, les formations confiées, le tarif,
 * les obligations de confidentialité et de conformité Qualiopi.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  NdaFieldRow,
  DataTable,
  BulletList,
  SignatureZone,
  formatEur,
  pdfStyles,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface FormationConfiee {
  intitule: string;
  dateDebut: string;
  dateFin: string;
  lieuOuModalite: string;
  dureeHeures: number;
}

/** Une ligne de rémunération. `intitule` null = toutes les formations confiées. */
export interface LigneRemuneration {
  intitule: string | null;
  libelle: string;
}

export interface LettreMissionData {
  numero: string;
  estCopie?: boolean;
  // Formateur
  formateur: {
    nomPrenom: string;
    siretOuSirenOuNaf?: string;
    /**
     * Adresse PROFESSIONNELLE du sous-traitant (son entreprise), jamais son
     * domicile. Optionnelle depuis le 2026-08-01 (question Will, minimisation
     * RGPD) : la fiche formateur n'ayant aucun champ d'adresse, le générateur
     * imprimait un « — » figé — pire que l'absence, il criait le champ
     * manquant sur une pièce contractuelle. La ligne disparaît proprement.
     * ⚠️ Jamais l'adresse d'Axion-IA en repli : elle identifie l'AUTRE partie.
     */
    adresse?: string;
    email: string;
    telephone?: string;
    specialite: string;
    /**
     * Statut réel de l'intervenant (`Trainer.statut`).
     *
     * 🔴 Le gabarit qualifiait TOUT intervenant de « mandataire sous-traitant ».
     * Pour le DIRIGEANT qui anime lui-même, c'est juridiquement absurde — on ne
     * se sous-traite pas à soi-même — et contre-productif : c'est la pièce qui
     * documente le lien contractuel des intervenants dans le dossier de
     * déclaration d'activité, où elle doit dire la vérité du lien.
     * Absent = « sous_traitant », comportement historique inchangé.
     */
    statut?: string;
  };
  // Mission
  objetMission: string;
  formations: FormationConfiee[];
  /**
   * Période couverte (lettre-CADRE). Absente = lettre de session unique,
   * comportement historique inchangé.
   */
  periode?: { du: string; au: string };
  tarifJourHt: number;
  /**
   * Rémunération par formation, résolue depuis `TrainerCompensationRule` — le
   * MÊME barème que la paie mensuelle. Absente = repli historique sur
   * `tarifJourHt` (lettres émises avant le branchement du 2026-08-01, rendues
   * à l'identique via `metadata.renderData`).
   */
  remunerations?: LigneRemuneration[];
  // Dates
  dateMission: string;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * Sans ce branchement, la preuve n'existait QU'en base : le signataire signait
   * et la pièce qu'on lui remettait affichait encore des cadres vides.
   */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Composant
// ============================================================

export function LettreMissionPdf({
  data,
  identite,
}: {
  data: LettreMissionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Lettre de mission formateur"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (mandant)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret} required />
          <NdaFieldRow nda={identite.nda} />
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
          {identite.qualiopi ? <FieldRow label="Qualiopi" value={identite.qualiopi} /> : null}
          <FieldRow label="Adresse" value={identite.adresseSiege} required />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            {data.formateur.statut === "dirigeant"
              ? "Formateur (dirigeant de l'organisme)"
              : data.formateur.statut === "salarie"
                ? "Formateur (salarié de l'organisme)"
                : "Formateur (mandataire sous-traitant)"}
          </Text>
          <FieldRow label="Nom / Prénom" value={data.formateur.nomPrenom} />
          {data.formateur.siretOuSirenOuNaf ? (
            <FieldRow label="SIRET / SIREN / NAF" value={data.formateur.siretOuSirenOuNaf} />
          ) : null}
          {/*
            Adresse PROFESSIONNELLE, ligne optionnelle (2026-08-01). Le « — »
            historique est filtré ici pour que les pièces legacy re-rendues
            depuis `metadata.renderData` en profitent aussi. Jamais l'adresse
            de l'organisme en repli : elle identifie l'AUTRE partie (section 1).
          */}
          {data.formateur.adresse &&
          data.formateur.adresse.trim() !== "" &&
          data.formateur.adresse.trim() !== "—" ? (
            <FieldRow label="Adresse professionnelle" value={data.formateur.adresse} />
          ) : null}
          <FieldRow label="Email" value={data.formateur.email} />
          {data.formateur.telephone ? (
            <FieldRow label="Téléphone" value={data.formateur.telephone} />
          ) : null}
          <FieldRow label="Spécialité" value={data.formateur.specialite} />
        </DocSection>

        {/* 2. Objet et périmètre */}
        <DocSection title="2. Objet et périmètre de la mission">
          <Text style={pdfStyles.paragraph}>{data.objetMission}</Text>
          {data.periode ? (
            <Text style={pdfStyles.paragraph}>
              La présente lettre vaut lettre de mission-cadre pour la période du {data.periode.du}{" "}
              au {data.periode.au} : elle confie au formateur l&apos;ensemble des prestations
              listées en section 3 — formations, accompagnements individuels et audits le cas
              échéant — chacune demeurant soumise aux mêmes obligations et au barème de rémunération
              de la section 4.
            </Text>
          ) : null}
        </DocSection>

        {/* 3. Prestations confiées */}
        {/* « Prestation(s) » en mode cadre : la lettre-cadre peut confier des
            coachings AFEST et des audits en plus des formations (Will,
            2026-08-01) — « Formation(s) » y serait faux. */}
        <DocSection
          title={data.periode ? "3. Prestation(s) confiée(s)" : "3. Formation(s) confiée(s)"}
        >
          <DataTable
            columns={[
              { key: "intitule", header: "Intitulé", flex: 2 },
              { key: "dateDebut", header: "Du", flex: 1 },
              { key: "dateFin", header: "Au", flex: 1 },
              { key: "duree", header: "Durée", flex: 1 },
              { key: "lieuOuModalite", header: "Lieu / Modalité", flex: 1 },
            ]}
            rows={data.formations.map((f) => ({
              intitule: f.intitule,
              dateDebut: f.dateDebut,
              dateFin: f.dateFin,
              // Durée inconnue (séance legacy sans heure de fin) : « — », jamais
              // « 0 h » — un zéro se lirait comme une durée convenue.
              duree: f.dureeHeures > 0 ? `${f.dureeHeures} h` : "—",
              lieuOuModalite: f.lieuOuModalite,
            }))}
          />
        </DocSection>

        {/* 4. Tarif */}
        <DocSection title="4. Rémunération">
          {/*
            🔴 Depuis le 2026-08-01, la rémunération vient du barème résolu
            (`TrainerCompensationRule`, le même que la paie mensuelle), une
            ligne par formation quand les règles diffèrent. Le repli
            `tarifJourHt` ne sert plus qu'aux lettres émises avant ce
            branchement, re-rendues à l'identique depuis `metadata.renderData`.
          */}
          {data.remunerations && data.remunerations.length > 0 ? (
            data.remunerations.map((r, i) => (
              <FieldRow
                key={i}
                label={r.intitule ?? "Toutes formations confiées"}
                value={r.libelle}
              />
            ))
          ) : /*
              🔴 Un tarif à 0 ne s'imprime PAS. « Tarif journalier HT : 0,00 €
              / jour » se lit comme une erreur de génération sur une pièce
              contractuelle, et c'est ce que portait la lettre du
              dirigeant-formateur, qui n'est pas rémunéré à la journée. Même
              raisonnement que l'acompte à 0 de la convention : on écrit ce qui
              est convenu, jamais un montant nul.
            */
          data.tarifJourHt > 0 ? (
            <FieldRow label="Tarif journalier HT" value={formatEur(data.tarifJourHt) + " / jour"} />
          ) : data.formateur.statut === "dirigeant" ? (
            <Text style={pdfStyles.paragraph}>
              Mission assurée par le dirigeant de l&apos;organisme au titre de son mandat social :
              aucune rémunération distincte n&apos;est due à ce titre.
            </Text>
          ) : (
            <Text style={pdfStyles.paragraph}>
              Rémunération définie d&apos;un commun accord avant chaque session et confirmée par
              écrit.
            </Text>
          )}
          {/* La mention de facturation n'a de sens que pour un intervenant qui
              FACTURE : un dirigeant sous mandat social n'émet aucune facture. */}
          {data.formateur.statut !== "dirigeant" && data.formateur.statut !== "salarie" ? (
            <Text style={pdfStyles.legalNote}>
              La facturation s&apos;effectue sur présentation de facture conforme par le formateur,
              après chaque session réalisée. Le tarif est exprimé hors taxes (TVA selon régime
              applicable au formateur).
            </Text>
          ) : null}
        </DocSection>

        {/* 5. Obligations */}
        <DocSection title="5. Obligations du formateur">
          <BulletList
            items={[
              "Respecter les référentiels pédagogiques transmis par l'organisme de formation.",
              "Être titulaire ou en cours d'obtention d'une certification Qualiopi valide (ou sous sous-traitance déclarée conformément à l'indicateur 27 du référentiel Qualiopi) et en justifier sur demande (indicateur 19).",
              "Maintenir la confidentialité sur tout document, programme, technique ou information appris dans le cadre de cette mission (NDA implicite — voir article 6).",
              "Remettre les feuilles d'émargement dûment signées à l'issue de chaque demi-journée.",
              "Informer l'organisme sans délai de toute difficulté pédagogique ou logistique susceptible d'affecter la réalisation de la formation.",
            ]}
          />
        </DocSection>

        {/* 6. Confidentialité */}
        <DocSection title="6. Confidentialité">
          <Text style={pdfStyles.paragraph}>
            Le formateur s'engage à ne divulguer à aucun tiers, pendant la durée de la mission et
            pendant cinq (5) ans après son terme, toute information confidentielle relative à
            l'organisme de formation, à ses clients, stagiaires, méthodes pédagogiques, outils ou
            supports, sauf autorisation écrite préalable de l'organisme ou obligation légale.
          </Text>
        </DocSection>

        {/*
          Sections 7 à 10 — 2026-08-02.

          🔴 CHOIX ASSUMÉ : PAS de clause de non-concurrence, une clause de
          NON-SOLLICITATION. Interdire à un sous-traitant de travailler ailleurs
          est l'un des indices que retiennent les Prud'hommes et l'URSSAF pour
          REQUALIFIER la prestation en contrat de travail — avec rappel de
          cotisations sur toute la durée. Combinée aux référentiels imposés et
          aux comptes rendus déjà exigés en section 5, elle rendrait la
          requalification franchement plaidable.

          La non-sollicitation protège ce qu'on veut réellement protéger — que
          le formateur ne démarche pas les clients rencontrés ici — sans
          restreindre sa liberté de travailler. Elle est proportionnée, donc
          opposable ; une non-concurrence trop large est annulée par le juge, et
          n'aurait donc rien protégé du tout.

          La section 9 (indépendance) est l'exacte contrepartie : elle documente
          l'ABSENCE de subordination. C'est elle qui protège contre la
          requalification, là où une non-concurrence l'aurait nourrie.
        */}

        {/* 7. Propriété intellectuelle */}
        <DocSection title="7. Propriété intellectuelle">
          <Text style={pdfStyles.paragraph}>
            Les référentiels, supports et méthodes transmis par l&apos;organisme demeurent sa
            propriété exclusive ; le formateur les utilise pour les seuls besoins de la mission et
            les restitue ou les détruit à son terme.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Les supports, exercices et contenus que le formateur crée spécifiquement dans le cadre
            de la mission sont cédés à l&apos;organisme à titre exclusif, pour toute la durée légale
            de protection et pour le monde entier, pour les droits de reproduction,
            représentation, adaptation et traduction, sur tout support. Cette cession est comprise
            dans la rémunération prévue en section 4. Le formateur conserve la propriété des
            supports qu&apos;il avait développés avant la mission et qu&apos;il apporte, et concède
            à l&apos;organisme le droit de les utiliser pour les prestations concernées.
          </Text>
        </DocSection>

        {/* 8. Non-sollicitation */}
        <DocSection title="8. Non-sollicitation">
          <Text style={pdfStyles.paragraph}>
            Pendant la mission et durant dix-huit (18) mois après son terme, le formateur
            s&apos;engage à ne pas solliciter directement, pour des prestations de même nature, les
            clients de l&apos;organisme auprès desquels il est intervenu à ce titre, ni à démarcher
            les intervenants ou salariés de l&apos;organisme en vue de les recruter.
          </Text>
          <Text style={pdfStyles.legalNote}>
            Cette clause n&apos;interdit pas au formateur d&apos;exercer librement son activité,
            y compris auprès de clients qu&apos;il aurait acquis par ses propres moyens : elle ne
            vise que la sollicitation de la clientèle rencontrée à l&apos;occasion de la présente
            mission.
          </Text>
        </DocSection>

        {/* 9. Indépendance */}
        <DocSection title="9. Indépendance des parties">
          <Text style={pdfStyles.paragraph}>
            Le formateur exerce en toute indépendance. Il organise librement son travail, conserve
            la maîtrise de ses méthodes d&apos;animation dans le respect du programme convenu, et
            n&apos;est soumis à aucun lien de subordination envers l&apos;organisme. Il demeure
            libre d&apos;exercer pour d&apos;autres donneurs d&apos;ordre.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Le formateur déclare être régulièrement immatriculé, à jour de ses obligations sociales
            et fiscales, et détenir une assurance de responsabilité civile professionnelle couvrant
            son activité de formation. Il en justifie sur simple demande, et informe
            l&apos;organisme sans délai de toute cessation de garantie.
          </Text>
        </DocSection>

        {/* 10. Durée et résiliation */}
        <DocSection title="10. Durée et résiliation">
          <Text style={pdfStyles.paragraph}>
            La présente lettre prend effet à sa signature et s&apos;achève à la réalisation des
            prestations confiées{data.periode ? " ou au terme de la période indiquée" : ""}. Chaque
            partie peut y mettre fin par écrit moyennant un préavis de trente (30) jours, sans
            indemnité, les prestations déjà engagées étant menées à leur terme.
          </Text>
          <Text style={pdfStyles.paragraph}>
            En cas de manquement grave — notamment atteinte à la confidentialité, absence non
            justifiée ou défaut d&apos;assurance — la résiliation peut intervenir sans préavis,
            après mise en demeure restée sans effet pendant huit (8) jours.
          </Text>
        </DocSection>

        {/* 11. Signatures */}
        {/* « Fait à » = ville du siège — même raisonnement que la convention : un
            blanc sur une pièce signée électroniquement reste vide pour toujours. */}
        <DocSection title="11. Signatures">
          <SignatureZone
            faitLe={`${identite.rcsVille || "_________________________"}, le ${data.dateMission}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Pour le formateur",
                signature: data.signatures?.formateur ?? null,
                nom: data.formateur.nomPrenom,
                mention: "Nom, signature",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
