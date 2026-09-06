/**
 * Tests — activation du bouton « Enregistrer les journées » (constat du parcours
 * à blanc 2026-07-27).
 *
 * 🔴 Ce qui s'est passé en production. Les journées sont PROPOSÉES à la création
 * de la session et arrivent donc déjà dans `joursInitiaux` : `modifie` valait
 * faux dès l'ouverture de l'écran, et le bouton était désactivé — alors que
 * l'écran demande, en orange, de « vérifier les horaires réels, puis
 * enregistrer ». Quand la proposition tombait juste, c'est-à-dire le cas
 * nominal, elle était donc INCONFIRMABLE.
 *
 * Et ce n'était pas un désagrément d'interface : `emettreLiensSessionAction`
 * refuse d'émettre tant qu'une journée porte `horairesConfirmes = false`
 * (« horaires_non_confirmes »). Bouton mort → confirmation impossible → aucun
 * lien de signature → aucune signature → ni feuille d'émargement, ni taux de
 * présence, ni certificat. Toute la chaîne probante tenait à ce booléen.
 *
 * Le contournement trouvé sur le moment — fausser un horaire pour réveiller le
 * bouton, puis le remettre — est exactement ce qu'il ne faut pas faire faire à
 * quelqu'un sur une pièce à valeur probante.
 */

import { describe, it, expect } from "vitest";

import { messageJoursEnregistrees, peutEnregistrerJours } from "./SessionJoursEditor";

const BASE = {
  isPending: false,
  modifie: false,
  aDesHorairesNonConfirmes: false,
  nbJours: 1,
} as const;

describe("peutEnregistrerJours", () => {
  // 🔴 Le cas qui bloquait la production.
  it("laisse confirmer des journées proposées que l'admin n'a pas modifiées", () => {
    expect(peutEnregistrerJours({ ...BASE, aDesHorairesNonConfirmes: true })).toBe(true);
  });

  it("laisse enregistrer dès que l'admin a modifié quelque chose", () => {
    expect(peutEnregistrerJours({ ...BASE, modifie: true })).toBe(true);
  });

  // Une fois confirmées, réenregistrer à l'identique n'a plus d'objet : le
  // bouton actif à vide ferait croire à une action en attente.
  it("refuse quand les journées sont déjà confirmées et inchangées", () => {
    expect(peutEnregistrerJours(BASE)).toBe(false);
  });

  it("refuse pendant l'enregistrement, même si tout le reste autorise", () => {
    expect(
      peutEnregistrerJours({
        ...BASE,
        isPending: true,
        modifie: true,
        aDesHorairesNonConfirmes: true,
      }),
    ).toBe(false);
  });

  // Confirmer une liste vide n'aurait aucun sens : il n'y a rien à confirmer.
  // Vider la liste reste possible, mais par `modifie`, pas par ce chemin.
  it("refuse de « confirmer » une liste vide", () => {
    expect(peutEnregistrerJours({ ...BASE, aDesHorairesNonConfirmes: true, nbJours: 0 })).toBe(
      false,
    );
  });

  it("laisse vider la liste — c'est une modification comme une autre", () => {
    expect(peutEnregistrerJours({ ...BASE, modifie: true, nbJours: 0 })).toBe(true);
  });
});

/**
 * 🔴 F8 — « Confirmer les journées » ne crée PAS les créneaux.
 *
 * Constaté en parcourant la console le 2026-09-04. Le suivi de dossier n'a
 * qu'UNE étape, « Journées de présence confirmées » ; l'écran d'émargement en a
 * DEUX, séparées par un bloc entier. Le message de succès s'arrêtait à
 * « 1 journée enregistrée » et laissait croire le travail fini. Or sans
 * créneaux, les liens de signature partent quand même et le stagiaire tombe sur
 * « Aucune demi-journée à signer » : pas de signature, donc pas de feuille
 * d'émargement, pas de taux de présence, pas de certificat.
 *
 * Le message doit donc dire les DEUX choses : ce qui vient d'être fait, et ce
 * qu'il reste. Un message qui ne dit que la première moitié n'est pas
 * incomplet : il est trompeur, parce qu'il arrive au moment précis où l'on
 * décide qu'on a fini.
 */
describe("messageJoursEnregistrees", () => {
  it("nomme le geste RESTANT quand aucun créneau n'existe", () => {
    const m = messageJoursEnregistrees({ nbJours: 1, hasCreneaux: false });
    expect(m).toContain("1 journée enregistrée.");
    // Les trois choses qu'il faut avoir lues pour ne pas s'arrêter là.
    expect(m).toMatch(/n'en crée aucun/);
    expect(m).toMatch(/Aucune demi-journée à signer/);
    expect(m).toMatch(/Générer les créneaux/);
  });

  it("accorde le pluriel sans changer le fond du message", () => {
    const m = messageJoursEnregistrees({ nbJours: 3, hasCreneaux: false });
    expect(m).toContain("3 journées enregistrées.");
    expect(m).toMatch(/Générer les créneaux/);
  });

  // Contre-témoin : quand les créneaux EXISTENT, réclamer « Générer les
  // créneaux » serait un ordre faux — l'écran affirme au contraire, quelques
  // lignes plus bas, qu'un créneau peut porter une signature et qu'on ne le
  // recalcule pas. Une garde qui exigerait la phrase dans les deux cas
  // pousserait à écrire cette contre-vérité.
  it("ne réclame PAS la génération quand les créneaux existent déjà", () => {
    const m = messageJoursEnregistrees({ nbJours: 2, hasCreneaux: true });
    expect(m).toContain("2 journées enregistrées.");
    expect(m).not.toMatch(/Générer les créneaux/);
    expect(m).toMatch(/ne sont PAS recalculés/);
  });

  it("garde le message « aucune journée » — la session retombe sur sa plage", () => {
    expect(messageJoursEnregistrees({ nbJours: 0, hasCreneaux: false })).toBe(
      "Aucune journée déclarée : la session retombe sur sa plage de dates.",
    );
  });
});
