// Banc @formateurs, VÉRIFICATION 2 — équipe A : l'EXÉCUTEUR côté serveur, lancé par
// `tsx` (voir `serveur/executer.ts` : Playwright ne charge pas `@sentry/nextjs`).
//
// Joue une liste d'étapes `v2a-protocole.ts` contre le code serveur RÉEL et la base du
// banc, puis rend une ligne `@@BANC-V2A@@[résultats]`. Le réseau est coupé
// (`reseau-simule.ts`). Le seul réglage posé (l'interrupteur du bilan de fin de
// formation, pour « payer quand même ») l'est le temps de l'étape, puis rendu à sa
// valeur d'avant si personne ne l'a changé entre-temps — comme l'exécuteur d'argent.

import { prisma } from "@/lib/prisma";
import { evaluerAlertesDetaille } from "@/server/qualiopi/alertes/evaluateur";
import { payerQuandMemeBilan } from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/service";
import { etatsVirementsMission } from "@/server/qualiopi/formateurs-independants/paiement/virements-a-faire-lecture";
import { lireCumulHonorairesHtCents } from "@/server/qualiopi/formateurs-independants/vigilance-seuil-lecture";

import { installerReseauSimule } from "./reseau-simule";
import { MARQUEUR_RESULTAT_V2A, type EntreeV2a, type EtapeV2a } from "./v2a-protocole";

/** ⛔ Jamais ailleurs que sur une base locale : le banc écrit. */
function exigerBaseLocale(): void {
  let hote = "";
  try {
    hote = new URL(process.env["DATABASE_URL"] ?? "").hostname;
  } catch {
    // illisible : refusé ci-dessous
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(`banc @formateurs (v2a) : base non locale refusée (« ${hote || "?"} »)`);
  }
}

const quand = (iso: string) => new Date(iso);
const CLE_BILAN = "formateurs.bilan_fin_formation";

/** Pose `valeur` sous `cle` le temps de `fn`, puis rend l'état d'avant (si inchangé). */
async function avecReglage<T>(cle: string, valeur: unknown, fn: () => Promise<T>): Promise<T> {
  const avant = await prisma.setting.findUnique({
    where: { key: cle },
    select: { value: true, description: true },
  });
  await prisma.setting.upsert({
    where: { key: cle },
    create: { key: cle, value: valeur as never, description: "banc @formateurs (v2a)" },
    update: { value: valeur as never },
  });
  try {
    return await fn();
  } finally {
    const actuel = await prisma.setting.findUnique({
      where: { key: cle },
      select: { value: true },
    });
    if (actuel && JSON.stringify(actuel.value) === JSON.stringify(valeur)) {
      if (avant === null) await prisma.setting.deleteMany({ where: { key: cle } });
      else
        await prisma.setting.update({
          where: { key: cle },
          data: { value: avant.value as never, description: avant.description },
        });
    }
  }
}

async function jouerEtape(e: EtapeV2a): Promise<unknown> {
  switch (e.etape) {
    case "payer-quand-meme":
      return avecReglage(CLE_BILAN, { actif: true, allumeLe: e.bilanAllumeLe }, async () => {
        const admin = await prisma.adminUser.findFirstOrThrow({ select: { id: true } });
        return payerQuandMemeBilan({
          sessionId: e.sessionId,
          trainerId: e.trainerId,
          adminUserId: admin.id,
          motif: e.motif,
          maintenant: quand(e.maintenant),
        });
      });
    case "etats-virements-mission": {
      const etats = await etatsVirementsMission(e.ids, quand(e.maintenant));
      return Object.fromEntries(
        [...etats].map(([id, v]) => [
          id,
          { motifs: v.motifs, fin4: v.fin4, empreinte: v.empreinte },
        ]),
      );
    }
    case "cumul":
      return lireCumulHonorairesHtCents(e.trainerId);
    case "alertes": {
      const cibles = new Set(e.cibles);
      const r = await evaluerAlertesDetaille();
      return {
        reglesEnEchec: r.reglesEnEchec,
        candidates: r.candidates
          .filter((c) => c.cibleId !== null && c.cibleId !== undefined && cibles.has(c.cibleId))
          .map((c) => ({ code: c.code, cibleId: c.cibleId, message: c.message })),
      };
    }
  }
}

async function principal(): Promise<void> {
  exigerBaseLocale();
  const brute = process.env["BANC_ENTREE_V2A"];
  if (!brute) throw new Error("banc @formateurs (v2a) : BANC_ENTREE_V2A absente");
  const { etapes } = JSON.parse(brute) as EntreeV2a;
  const reseau = installerReseauSimule([]);
  const resultats: unknown[] = [];
  try {
    for (const e of etapes) resultats.push(await jouerEtape(e));
  } finally {
    reseau.restaurer();
  }
  process.stdout.write(`\n${MARQUEUR_RESULTAT_V2A}${JSON.stringify(resultats)}\n`);
}

principal().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  },
);
