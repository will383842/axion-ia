// @formateurs — E07 · SIRET « rouge » déclaré ; opposition aux sollicitations.
//
// (a) La personne déclare un SIRET que le registre dit FERMÉ : aucune invitation
//     ne part, la candidature attend avec son motif (le plan : « rien ne part si le
//     registre des entreprises montre une entreprise fermée », F1).
// (b) La personne s'est opposée aux sollicitations (lien de désinscription) avant
//     le balayage : rien ne part, jamais ; la candidature attend avec son motif et
//     une tuile le dit en console.

import { expect, test } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "../fixtures/formateurs/allumage";
import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { ipSuivante } from "../fixtures/formateurs/parcours";
import { SIRET_BANC } from "../fixtures/formateurs/registre-entreprises";
import {
  attendreLeWorker,
  candidaturesDe,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E07 — SIRET rouge et opposition", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(20 * 60_000);
    decor = await ouvrirScenario("e07");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  async function deposer(email: string, ip: string, siret?: string) {
    const depot = await etape<{ ok: boolean }>({
      etape: "deposer-candidature",
      args: { offre: SLUG_OFFRE_BANC, prenom: "Noé", nom: "Banc-Essai", email, siret },
      ip,
    });
    expect(depot.valeur.ok).toBe(true);
    const [cand] = await candidaturesDe(email);
    if (!cand) throw new Error("candidature absente");
    return cand;
  }

  test("(b) opposée avant le balayage : aucune invitation, jamais", async () => {
    const email = decor.adresse("opposee");
    const cand = await deposer(email, ipSuivante());
    await attendreLeWorker(email);
    const opposition = await etape<{ ok: boolean }>({ etape: "opposer", args: { email } });
    expect(opposition.valeur.ok).toBe(true);

    for (const minutes of [16, 21, 60 * 24]) {
      await etape({
        etape: "passage-invitations",
        args: { maintenant: plus(cand.submittedAt, { minutes }) },
      });
    }
    await attendreLeWorker(email);
    // Seul l'accusé de candidature (antérieur à l'opposition) est parti.
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres).toMatchObject({ invitationFormateurAt: null, status: "new" });
  });

  // V1-A-2 — l'opposition ne laisse AUCUNE trace sur la candidature : le motif n'est
  // écrit nulle part (seul un compteur en mémoire du passage le connaît), la fiche dit
  // « Pas encore invitée. », aucune tuile ne le montre, et la candidature sort de la
  // fenêtre de 72 h sans être close. Cf. rapport de vérification.
  test.fixme("(b) V1-A-2 — la candidature attend AVEC SON MOTIF, et une tuile le dit", async () => {
    const email = decor.adresse("opposee-motif");
    const cand = await deposer(email, ipSuivante());
    await etape({ etape: "opposer", args: { email } });
    await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(cand.submittedAt, { minutes: 16 }) },
    });
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    // Ce que le plan exige : un état lisible qui dit pourquoi rien ne part.
    expect(apres?.invitationFormateurAt).toBeNull();
    expect(JSON.stringify(apres)).toMatch(/opposition/i);
  });

  // V1-A-1 — aucun contrôle du registre avant F1 : le SIRET déclaré au formulaire n'est
  // jamais lu (`invitation-formateurs-faits.ts`, « registreRouge » ne lit que les
  // vérifications d'une fiche formateur, qui n'existe pas encore). F1 part vers une
  // entreprise fermée. Cf. rapport de vérification.
  test.fixme("(a) V1-A-1 — SIRET déclaré « rouge » : aucune invitation, motif conservé", async () => {
    const email = decor.adresse("siret-rouge");
    const cand = await deposer(email, ipSuivante(), SIRET_BANC);
    expect(cand.answers).toBeTruthy();
    await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(cand.submittedAt, { minutes: 16 }) },
      registre: "rouge",
    });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres?.invitationFormateurAt).toBeNull();
  });
});
