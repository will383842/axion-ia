/**
 * LE QUESTIONNAIRE EN LIGNE SE VOIT DANS LA CONSOLE (2026-10-01).
 *
 * Vue « Questionnaire » du projet :
 *   · « Écrire mes questions » est toujours là (pré-rempli tant que rien n'est
 *     reçu, puisque le geste REMPLACE alors la version courante) ;
 *   · « Lien du questionnaire en ligne » tant que le lien n'est pas ouvert ;
 *     une fois ouvert, l'URL complète dans un champ, avec « Copier » ;
 *   · à la réception : « Reçu en ligne le … · par {Qui répond} ».
 *
 * Mutation qui rougit : ne plus afficher l'URL après le geste ; afficher la
 * ligne « Reçu en ligne » pour une réponse COLLÉE (mode « à copier ») ; perdre
 * le répondant.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/suivi-actions", () => ({ gesteSuiviAction: vi.fn() }));

import type { QuestionnaireDuProjet } from "@/features/dossier-client/queries";
import { VueQuestionnaire } from "../VueQuestionnaire";

const URL_LIEN = "https://axion-ia.com/questionnaire/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/jeton";

function q(p: Partial<QuestionnaireDuProjet>): QuestionnaireDuProjet {
  return {
    id: "q",
    version: 1,
    statut: "brouillon",
    enPreparation: false,
    preparationEchouee: false,
    genereLe: new Date("2026-10-01T08:00:00Z"),
    mode: "en_ligne",
    reponseRecueLe: null,
    repondant: null,
    lienEnLigne: URL_LIEN,
    remplacable: false,
    questions: [
      {
        id: "a",
        ordre: 1,
        texte: "Combien de personnes ?",
        poseeDeViveVoix: false,
        reponse: null,
        faits: [],
      },
    ],
    ...p,
  };
}

const rendre = (questionnaire: QuestionnaireDuProjet | null): string =>
  renderToStaticMarkup(
    <VueQuestionnaire
      clientId="cl"
      projetId="p"
      retour="/fr/console/qualiopi/clients/cl/projets/p?vue=questionnaire"
      questionnaire={questionnaire}
      message={undefined}
      erreur={undefined}
    />,
  );

describe("le questionnaire en ligne se voit dans la console", () => {
  it("sans questionnaire : « Écrire mes questions » est proposé", () => {
    const html = rendre(null);
    expect(html).toContain('value="questionnaire_ecrire"');
    expect(html).toContain("Écrire mes questions");
  });

  it("brouillon : le bouton « Lien du questionnaire en ligne », pas encore d'URL", () => {
    const html = rendre(q({ remplacable: true }));
    expect(html).toContain('value="questionnaire_lien"');
    expect(html).not.toContain(URL_LIEN);
    // Pré-rempli : le geste remplacera ces questions.
    expect(html).toContain("Combien de personnes ?</textarea>");
  });

  it("lien ouvert : l'URL complète, sélectionnable, avec « Copier »", () => {
    const html = rendre(q({ statut: "copie" }));
    expect(html).toContain(`value="${URL_LIEN}"`);
    expect(html).toContain("Copier");
    expect(html).not.toContain('value="questionnaire_lien"');
  });

  it("lien ouvert : « Écrire mes questions » n'est PAS pré-rempli et annonce la fermeture de l'ancien lien", () => {
    const html = rendre(q({ statut: "copie" }));
    expect(html).not.toContain("Combien de personnes ?</textarea>");
    expect(html).toContain("l&#x27;ancien lien");
  });

  it("réponses reçues en ligne : la date et la personne qui a répondu", () => {
    const html = rendre(
      q({
        statut: "reponse_recue",
        reponseRecueLe: new Date("2026-10-02T09:30:00Z"),
        repondant: "Camille Fictive, DRH",
      }),
    );
    expect(html).toContain("Reçu en ligne le");
    expect(html).toContain("· par Camille Fictive, DRH");
  });

  it("contre-témoin : une réponse COLLÉE (à copier) ne se dit pas « reçue en ligne »", () => {
    const html = rendre(
      q({
        mode: "a_copier",
        statut: "reponse_recue",
        reponseRecueLe: new Date(),
        lienEnLigne: null,
      }),
    );
    expect(html).not.toContain("Reçu en ligne");
  });
});
