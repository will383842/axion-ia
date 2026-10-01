/**
 * UN QUESTIONNAIRE ÉCHOUÉ PEUT ÊTRE RELANCÉ (PR 7, parcours « Préparer un
 * questionnaire → texte à copier »).
 *
 * Quand l'étape `questionnaire` échoue (« questionnaire vide après
 * vérification » si le dossier est complet, IA fermée…), le brouillon reste
 * sans question. Avant ce correctif, la vue affichait « en préparation »
 * pour toujours, sans bouton : Will ne pouvait plus rien demander pour ce
 * projet. La vue dit maintenant l'échec et propose « Relancer la
 * préparation » (le geste reprend le même brouillon et remet l'étape à faire).
 *
 * Mutation qui rougit : revenir à la condition `null | clos | reponse_recue`
 * pour le bouton ; ne plus lire `preparationEchouee` ; compter une étape
 * `echec_definitif` comme « en vol ».
 * Contre-témoin : une préparation EN VOL n'affiche ni échec ni bouton (pas de
 * double demande).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/suivi-actions", () => ({ gesteSuiviAction: vi.fn() }));

import type { QuestionnaireDuProjet } from "@/features/dossier-client/queries";
import {
  peutPreparerQuestionnaire,
  preparationEchouee,
} from "@/features/dossier-client/questionnaire-etat";
import { VueQuestionnaire } from "../VueQuestionnaire";

function brouillonVide(echoue: boolean): QuestionnaireDuProjet {
  return {
    id: "q",
    version: 1,
    statut: "brouillon",
    enPreparation: true,
    preparationEchouee: echoue,
    genereLe: new Date("2026-10-06T08:00:00Z"),
    mode: "a_copier",
    reponseRecueLe: null,
    repondant: null,
    lienEnLigne: null,
    remplacable: false,
    questions: [],
  };
}

function rendre(q: QuestionnaireDuProjet | null): string {
  return renderToStaticMarkup(
    <VueQuestionnaire
      clientId="cl"
      projetId="p"
      retour="/fr/console/qualiopi/clients/cl/projets/p?vue=questionnaire"
      questionnaire={q}
      message={undefined}
      erreur={undefined}
    />,
  );
}

describe("un questionnaire échoué peut être relancé", () => {
  it("une étape en échec, suspendue ou annulée : la préparation a échoué", () => {
    expect(preparationEchouee(true, ["echec_definitif"])).toBe(true);
    expect(preparationEchouee(true, ["suspendu"])).toBe(true);
    expect(preparationEchouee(true, ["annule", "echec_definitif"])).toBe(true);
    expect(preparationEchouee(true, [])).toBe(true);
  });

  it("contre-témoin : une étape à faire ou en cours n'est pas un échec", () => {
    expect(preparationEchouee(true, ["a_faire"])).toBe(false);
    expect(preparationEchouee(true, ["echec_definitif", "en_cours"])).toBe(false);
    expect(preparationEchouee(false, ["echec_definitif"])).toBe(false);
  });

  it("la vue dit l'échec et propose « Relancer la préparation »", () => {
    const html = rendre(brouillonVide(true));
    expect(peutPreparerQuestionnaire(brouillonVide(true))).toBe(true);
    expect(html).toContain("n&#x27;a pas abouti");
    expect(html).toContain("Relancer la préparation");
    expect(html).toContain('value="questionnaire_demander"');
    expect(html).not.toContain("en préparation (quelques minutes)");
  });

  it("contre-témoin : en vol, ni échec ni bouton", () => {
    const html = rendre(brouillonVide(false));
    expect(peutPreparerQuestionnaire(brouillonVide(false))).toBe(false);
    expect(html).toContain("en préparation (quelques minutes)");
    expect(html).not.toContain('value="questionnaire_demander"');
  });

  it("sans questionnaire, ou clos : le bouton de préparation est là", () => {
    expect(rendre(null)).toContain("Préparer un questionnaire");
    expect(
      peutPreparerQuestionnaire({ ...brouillonVide(false), enPreparation: false, statut: "clos" }),
    ).toBe(true);
  });
});
