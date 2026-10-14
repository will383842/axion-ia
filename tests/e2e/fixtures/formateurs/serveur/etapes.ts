// Banc @formateurs — l'EXÉCUTEUR DES ÉTAPES d'un scénario, lancé par `tsx`.
//
// Même principe que `executer.ts` (le code serveur RÉEL, hors du chargeur de
// Playwright), avec ce qu'une vérification de parcours exige en plus :
//
//   · les ACTIONS DE LA CONSOLE appelées telles quelles (« Ajouter un candidat »,
//     « Retenu », « Contresigner »…) : garde de session, habilitations,
//     transactions et envois s'exécutent. Le processus est lancé avec
//     `contexte-console.mjs`, qui ne remplace que ce que Next fournit à une
//     action (session déclarée par le spec, requête sans cookie, invalidation
//     vide) ;
//   · les PASSAGES PLANIFIÉS appelés avec le `maintenant` du spec ;
//   · un RÉSEAU coupé, sauf l'API Calendly simulée (les rendez-vous du spec) et
//     le registre des entreprises simulé (la réponse demandée par le spec).
//     Tout autre appel — Telegram, Meta, Plausible… — est refusé ET noté : le
//     spec constate ainsi ce qui a tenté de sortir.
//
// Une étape = une fonction nommée ci-dessous. Elle rend du JSON ; le spec
// constate le reste en base, au journal des envois et dans le puits SMTP.

import { registreSimule } from "../registre-entreprises";
import { MARQUEUR_RESULTAT, type EntreeEtape } from "../protocole";
import { installerReseauSimule, type RouteSimulee } from "../reseau-simule";
import { apiCalendlySimulee } from "./api-calendly-simulee";
import { ETAPES } from "./etapes-catalogue";

/** ⛔ Jamais ailleurs que sur une base locale : le banc écrit et efface. */
function exigerBaseLocale(): void {
  let hote = "";
  try {
    hote = new URL(process.env["DATABASE_URL"] ?? "").hostname;
  } catch {
    // URL illisible : refusée ci-dessous.
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(`banc @formateurs : base non locale refusée (hôte « ${hote || "?"} »)`);
  }
}

function routeRegistre(reponse: NonNullable<EntreeEtape["registre"]>): RouteSimulee {
  const simule = registreSimule(reponse);
  return (url, init) =>
    url.host === "recherche-entreprises.api.gouv.fr" ? simule.fetch(url.href, init) : null;
}

async function principal(): Promise<void> {
  exigerBaseLocale();
  const brute = process.env["BANC_ENTREE"];
  if (!brute) throw new Error("banc @formateurs : BANC_ENTREE absente");
  const entree = JSON.parse(brute) as EntreeEtape;
  const etape = ETAPES[entree.etape];
  if (!etape) throw new Error(`banc @formateurs : étape inconnue « ${entree.etape} »`);

  const routes: RouteSimulee[] = [apiCalendlySimulee(entree.calendly ?? [])];
  if (entree.registre) routes.push(routeRegistre(entree.registre));
  const reseau = installerReseauSimule(routes);
  try {
    const valeur = await etape(entree.args ?? {}, entree);
    process.stdout.write(
      `\n${MARQUEUR_RESULTAT}${JSON.stringify({ valeur: valeur ?? null, reseau: reseau.journal })}\n`,
    );
  } finally {
    reseau.restaurer();
  }
}

principal().then(
  // Sortie explicite : Prisma et Redis gardent des connexions ouvertes.
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  },
);
