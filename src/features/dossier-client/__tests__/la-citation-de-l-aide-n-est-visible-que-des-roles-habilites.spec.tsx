/**
 * ⛔ LA CITATION DE L'AIDE N'EST VISIBLE QUE DES RÔLES HABILITÉS (PR 7, A2).
 *
 * La phrase exacte du client n'est rendue qu'à `ROLES_DOSSIER_ECHANGES`
 * (Williams et les administrateurs). Pour tout autre rôle, `citations` vaut
 * `null` : la phrase ne quitte jamais le serveur, et le panneau dit pourquoi.
 * (Les pages, en plus, ne lisent pas les citations pour ces rôles.)
 *
 * Mutation qui rougit : remplacer `habilite ? … : null` par la citation dans
 * `valeurDe` (aide-au-devis.ts).
 * Contre-témoin : pour `admin`, la citation est bien là, et rendue.
 * Angle mort : la liste des rôles vit dans `acces.ts` (garde dérivée
 * `les-roles-de-l-enregistreur-sont-ceux-du-dossier.spec.ts`).
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CeQueLeClientADit } from "@/features/dossier-client/ce-que-le-client-a-dit";
import { aide, element, PROJET } from "./_aide";
import { faitProjet } from "./_faits";

const PHRASE = "on serait une douzaine de commerciaux";
const faits = [faitProjet(PROJET, { id: "f-cit-1", type: "nb_participants", quantite: 12 })];
const citations = [["f-cit-1", PHRASE]] as const;

describe("⛔ la citation de l'aide n'est visible que des rôles habilités", () => {
  it.each(["editor", "responsable_qualite", "secretaire", "reader", null])(
    "rôle %s : aucune citation dans l'aide",
    (role) => {
      const a = aide(faits, { role, citations });
      expect(a.citationsVisibles).toBe(false);
      expect(element(a, "nb_participants")?.valeurs.every((v) => v.citations === null)).toBe(true);
      expect(JSON.stringify(a)).not.toContain(PHRASE);
    },
  );

  it("contre-témoin : pour un administrateur, la citation est rendue", () => {
    const a = aide(faits, { role: "admin", citations });
    expect(element(a, "nb_participants")?.valeurs[0]?.citations).toEqual([PHRASE]);
    render(<CeQueLeClientADit aide={a} projetTitre="Former les commerciaux" />);
    expect(screen.getByText(new RegExp(PHRASE))).toBeTruthy();
  });

  it("rendu pour un rôle non habilité : la valeur, pas la phrase, et la raison", () => {
    const a = aide(faits, { role: "editor", citations });
    const { container } = render(<CeQueLeClientADit aide={a} projetTitre="Projet fictif" />);
    expect(container.textContent).not.toContain(PHRASE);
    expect(container.textContent).toContain("réservées à Williams et aux administrateurs");
  });
});
