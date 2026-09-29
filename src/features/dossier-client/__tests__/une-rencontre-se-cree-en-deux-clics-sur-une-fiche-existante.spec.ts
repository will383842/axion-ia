// @vitest-environment node
/**
 * Créer un rendez-vous dans la console (plan V-05b, décision B9 : 2 clics
 * depuis le projet) : la rencontre naît `saisie_manuelle`, `planifie`, RANGÉE
 * sur la fiche (la base l'exige), avec Williams et les personnes invitées ;
 * pour une visio, l'invitation est PRÉPARÉE (l'action la gare en « E-mails à
 * valider ») — sans la phrase sur l'enregistrement tant qu'il n'est pas
 * annoncé par la notice.
 *
 * Contre-témoins : une fiche inconnue est refusée (une rencontre saisie ne
 * crée jamais de fiche) ; un projet d'un autre client est refusé ; un
 * rendez-vous téléphone n'a pas d'invitation.
 */

import { describe, expect, it } from "vitest";

import { creerRencontre, ENREGISTREMENT_ANNONCE_AUX_CLIENTS } from "../creer-rencontre";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";

function scene() {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const autre = fiche({ raisonSociale: "Autre Fiche" });
  const contactId = id(7);
  const projetAutre = id(8);
  const base = dossierEnMemoire({
    client: [f, autre],
    clientContact: [{ id: contactId, clientId: f["id"], nom: "Camille Prospect", statut: "actif" }],
    clientContactAdresse: [
      {
        id: id(9),
        contactId,
        email: "camille@exemple-fictif.fr",
        emailHash: "h",
        ajouteeLe: new Date(),
      },
    ],
    projet: [{ id: projetAutre, clientId: autre["id"], numero: "AXI-PRJ-2026-001", titre: "p" }],
  });
  return { base, f, contactId, projetAutre };
}

describe("un rendez-vous se crée en deux clics sur une fiche existante", () => {
  it("visio : rangée, planifiée, participants, invitation préparée", async () => {
    const { base, f, contactId } = scene();
    const r = await creerRencontre(base.client as never, {
      clientId: f["id"] as string,
      type: "visio",
      debut: new Date("2026-10-06T08:00:00Z"),
      dureeMin: 45,
      lienVisio: "https://meet.google.com/abc-defg-hij",
      contactIds: [contactId],
      parAdminId: ADMIN,
    });
    const rencontre = base.tables["rencontre"]?.[0];
    expect(rencontre).toMatchObject({
      source: "saisie_manuelle",
      statut: "planifie",
      rattachementStatut: "valide",
      clientId: f["id"],
      meetCode: "abc-defg-hij",
    });
    expect((rencontre?.["finPrevue"] as Date).toISOString()).toBe("2026-10-06T08:45:00.000Z");
    expect(base.tables["rencontreParticipant"]?.map((p) => p["role"]).sort()).toEqual([
      "axion",
      "client",
    ]);
    expect(r.invitation?.destinataire).toBe("camille@exemple-fictif.fr");
    expect(r.invitation?.payload.phraseEnregistrement).toBe(ENREGISTREMENT_ANNONCE_AUX_CLIENTS);
    expect(ENREGISTREMENT_ANNONCE_AUX_CLIENTS).toBe(false);
  });

  it("contre-témoin : téléphone, pas d'invitation", async () => {
    const { base, f, contactId } = scene();
    const r = await creerRencontre(base.client as never, {
      clientId: f["id"] as string,
      type: "telephone",
      debut: new Date("2026-10-06T08:00:00Z"),
      dureeMin: 30,
      contactIds: [contactId],
      parAdminId: ADMIN,
    });
    expect(r.invitation).toBeNull();
  });

  it("contre-témoin : fiche inconnue, ou projet d'un autre client — refus, rien d'écrit", async () => {
    const { base, f, projetAutre } = scene();
    await expect(
      creerRencontre(base.client as never, {
        clientId: id(1),
        type: "visio",
        debut: new Date("2026-10-06T08:00:00Z"),
        dureeMin: 30,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/introuvable/);
    await expect(
      creerRencontre(base.client as never, {
        clientId: f["id"] as string,
        projetId: projetAutre,
        type: "visio",
        debut: new Date("2026-10-06T08:00:00Z"),
        dureeMin: 30,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/n'appartient pas/);
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });
});
