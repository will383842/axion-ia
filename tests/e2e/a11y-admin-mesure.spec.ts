// MESURE d'accessibilité de la console — outil de lot, PAS une gate.
//
// 🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'ASSERTE (PRESQUE) RIEN.
//
// `a11y-admin.spec.ts` couvre 18 écrans sur 242 routes statiques. Sa propre
// doctrine interdit d'en ajouter à l'aveugle :
//
//   « On n'ajoute à une gate bloquante que du vert VÉRIFIÉ. Ajouter des écrans
//     non mesurés ouvrirait un rouge que personne ne peut fermer dans sa propre
//     PR. Ne jamais inscrire un écran sur la foi d'un relevé ancien : le code
//     bouge. »
//
// Mesurer 224 écrans à la main est le travail que personne n'a fait depuis
// 2026-08-28 — pas par négligence, parce qu'il n'y avait pas d'outil. Ce
// fichier EST l'outil : il balaie une liste de routes, relève les violations
// `serious`/`critical`, et écrit un rapport. Il ne fait échouer la suite que si
// la MESURE elle-même n'a pas eu lieu.
//
// 🔑 LA DISTINCTION EST LE POINT DU FICHIER. Un outil de mesure qui rougit sur
// les défauts qu'il découvre devient une gate que personne n'ose lancer, et le
// lot suivant ne part jamais. Celui-ci rend un rapport ; c'est un HUMAIN qui
// décide ensuite quoi corriger et quels écrans inscrire dans la gate.
//
// Usage :
//   ADMIN_SEED_EMAIL=… ADMIN_SEED_PASSWORD=… \
//     pnpm exec playwright test --project=chromium --grep @a11y-mesure
//   → écrit `_AUDIT/a11y-console-<horodatage>.json`
//
// ⚠️ Comme `a11y-admin.spec.ts`, ce fichier SE CONNECTE : il refuse toute cible
// distante. Le laisser pointer la production ferait taper des identifiants de
// recette sur un environnement qui n'est pas le nôtre.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import { loginAsAdmin, ADMIN_PREFIX } from "./fixtures/admin-auth";

/**
 * Les routes à mesurer, passées par variable d'environnement.
 *
 * Une liste EXTERNE, et pas une constante : un lot mesure ce qu'il a décidé de
 * mesurer, et le fichier n'a pas à être modifié pour chaque passe. Sans elle,
 * on retombe sur le défaut d'origine — une liste figée que personne ne met à
 * jour.
 */
function entreesBrutes(): string[] {
  return (process.env["A11Y_ROUTES"] ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r !== "");
}

function routesAMesurer(): string[] {
  return entreesBrutes().filter((r) => r.startsWith("/"));
}

/**
 * Les entrees que le filtre a ECARTEES.
 *
 * 🔴 MESURE, PAS PRECAUTION. Au premier essai reel, la route `/` a disparu
 * SANS UN MOT : Git Bash sur Windows convertit un `/` nu en chemin Windows, et
 * `A11Y_ROUTES="/,/avis"` arrive au processus comme
 * `"C:/Program Files/Git/,/avis"`. Le filtre a fait son travail — la valeur ne
 * commencait plus par `/` — et le rapport a annonce « 2 routes, toutes
 * propres » pour trois routes demandees.
 *
 * 🔑 C'est le pire mode de panne pour un outil de MESURE : il ne rend pas un
 * faux positif, il rend un vrai resultat sur un perimetre AMPUTE. Un lot de
 * cinquante ecrans dont trois seraient manges livrerait « 47, tous verts », et
 * les trois entreraient plus tard dans la gate sur la foi d'un releve qui ne
 * les a jamais regardes.
 *
 * ⚠️ Contournement pour l'appelant : `MSYS_NO_PATHCONV=1`, ou ecrire la racine
 * `//` plutot que `/`.
 */
function entreesEcartees(): string[] {
  return entreesBrutes().filter((r) => !r.startsWith("/"));
}

function urlDeBase(): string {
  return process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
}

function cibleLocale(): boolean {
  const base = urlDeBase();
  return base.includes("localhost") || base.includes("127.0.0.1");
}

function identifiantsFournis(): boolean {
  return (
    (process.env["ADMIN_SEED_EMAIL"] ?? "") !== "" &&
    (process.env["ADMIN_SEED_PASSWORD"] ?? "") !== ""
  );
}

interface ReleveEcran {
  route: string;
  atteint: boolean;
  violations: Array<{ id: string; impact: string; nombre: number; premierSelecteur: string }>;
  note?: string;
}

