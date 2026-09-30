/**
 * Un geste qui CITE un bouton doit citer un bouton qui existe.
 *
 * ## Le défaut (audit UX du 30/09/2026)
 *
 * « Où en est ce dossier » disait par exemple « bouton « Assigner un
 * formateur » en tête de session » : le bouton s'appelle « Assigner », et il
 * n'est pas en tête de session. Sept gestes citaient ainsi, entre guillemets,
 * un libellé qu'aucun écran n'affiche — « Générer la convention »,
 * « Contresigner », « Envoyer le positionnement », « Confirmer les journées »,
 * « Envoyer les liens », « Générer l'accès ». Une aide qui nomme un bouton
 * absent envoie chercher ce qui n'existe pas : c'est pire qu'aucune aide.
 *
 * ## Ce que ce test protège
 *
 * Tout libellé cité entre « » dans le `geste` d'une étape doit exister
 * LITTÉRALEMENT dans le source d'un des composants où l'étape mène. La table
 * ci-dessous dit, pour chaque étape, où vit son geste ; une étape ajoutée sans
 * entrée fait rougir le test (témoin d'exhaustivité).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { construireParcours, type EtapeCle, type SessionParcoursInput } from "../session-parcours";

const RACINE = resolve(__dirname, "../../../../..");
const C = "src/components/admin/qualiopi";
const FICHE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]";

/** Où vit le geste de chaque étape — composants rendus par la cible. */
const SOURCES_DU_GESTE: Record<EtapeCle, readonly string[]> = {
  formateur_assigne: [`${C}/AssignFormateurForm.tsx`],
  convention_generee: [`${C}/DocumentsSection.tsx`],
  convention_signee: [`${C}/PieceSignaturePanel.tsx`, `${C}/RelancerSignatureButton.tsx`],
  convention_contresignee: [`${C}/PieceSignaturePanel.tsx`, `${FICHE}/page.tsx`],
  positionnement_envoye: [`${C}/QuestionnairesSection.tsx`],
  positionnement_repondu: [
    `${C}/QuestionnairesSection.tsx`,
    `${C}/RelancerQuestionnaireButton.tsx`,
  ],
  convocation_envoyee: [`${C}/DocumentsSection.tsx`],
  creneaux_emargement: [`${C}/SessionJoursEditor.tsx`],
  liens_signature_emis: [`${C}/LiensEmargement.tsx`],
  emargement_signe: [`${C}/EmargementGrid.tsx`, `${FICHE}/emargement/page.tsx`],
  contresignature_formateur: [`${FICHE}/emargement/page.tsx`],
  evaluation_finale: [`${FICHE}/evaluations/page.tsx`],
  attestation: [`${C}/GenererAttestationButton.tsx`, `${FICHE}/evaluations/page.tsx`],
  acces_portail: [`${C}/GenererPortailAccesButton.tsx`],
  satisfaction_chaud: [`${C}/QuestionnairesSection.tsx`, `${C}/RelancerQuestionnaireButton.tsx`],
  satisfaction_froid: [`${C}/QuestionnairesSection.tsx`, `${C}/RelancerQuestionnaireButton.tsx`],
};

/** Le source, entités JSX décodées : `l&apos;organisme` s'affiche « l'organisme ». */
function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf8")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/** Les citations « … » d'un texte (guillemets français, espaces insécables tolérées). */
function citations(texte: string): string[] {
  return [...texte.matchAll(/«[\s  ]*([^»]+?)[\s  ]*»/g)].map((m) => m[1]!);
}

/**
 * Le libellé existe-t-il ENTIER dans le source — chaîne délimitée ou texte JSX ?
 *
 * ⚠️ Pas un simple `includes` : « Contresigner » se trouve dans « Contresigner
 * la lettre de mission », et « Envoyer les liens » dans « Envoyer les liens par
 * e-mail ». Un bouton dont le nom n'est qu'un PRÉFIXE du nom cité n'est pas le
 * bouton cité — c'est exactement le glissement que ce test doit attraper.
 */
function libelleEntier(source: string, libelle: string): boolean {
  const echappe = libelle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(["\`>]|«\\s)\\s*${echappe}\\s*(["\`<]|\\s»)`).test(source);
}

const d = (iso: string) => new Date(iso);

/** Un dossier où les seize étapes existent (aucune n'est repliée). */
function dossierComplet(): SessionParcoursInput {
  return {
    session: {
      statut: "en_cours",
      dateDebut: d("2026-10-10T07:00:00.000Z"),
      dateFin: d("2026-10-11T15:00:00.000Z"),
      formateurPrincipalId: null,
      financementType: "opco",
    },
    documents: [],
    signaturesParPiece: new Map(),
    inscriptions: [
      {
        id: "e1",
        statut: "planifiee",
        financementType: null,
        emargementSigneAt: null,
        convocationEnvoyeeAt: null,
        questionnaires: [],
        evaluationFinaleAt: null,
        aUnAccesPortail: false,
        attestation: null,
      },
    ],
    liensEmargementActifs: 0,
    creneauxEmargement: 0,
    contresignature: { signees: 2, aContresigner: 1, sansDestinataire: 0, parFormateur: new Map() },
    maintenant: d("2026-10-10T12:00:00.000Z"),
  };
}

describe("les gestes citent des boutons réels", () => {
  const etapes = construireParcours(dossierComplet()).etapes;

  it("témoin — les seize étapes sont là, et chacune a sa ligne dans la table", () => {
    expect(etapes).toHaveLength(16);
    for (const e of etapes) expect(SOURCES_DU_GESTE[e.cle], e.cle).toBeDefined();
  });

  it("témoin — au moins cinq gestes citent un libellé, sinon le test ne vérifie rien", () => {
    const n = etapes.filter((e) => citations(e.geste).length > 0).length;
    expect(n).toBeGreaterThanOrEqual(5);
  });

  it("🔴 tout libellé cité entre « » dans un geste existe dans le source du composant cible", () => {
    const fautes: string[] = [];
    for (const e of etapes) {
      const sources = SOURCES_DU_GESTE[e.cle].map(lire).join("\n");
      for (const c of citations(e.geste)) {
        if (!libelleEntier(sources, c)) fautes.push(`${e.cle} : « ${c} »`);
      }
    }
    expect(fautes, `Libellés introuvables à l'écran :\n${fautes.join("\n")}`).toEqual([]);
  });
});
