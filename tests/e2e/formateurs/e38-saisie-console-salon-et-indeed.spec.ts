// @formateurs — E38 · Saisie en console : un candidat de salon, un candidat Indeed.
//
//   · rencontré sur un salon, case « Envoyer l'invitation » COCHÉE → F1 part ;
//   · venu d'Indeed, adresse RELAIS (`@indeedemail.com`), case NON cochée → rien ;
//   · une réponse arrivée depuis l'adresse relais tombe « à vérifier » : elle ne
//     peut rattacher personne avec certitude, mais elle ne doit pas se perdre.
//
// L'action est celle de la console (`ajouterCandidatFormateurAction`), avec la
// session d'un administrateur du banc. L'adresse relais ne reçoit rien : le banc
// le vérifie au journal des envois et au puits.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  plus,
  sujetsCaptes,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

type EtatAjout = { ok: true; id: string; message: string } | { ok: false; message: string };

test.describe("@formateurs E38 — saisie en console : salon et Indeed", () => {
  test.setTimeout(300_000);
  let decor: DecorScenario;
  const idsRelais: string[] = [];

  test.beforeAll(async () => {
    decor = await ouvrirScenario("e38");
  });
  test.afterAll(async () => {
    // Une candidature relais n'a pas d'empreinte : effacée par son identifiant.
    await prisma.jobApplicationInboundReply.deleteMany({
      where: { applicationId: { in: idsRelais } },
    });
    await prisma.activityLog.deleteMany({ where: { targetId: { in: idsRelais } } });
    await prisma.jobApplication.deleteMany({ where: { id: { in: idsRelais } } });
    await decor?.liberer();
    await prisma.$disconnect();
  });

  function relais(): string {
    const a = `banc-essai-${Date.now()}-${Math.floor(Math.random() * 1e6)}@indeedemail.com`;
    decor.adresses.add(a);
    return a;
  }

  async function ajouter(saisie: Record<string, unknown>): Promise<string> {
    const r = await etape<EtatAjout>({
      etape: "ajouter-candidat-console",
      args: { saisie },
      session: decor.admin,
    });
    expect(r.valeur.ok, r.valeur.message).toBe(true);
    return r.valeur.ok ? r.valeur.id : "";
  }

  test("salon (case cochée) : F1 ; Indeed (case non cochée) : rien", async () => {
    const salon = decor.adresse("salon");
    const idSalon = await ajouter({
      prenom: "Lison",
      nom: "Banc-Essai",
      email: salon,
      origine: "salon",
      envoyerInvitation: true,
    });
    const indeed = relais();
    const idIndeed = await ajouter({
      prenom: "Tao",
      nom: "Banc-Essai",
      email: indeed,
      origine: "indeed",
      envoyerInvitation: false,
    });
    idsRelais.push(idIndeed);

    await attendreLeWorker(salon);
    expect(await gabaritsVers(salon)).toEqual(["formateur-invitation-echange"]);
    await expect.poll(async () => (await sujetsCaptes(salon)).length, { timeout: 30_000 }).toBe(1);

    // Le balayage automatique ignore les saisies de console : rien de plus, pour personne.
    const maintenant = plus(new Date(), { minutes: 20 });
    await etape({ etape: "passage-invitations", args: { maintenant } });
    await attendreLeWorker(salon);
    expect(await gabaritsVers(salon)).toEqual(["formateur-invitation-echange"]);
    expect(await gabaritsVers(indeed)).toEqual([]);
    expect(await sujetsCaptes(indeed)).toEqual([]);

    const fiches = await prisma.jobApplication.findMany({
      where: { id: { in: [idSalon, idIndeed] } },
      select: {
        id: true,
        origine: true,
        natureCollaboration: true,
        emailHash: true,
        invitationFormateurAt: true,
      },
    });
    const parId = new Map(fiches.map((f) => [f.id, f]));
    expect(parId.get(idSalon)).toMatchObject({
      origine: "console",
      natureCollaboration: "freelance",
    });
    expect(parId.get(idSalon)?.invitationFormateurAt).not.toBeNull();
    // L'adresse relais n'identifie personne : aucune empreinte, aucune invitation.
    expect(parId.get(idIndeed)).toMatchObject({
      origine: "console",
      emailHash: null,
      invitationFormateurAt: null,
    });
  });

  // V1-A-3 — une réponse venue de l'adresse relais est IGNORÉE en silence : le relevé
  // des réponses ne rapproche que par l'empreinte de l'adresse, nulle pour un relais
  // (`reponses-entrantes-candidature.ts`), et il n'existe aucune file « à vérifier »
  // pour les e-mails. Cf. rapport de vérification.
  test.fixme("V1-A-3 — une réponse depuis l'adresse relais tombe « à vérifier »", async () => {
    const indeed = relais();
    const id = await ajouter({
      prenom: "Ewen",
      nom: "Banc-Essai",
      email: indeed,
      origine: "indeed",
      envoyerInvitation: false,
    });
    idsRelais.push(id);
    const recu = plus(new Date(), { minutes: -5 });
    const releve = await etape<{ reconnus: number }>({
      etape: "releve-reponses",
      args: {
        maintenant: new Date().toISOString(),
        messages: [{ cle: id, de: indeed, recuLe: recu.toISOString(), sujet: "Re: candidature" }],
      },
    });
    expect(releve.valeur.reconnus).toBe(1);
    expect(await prisma.jobApplicationInboundReply.count({ where: { applicationId: id } })).toBe(1);
  });
});