test.describe("mesure a11y de la console @a11y-mesure", () => {
  test.describe.configure({ timeout: 1_800_000 });

  test.skip(
    !cibleLocale() || !identifiantsFournis() || routesAMesurer().length === 0,
    "Cible locale, identifiants de seed ET `A11Y_ROUTES` requis — c'est un outil de lot, " +
      "lancé à la demande, jamais en CI.",
  );

  test("aucune route demandee n'est ecartee en silence", () => {
    const ecartees = entreesEcartees();
    const detail = ecartees.join(" | ");
    expect(
      ecartees,
      `Ces entrees de A11Y_ROUTES ne commencent pas par "/" et n'ont donc PAS ete ` +
        `mesurees : ${detail}. Cause la plus frequente : Git Bash sur Windows convertit ` +
        `un "/" nu en chemin Windows (C:/Program Files/Git/). Relancer avec ` +
        `MSYS_NO_PATHCONV=1, ou ecrire "//" pour la racine. Sans ce controle, le rapport ` +
        `annoncerait un perimetre AMPUTE sans le dire.`,
    ).toEqual([]);
  });

  let contexte: BrowserContext | undefined;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // 🔴 LE `describe.configure` CI-DESSUS NE COUVRE PAS CE CROCHET.
    //
    // Son budget s'applique aux TESTS ; un `beforeAll` garde le défaut de
    // `playwright.config.ts`, soit **30 s**. Or `loginAsAdmin` attend jusqu'à
    // 180 s hors CI : le crochet dispose de trente secondes pour une opération
    // qui en coûte trois fois plus, et le message d'échec accuse le crochet au
    // lieu de la connexion.
    //
    // 🔑 REPRODUIT ICI AVANT D'ÊTRE LU. Ce fichier a échoué au premier
    // lancement sur « "beforeAll" hook timeout of 30000ms exceeded » — la
    // famille exacte que `a11y-admin.spec.ts` documente en tête (« un délai
    // plus long que son budget ne peut jamais expirer ») et que
    // `console-editoriale.spec.ts` corrige déjà de la même façon. Trois
    // fichiers, le même remède : c'est un défaut de PLATEFORME, pas de suite.
    test.setTimeout(300_000);

    contexte = await browser.newContext({ baseURL: urlDeBase() });
    page = await contexte.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await contexte?.close();
  });

  test("relève les violations serious/critical de chaque route", async () => {
    const routes = routesAMesurer();
    const releves: ReleveEcran[] = [];

    for (const route of routes) {
      const url = `/fr/${ADMIN_PREFIX}${route === "/" ? "" : route}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
        // 🔑 La console rend une partie de son contenu APRÈS hydratation. Une
        // mesure prise trop tôt rendrait « 0 violation » pour la mauvaise
        // raison — l'écran n'existe pas encore. C'est le piège déjà payé par
        // ce dépôt sur `/qualiopi/alertes`.
        await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
        await page.locator(".admin-layout-v2, .admin-layout").first().waitFor({ timeout: 30_000 });

        const resultat = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();

        const graves = resultat.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        releves.push({
          route,
          atteint: true,
          violations: graves.map((v) => ({
            id: v.id,
            impact: v.impact ?? "?",
            nombre: v.nodes.length,
            premierSelecteur: String(v.nodes[0]?.target?.[0] ?? ""),
          })),
        });
      } catch (cause) {
        // Un écran inatteignable n'est PAS un écran propre. Le distinguer est
        // tout l'intérêt : sans ça, une route en panne entrerait dans la gate
        // comme « 0 violation ».
        releves.push({
          route,
          atteint: false,
          violations: [],
          note: String(cause).slice(0, 300),
        });
      }
    }

    const dossier = join(process.cwd(), "_AUDIT");
    mkdirSync(dossier, { recursive: true });
    const fichier = join(dossier, `a11y-console-${Date.now()}.json`);
    writeFileSync(fichier, JSON.stringify({ base: urlDeBase(), releves }, null, 2), "utf8");

    const atteints = releves.filter((r) => r.atteint);
    const propres = atteints.filter((r) => r.violations.length === 0);

    // eslint-disable-next-line no-console -- c'est la sortie de l'outil.
    console.log(
      `\n[a11y-mesure] ${releves.length} route(s) — ${atteints.length} atteinte(s), ` +
        `${propres.length} sans violation grave.\nRapport : ${fichier}\n` +
        propres.map((r) => `  VERT  ${r.route}`).join("\n") +
        "\n" +
        atteints
          .filter((r) => r.violations.length > 0)
          .map(
            (r) =>
              `  ROUGE ${r.route} — ${r.violations.map((v) => `${v.id}×${v.nombre}`).join(", ")}`,
          )
          .join("\n"),
    );

    // 🔑 LA SEULE ASSERTION : la mesure a EU LIEU. Dix relevés à zéro peuvent
    // vouloir dire « rien à signaler » ou « je n'ai rien mesuré », et ces deux
    // états sont indiscernables sans témoin positif.
    expect(
      atteints.length,
      "aucune route n'a pu être atteinte : la connexion a échoué, ou le serveur ne répond " +
        "pas. Un rapport de zéro écran ne dit rien de l'accessibilité.",
    ).toBeGreaterThan(0);
  });
});
