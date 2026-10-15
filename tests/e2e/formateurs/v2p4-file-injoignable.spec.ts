// @formateurs V2P4 — La file d'e-mails est injoignable quand le passage veut relancer
// le contrat-cadre (F18), puis elle revient. La relance repart-elle UNE seule fois ?
// Le lien de signature du formateur survit-il à l'essai raté ?
//
// « Injoignable » : pour le SEUL processus du passage, `REDIS_URL` pointe vers un relais
// tenu par ce spec, qui sert les réglages et les caches mais refuse toute commande de
// la file d'e-mails (BullMQ). Le worker, la vraie file et les autres scénarios ne sont
// pas touchés. (Redis entièrement coupé, les interrupteurs deviennent illisibles et
// rien ne part : c'est la position sûre, constatée à part.)

import { connect, createServer, type Server } from "node:net";

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";
import { executerScenarioV2p } from "../fixtures/formateurs/v2p-execution";

interface Ligne {
  template: string;
  status: string;
}
interface Passage {
  bilan: { envoyes?: number; ecartes?: Record<string, number>; leve?: string };
  lignes: Ligne[];
  liensVivants: number;
  liens: number;
}
interface Fiche {
  trainerId: string;
  email: string;
  documentId: string;
}

/**
 * Un relais vers le Redis du banc qui laisse tout passer (réglages, caches), SAUF la
 * file BullMQ : dès qu'une connexion touche une clé `bull:`, elle reçoit une erreur à
 * chacune de ses commandes. La file est injoignable, le reste du processus ne l'est pas.
 */
function fileInjoignable(): Promise<{ serveur: Server; url: string }> {
  const amont = new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  return new Promise((resolve) => {
    const serveur = createServer((client) => {
      const redis = connect(Number(amont.port || 6379), amont.hostname);
      let file = false;
      client.on("data", (morceau) => {
        const texte = morceau.toString("latin1");
        if (texte.includes("bull:")) file = true;
        if (!file) {
          redis.write(morceau);
          return;
        }
        // Une erreur par commande du morceau (chaque commande commence par `*`).
        const n = Math.max(1, (texte.match(/(^|\r\n)\*\d+\r\n\$/g) ?? []).length);
        client.write("-ERR banc : file injoignable\r\n".repeat(n));
      });
      redis.on("data", (d) => client.write(d));
      const fermer = () => {
        client.destroy();
        redis.destroy();
      };
      client.on("error", fermer);
      redis.on("error", fermer);
      client.on("close", fermer);
      redis.on("close", fermer);
    });
    serveur.listen(0, "127.0.0.1", () => {
      const adresse = serveur.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      resolve({ serveur, url: `redis://127.0.0.1:${port}` });
    });
  });
}

const f18 = (l: readonly Ligne[]) =>
  l.filter((x) => x.template === "formateur-contrat-relance").map((x) => x.status);

test.describe("@formateurs V2P4 — file injoignable, puis rétablie", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  let decor: DecorScenario;
  let fiche: Fiche;
  let enPanne: Passage;
  let retablie: Passage;
  let encore: Passage;

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p4");
    fiche = await executerScenarioV2p<Fiche>("v2p4-file-injoignable", { phase: "preparer" });
    const panne = await fileInjoignable();
    try {
      enPanne = await executerScenarioV2p<Passage>(
        "v2p4-file-injoignable",
        { phase: "passer", injoignable: true, ...fiche },
        { REDIS_URL: panne.url },
      );
    } finally {
      panne.serveur.close();
    }
    retablie = await executerScenarioV2p<Passage>("v2p4-file-injoignable", {
      phase: "passer",
      ...fiche,
    });
    encore = await executerScenarioV2p<Passage>("v2p4-file-injoignable", {
      phase: "passer",
      ...fiche,
    });
  });
  test.afterAll(async () => {
    if (fiche) {
      await viderPuitsPour(fiche.email);
      await executerScenarioV2p("v2p4-file-injoignable", { phase: "nettoyer", ...fiche });
    }
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("file en panne : rien ne part, et aucune ligne « en attente » ne reste", () => {
    expect(enPanne.bilan.envoyes ?? 0).toBe(0);
    expect(f18(enPanne.lignes)).not.toContain("sent");
    expect(f18(enPanne.lignes)).not.toContain("pending");
  });

  test("file rétablie : F18 repart UNE fois, et le passage suivant n'en refait pas", () => {
    expect(retablie.bilan.envoyes).toBe(1);
    expect(f18(retablie.lignes).filter((s) => s === "sent")).toHaveLength(1);
    expect(encore.bilan.envoyes).toBe(0);
    expect(f18(encore.lignes).filter((s) => s === "sent")).toHaveLength(1);
  });

  test("le formateur garde toujours un lien de signature vivant", () => {
    expect(enPanne.liensVivants).toBe(1);
    expect(retablie.liensVivants).toBe(1);
  });

  // V2-P-6 — l'essai raté émet quand même un nouveau lien de signature, qui révoque
  // celui de F16 : jusqu'au passage suivant, le seul lien que le formateur a reçu ne
  // marche plus, et aucun e-mail ne lui a apporté le nouveau.
  test.fixme("V2-P-6 — file en panne : aucun lien n'est émis, celui de F16 reste valable", () => {
    expect(enPanne.liens).toBe(1);
  });
});
