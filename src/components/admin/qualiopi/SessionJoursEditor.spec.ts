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

import { peutEnregistrerJours } from "./SessionJoursEditor";

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
