// Banc @formateurs — l'EXÉCUTEUR côté serveur, lancé par `tsx`.
//
// ── Pourquoi un processus à part ────────────────────────────────────────────
// Le chargeur de modules de Playwright ne sait pas charger `@sentry/nextjs`
// (ni `next/cache`) : tout module serveur qui les importe — la route webhook,
// la découverte Calendly, l'enrichissement — échoue à l'import dans un spec.
// `tsx`, lui, les charge : c'est l'outil avec lequel le worker tourne en
// production (`tsx src/server/queue/worker.ts`) et avec lequel les semis
// tournent en CI. On exécute donc le code serveur RÉEL ici, et le spec ne fait
// que constater en base.
//
// ── Ce que ce processus a de simulé, et rien d'autre ─────────────────────────
//   · son réseau (`reseau-simule.ts`) : l'API Calendly répond, tout le reste
//     est coupé ;
//   · son environnement, posé par `execution.ts` : clé de signature et jeton
//     Calendly FICTIFS, synchro CRM ouverte (l'outbox s'écrit ; rien n'est émis,
//     `BULLMQ_DISABLED` et l'absence d'URL CRM l'interdisent).
// L'horloge n'est jamais truquée : un passage planifié reçoit son `maintenant`
// en paramètre, comme son code le prévoit déjà.
//
// Protocole : l'entrée arrive en JSON dans `BANC_ENTREE`, le résultat repart en
// une ligne `@@BANC-RESULTAT@@{json}` sur la sortie standard.

import type { NextRequest } from "next/server";

// Le banc appelle la ROUTE elle-même, pas une copie de sa logique : c'est la
// seule façon de prouver le chemin « webhook signé » de bout en bout.
// eslint-disable-next-line no-restricted-imports
import { POST as recevoirWebhookCalendly } from "@/app/api/calendly/webhook/route";
import { discoverNewCalendlyEvents } from "@/server/calendly/discover";

import { corpsInviteeCreated } from "../calendly-simule";
import { MARQUEUR_RESULTAT, type EntreeBanc } from "../protocole";
import { installerReseauSimule } from "../reseau-simule";
import { apiCalendlySimulee } from "./api-calendly-simulee";
import { signerLivraisonCalendly } from "./webhook-signe";

/** ⛔ Jamais ailleurs que sur une base locale : le banc écrit et efface. */
function exigerBaseLocale(): void {
  const url = process.env["DATABASE_URL"] ?? "";
  let hote = "";
  try {
    hote = new URL(url).hostname;
  } catch {
    // URL illisible : refusée ci-dessous.
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(`banc @formateurs : base non locale refusée (hôte « ${hote || "?"} »)`);
  }
}

async function executer(entree: EntreeBanc): Promise<unknown> {
  exigerBaseLocale();

  if (entree.action === "livrer-webhook-calendly") {
    const reseau = installerReseauSimule([apiCalendlySimulee([entree.rdv])]);
    try {
      const cle = process.env["CALENDLY_WEBHOOK_SIGNING_KEY"] ?? "";
      const corps = corpsInviteeCreated(entree.rdv);
      // L'instant RÉEL : la route borne la fraîcheur d'une livraison à 5 min
      // contre sa propre horloge, qui n'est jamais truquée.
      const signature = signerLivraisonCalendly(corps, cle, Math.floor(Date.now() / 1000));
      const envoye = entree.alterer ? corps.replace("invitee.created", "invitee.canceled") : corps;
      const requete = new Request("http://localhost:3000/api/calendly/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Calendly-Webhook-Signature": signature,
          "x-forwarded-for": "192.0.2.10",
        },
        body: envoye,
      });
      const reponse = await recevoirWebhookCalendly(requete as unknown as NextRequest);
      const texte = await reponse.text();
      let corpsReponse: unknown = texte;
      try {
        corpsReponse = JSON.parse(texte);
      } catch {
        // Réponse texte (`invalid_signature`…) : gardée telle quelle.
      }
      return { statut: reponse.status, corps: corpsReponse, reseau: reseau.journal };
    } finally {
      reseau.restaurer();
    }
  }

  const reseau = installerReseauSimule([apiCalendlySimulee(entree.rendezVous)]);
  try {
    const issue = await discoverNewCalendlyEvents(Date.parse(entree.maintenant));
    return { issue, reseau: reseau.journal };
  } finally {
    reseau.restaurer();
  }
}

async function principal(): Promise<void> {
  const brute = process.env["BANC_ENTREE"];
  if (!brute) throw new Error("banc @formateurs : BANC_ENTREE absente");
  const resultat = await executer(JSON.parse(brute) as EntreeBanc);
  process.stdout.write(`\n${MARQUEUR_RESULTAT}${JSON.stringify(resultat)}\n`);
}

principal().then(
  // Sortie explicite : Prisma et Redis gardent des connexions ouvertes.
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  },
);
