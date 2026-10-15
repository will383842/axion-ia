// @formateurs E15 — Formation à plusieurs entreprises : UNE convention signée suffit.
//
// Deux entreprises sur la même session, une convention chacune. La première signée
// engage le client au sens du moteur (`lireEtatMission` compte les pièces
// engageantes signées de la session) : la lettre part. La seconde, signée plus tard,
// ne fait rien de plus — ni deuxième lettre, ni deuxième F26.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerClient,
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
} from "../fixtures/formateurs/missions-donnees";
import {
  lettresVivantes,
  missionAcceptee,
  signerConvention,
} from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e15");

test.describe("@formateurs E15 — formation à plusieurs entreprises", () => {
  test.setTimeout(240_000);

  test("une convention signée suffit ; la seconde ne rejoue rien", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Fanny" });
    const autre = await creerClient(monde, "deux");
    // Inter-entreprises : la session n'a pas de client unique.
    const session = await creerSession(monde, { dansJours: 25, clientId: null });
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { interEntreprises: true },
    });
    await missionAcceptee(pilote, monde, session.id, f.id);
    await expect
      .poll(
        async () => (await envoisVers(f.email, "formateur-accord-enregistre")).length,
        ATTENTE_FILE,
      )
      .toBe(1);

    const conv1 = await creerPiece(monde, {
      type: "convention",
      sessionId: session.id,
      clientId: monde.clientId,
    });
    const conv2 = await creerPiece(monde, {
      type: "convention",
      sessionId: session.id,
      clientId: autre,
    });

    // Une seule des deux est signée : la lettre est due et part.
    await signerConvention(pilote, monde, conv1);
    const apresUne = await lettresVivantes(session.id, f.id);
    expect(apresUne).toHaveLength(1);
    expect(
      (
        await prisma.documentGenere.findUniqueOrThrow({
          where: { id: conv2 },
          select: { statutSignature: true },
        })
      ).statutSignature,
    ).toBe("en_attente");
    await expect
      .poll(
        async () => (await envoisVers(f.email, "formateur-lettre-a-signer")).length,
        ATTENTE_FILE,
      )
      .toBe(1);

    // La seconde, signée ensuite : rien de plus.
    await signerConvention(pilote, monde, conv2);
    const apresDeux = await lettresVivantes(session.id, f.id);
    expect(apresDeux.map((l) => l.id)).toEqual(apresUne.map((l) => l.id));
    expect(await envoisVers(f.email, "formateur-lettre-a-signer")).toHaveLength(1);
    expect(await envoisVers(f.email, "formateur-lettre-rectifiee")).toEqual([]);
  });
});
