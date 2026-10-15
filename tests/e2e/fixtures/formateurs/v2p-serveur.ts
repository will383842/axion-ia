// Banc @formateurs, vérification n° 2 (rouge « parcours et e-mails ») — l'EXÉCUTEUR
// des scénarios, lancé par `tsx`.
//
// Mêmes crochets que l'exécuteur de l'équipe sécurité (`securite-serveur/crochets.ts`,
// posés AVANT tout chargement de `src/` : session et cookies pour les Server Actions).
// Un scénario est un module de `tests/e2e/qualiopi/formateurs/v2p/` (zone où le
// domaine Qualiopi peut être importé) ; son export par défaut rend des OBSERVATIONS.

import "./securite-serveur/crochets";

import { MARQUEUR_RESULTAT } from "./protocole";

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

async function principal(): Promise<void> {
  exigerBaseLocale();
  const brute = process.env["BANC_ENTREE"];
  if (!brute) throw new Error("banc @formateurs : BANC_ENTREE absente");
  const entree = JSON.parse(brute) as { scenario: string; parametres: unknown };
  if (!/^v2p[a-z0-9-]+$/.test(entree.scenario)) {
    throw new Error(`banc @formateurs : scénario illisible (${entree.scenario})`);
  }
  const scenario = (await import(`../../qualiopi/formateurs/v2p/${entree.scenario}.ts`)) as {
    default: (parametres: unknown) => Promise<unknown>;
  };
  const resultat = await scenario.default(entree.parametres);
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
