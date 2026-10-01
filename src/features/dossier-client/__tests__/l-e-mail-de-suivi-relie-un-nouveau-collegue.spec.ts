// @vitest-environment node
/**
 * m-7 (2e vérification du chantier visio) — client récurrent, rendez-vous
 * réservé par un collègue qui n'est pas sur la fiche : la page « E-mail de
 * suivi » disait « rattachez-le dans « Après l'appel » », où aucun geste ne
 * le permet. Désormais : ajoutez la personne (avec son adresse) dans l'onglet
 * Personnes, puis « Relier les personnes » relie, par empreinte d'adresse,
 * chaque participant à sa personne.
 *
 * Mutation qui rougit : retirer le geste `participants_relier`, ou ne plus
 * appeler `relierParticipantsAuxPersonnes`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ErreurRattachement, relierParticipantsDeLaRencontre } from "../rattacher";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

function scene(rangee: boolean) {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const rencontreId = id(21);
  const contactId = id(22);
  const base = dossierEnMemoire({
    client: [f],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "Discutons de votre projet IA",
        clientId: rangee ? f["id"] : null,
        rattachementStatut: rangee ? "valide" : "a_classer",
      },
    ],
    rencontreParticipant: [
      { id: id(23), rencontreId, role: "client", emailHash: "empreinte-fictive", nomAffiche: "X" },
    ],
    clientContact: [{ id: contactId, clientId: f["id"], nom: "Collègue Fictif" }],
    clientContactAdresse: [{ id: id(24), contactId, emailHash: "empreinte-fictive" }],
  });
  return { base, rencontreId, contactId };
}

describe("m-7 — l'e-mail de suivi relie un nouveau collègue", () => {
  it("après l'ajout de la personne, « Relier les personnes » la relie", async () => {
    const { base, rencontreId, contactId } = scene(true);
    const m = await relierParticipantsDeLaRencontre(base.client as never, rencontreId);
    expect(base.tables["rencontreParticipant"]?.[0]?.["contactId"]).toBe(contactId);
    expect(m).toMatch(/1 participant relié/);
  });

  it("contre-témoin : un rendez-vous pas encore rangé est refusé", async () => {
    const { base, rencontreId } = scene(false);
    await expect(
      relierParticipantsDeLaRencontre(base.client as never, rencontreId),
    ).rejects.toBeInstanceOf(ErreurRattachement);
  });

  it("la page dit le vrai geste, et l'action le porte", () => {
    const vue = readFileSync("src/components/admin/visio/VueEmailSuivi.tsx", "utf8");
    expect(vue).not.toContain("rattachez-le");
    expect(vue).toContain('cache("participants_relier")');
    expect(vue).toContain("onglet Personnes");
    const action = readFileSync("src/features/dossier-client/suivi-actions.ts", "utf8");
    expect(action).toMatch(/participants_relier:/);
  });
});
