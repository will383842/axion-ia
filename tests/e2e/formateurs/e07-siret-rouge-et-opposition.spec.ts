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
    test.setTimeout(45 * 60_000);
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

  // V1-A-2 — la candidature d'une personne opposée attend AVEC SON MOTIF : le motif n'est
  // écrit nulle part (le schéma n'a pas de colonne pour lui), il est CALCULÉ à l'affichage
  // avec les mêmes faits que le balayage. L'oracle lit la phrase de la fiche (étape
  // `resume-invitation`), pas la ligne en base.
  test("(b) V1-A-2 — la candidature attend AVEC SON MOTIF, et la fiche le dit", async () => {
    const email = decor.adresse("opposee-motif");
    const cand = await deposer(email, ipSuivante());
    await etape({ etape: "opposer", args: { email } });
    const maintenant = plus(cand.submittedAt, { minutes: 16 }).toISOString();
    await etape({ etape: "passage-invitations", args: { maintenant } });
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres?.invitationFormateurAt).toBeNull();
    const phrase = await etape<string>({
      etape: "resume-invitation",
      args: { candidatureId: cand.id, maintenant },
    });
    expect(phrase.valeur).toMatch(/opposée aux sollicitations/);
    expect(phrase.valeur).not.toMatch(/Pas encore invitée/);
  });

  // V1-A-1 — le SIRET déclaré au formulaire est contrôlé au registre AVANT F1 : une
  // entreprise fermée n'est pas invitée, la candidature attend avec son motif.
  test("(a) V1-A-1 — SIRET déclaré « rouge » : aucune invitation, motif affiché", async () => {
    const email = decor.adresse("siret-rouge");
    const cand = await deposer(email, ipSuivante(), SIRET_BANC);
    expect(cand.answers).toBeTruthy();
    const maintenant = plus(cand.submittedAt, { minutes: 16 }).toISOString();
    await etape({ etape: "passage-invitations", args: { maintenant }, registre: "rouge" });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres?.invitationFormateurAt).toBeNull();
    expect(apres?.clotureSansSuiteAt).toBeNull();
    const phrase = await etape<string>({
      etape: "resume-invitation",
      args: { candidatureId: cand.id, maintenant },
      registre: "rouge",
    });
    expect(phrase.valeur).toMatch(/fermée au registre/);
  });

  test("(a) V1-A-1 — registre muet : pas d'invitation automatique, la candidature attend", async () => {
    const email = decor.adresse("siret-muet");
    const cand = await deposer(email, ipSuivante(), SIRET_BANC);
    const maintenant = plus(cand.submittedAt, { minutes: 16 }).toISOString();
    await etape({ etape: "passage-invitations", args: { maintenant }, registre: "muet" });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres?.invitationFormateurAt).toBeNull();
    const phrase = await etape<string>({
      etape: "resume-invitation",
      args: { candidatureId: cand.id, maintenant },
      registre: "muet",
    });
    expect(phrase.valeur).toMatch(/registre des entreprises n'a pas répondu/);
  });

  test("(a) V1-A-1 — entreprise ouverte au registre : F1 part", async () => {
    const email = decor.adresse("siret-vert");
    const cand = await deposer(email, ipSuivante(), SIRET_BANC);
    await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(cand.submittedAt, { minutes: 16 }).toISOString() },
      registre: "vert",
    });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
    ]);
  });
});
