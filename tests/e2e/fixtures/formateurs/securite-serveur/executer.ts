// Banc @formateurs, équipe sécurité — l'EXÉCUTEUR des scénarios, lancé par `tsx`.
//
// Même protocole que `serveur/executer.ts` (entrée JSON dans `BANC_ENTREE`,
// une ligne `@@BANC-RESULTAT@@{json}` en sortie), dans un fichier à part pour
// ne pas se marcher dessus entre équipes. Différence : les crochets de
// `crochets.ts` sont posés AVANT tout chargement de `src/`, pour que les
// Server Actions trouvent une session et des cookies.
//
// Un scénario est un module de `scenarios/` dont l'export par défaut reçoit
// les paramètres du spec et rend des OBSERVATIONS (ce que le code a répondu,
// ce qui est en base) ; le spec, lui, porte les `expect`.

import "./crochets";

import { MARQUEUR_RESULTAT } from "../protocole";

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

interface EntreeSecurite {
  readonly scenario: string;
  readonly parametres: unknown;
}

async function principal(): Promise<void> {
  exigerBaseLocale();
  const brute = process.env["BANC_ENTREE"];
  if (!brute) throw new Error("banc @formateurs : BANC_ENTREE absente");
  const entree = JSON.parse(brute) as EntreeSecurite;
  if (!/^[a-z0-9-]+$/.test(entree.scenario)) {
    throw new Error(`banc @formateurs : scénario illisible (${entree.scenario})`);
  }
  const scenario = (await import(`./scenarios/${entree.scenario}.ts`)) as {
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
