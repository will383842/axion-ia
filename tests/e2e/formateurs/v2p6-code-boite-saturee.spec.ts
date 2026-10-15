// @formateurs V2P6 — Boîte saturée : le code de signature F17 (valable 15 minutes)
// attend dans la file au-delà de sa validité. Part-il quand même, avec un code mort ?
//
// Le formateur retenu remplit son dossier, puis demande son code (« Recevoir mon
// code »). La boîte est saturée : le quota de 40 envois de l'heure est atteint
// (compteur du limiteur BullMQ du worker), F17 attend. Les 15 minutes d'attente
// sont représentées par la DONNÉE, jamais par l'horloge : l'échéance du code est
// avancée pendant que F17 attend. À la levée du bridage, le worker relit l'état au
// départ : un code expiré ne devrait pas partir (ou un code neuf devrait le remplacer).

import { Redis } from "ioredis";

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { actionDossier, formateurRetenu, preparerDossier } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

const BRIDAGE_MS = 20_000;

test.describe("@formateurs V2P6 — F17 retardé au-delà de sa validité", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);
  let decor: DecorScenario;
  let f17: Array<{ status: string; error: string | null }> = [];
  let codeExpireAuDepart = false;

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p6", { organisme: true });
    const email = decor.adresse("code-tardif");
    const { fiche, lien } = await formateurRetenu(email, "Soline", decor.admin);
    const registre = await preparerDossier(lien, "Soline");

    // La boîte est pleine : tout ce qui est enfilé attend la levée du bridage.
    const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 2,
    });
    try {
      await redis.set("bull:emails:limiter", "40", "PX", BRIDAGE_MS);
    } finally {
      redis.disconnect();
    }
    const demande = await actionDossier(lien, "code", {}, { registre });
    expect(demande.valeur.ok, demande.valeur.message).toBe(true);
    // Les 15 minutes d'attente passent (donnée) : le code envoyé n'est plus valable.
    const contrat = await prisma.documentGenere.findFirstOrThrow({
      where: { trainerId: fiche.id, type: "contrat_sous_traitance", annuleeAt: null },
      select: { id: true },
    });
    const expire = await prisma.documentSignatureCode.updateMany({
      where: { documentGenereId: contrat.id, utiliseAt: null, invalideAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    codeExpireAuDepart = expire.count === 1;
    await attendreLeWorker(email);
    f17 = await prisma.emailLog.findMany({
      where: { recipient: email, template: "formateur-code-signature" },
      select: { status: true, error: true },
    });
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("témoin : F17 a été enfilé pendant que la boîte était pleine, puis traité", () => {
    expect(codeExpireAuDepart).toBe(true);
    expect(f17).toHaveLength(1);
    expect(f17[0]?.status).not.toBe("pending");
  });

  // V2-P-7 — le worker n'a aucune relecture au départ pour F17 : un code mort part.
  test.fixme("V2-P-7 — un code expiré pendant l'attente ne part pas", () => {
    expect(f17.map((l) => l.status)).not.toContain("sent");
  });
});
