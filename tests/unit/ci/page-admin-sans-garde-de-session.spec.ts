import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * **LA GARDE QUI VÉRIFIE QUE `admin-gardes:check` MORD.**
 *
 * `pnpm admin-gardes:check` refuse une page de la console qui ne consulte
 * aucune session côté serveur. C'est la leçon du contournement du 2026-09-05 :
 * une URL d'administration finissant par une extension sortait du proxy — donc
 * de la SEULE authentification du périmètre — et 48 écrans s'ouvraient d'un
 * coup. Le trou est fermé (#1000) ; ce que cette garde empêche, c'est que le
 * périmètre retienne un jour à cette unique couche.
 *
 * ═══ CE QUE CE FICHIER DOIT PROUVER, ET QUI NE VA PAS DE SOI ═══
 *
 * ⚠️ **QU'ELLE ROUGIT.** Une garde qu'on n'a jamais vue refuser n'est pas une
 *    garde. On pose donc un vrai écran sans garde, et on affirme le code 1 ET
 *    la présence de son adresse dans le message — un rouge pour une autre
 *    raison passerait autrement pour une preuve.
 *
 * ⚠️ **QU'ELLE VERDIT SUR LA MÊME PAGE UNE FOIS GARDÉE.** C'est le test qui
 *    compte le plus : sans lui, la garde pourrait refuser tout fichier nouveau
 *    plutôt que juger son CONTENU, et personne ne verrait la différence tant
 *    qu'on ne cherche pas à la fermer.
 *
 * ⚠️ **QU'UNE GARDE POSÉE CÔTÉ CLIENT NE LA CONTENTE PAS.** React 19 ne répare
 *    pas une divergence serveur/client — « This won't be patched up ». Ce que le
 *    serveur a écrit est parti ; un `return null` monté ensuite ne le retire
 *    pas. Une garde qui accepterait `"use client"` donnerait un vert pour un
 *    écran qui fuit quand même.
 *
 * ⚠️ **QU'UNE MENTION EN COMMENTAIRE NE SUFFIT PAS.** Ce n'est pas théorique :
 *    `qualiopi/page.tsx` porte le commentaire « Le garde auth() est conservé »
 *    au-dessus d'un corps qui n'appelle `auth()` nulle part. Le premier
 *    instrument de mesure de ce chantier a compté ce commentaire comme une
 *    garde.
 *
 * ⚠️ **ET ON LANCE LA VRAIE COMMANDE, dans un sous-processus.** Ce que la CI
 *    lit est un code de sortie ; un test qui importerait le script mesurerait
 *    un chargement de module. Mêmes pièges Windows (`execSync` et non
 *    `execFileSync`, `npx` étant un script shell) que ses voisins.
 */

const RACINE = resolve(__dirname, "../../..");
const ADMIN_ROOT = join(RACINE, "src/app/[locale]/(admin)/[adminPrefix]");

// ⚠️ PAS de tiret bas en tête : Next traite `_x` comme un dossier PRIVÉ, et le
//    balayage de la garde l'ignore — un témoin nommé `__temoin` ne serait jamais
//    vu, et ce fichier rendrait vert en croyant avoir prouvé qu'elle rougit.
const DOSSIER_TEMOIN = join(ADMIN_ROOT, "temoin-de-garde-de-session");
const PAGE_TEMOIN = join(DOSSIER_TEMOIN, "page.tsx");
const ROUTE_TEMOIN = "/temoin-de-garde-de-session";

/** Un écran ordinaire qui rend des données sans jamais regarder la session. */
const SANS_GARDE = `export default async function TemoinSansGarde({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  return <div>Écran de témoin : {adminPrefix}</div>;
}
`;

/** Le MÊME écran, gardé par le SSOT. */
const AVEC_GARDE = `import { gardePage } from "@/server/auth/garde-page";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";

export default async function TemoinGarde({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", \`/fr/\${adminPrefix}/login\`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={\`/fr/\${adminPrefix}\`} />;
  }
  return <div>Écran de témoin : {adminPrefix}</div>;
}
`;

/**
 * La même garde, mais posée dans un composant CLIENT.
 *
 * 🔑 Elle a l'air d'une garde et elle n'en est pas une : le serveur a déjà écrit
 *    la réponse quand ce code s'exécute.
 */
const GARDE_COTE_CLIENT = `"use client";

import { gardePage } from "@/server/auth/garde-page";

export default function TemoinClient() {
  const acces = gardePage;
  if (!acces) return null;
  return <div>Écran de témoin</div>;
}
`;

/** Une garde qui n'existe que dans un commentaire. */
const GARDE_EN_COMMENTAIRE = `// Le garde auth() est conservé : sans session, on part vers /login comme
// toutes les pages admin. Voir gardePage() dans server/auth/garde-page.
export default async function TemoinCommentaire({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  return <div>Écran de témoin : {adminPrefix}</div>;
}
`;

/** Une simple redirection : exemptée, et il faut que ça reste vrai. */
const SIMPLE_REDIRECTION = `import { permanentRedirect } from "next/navigation";

export default async function TemoinRedirection({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<never> {
  const { adminPrefix } = await params;
  permanentRedirect(\`/fr/\${adminPrefix}/contacts\`);
}
`;

function nettoyer(): void {
  if (existsSync(DOSSIER_TEMOIN)) rmSync(DOSSIER_TEMOIN, { recursive: true, force: true });
}

afterEach(nettoyer);

function poserLeTemoin(source: string): void {
  mkdirSync(DOSSIER_TEMOIN, { recursive: true });
  writeFileSync(PAGE_TEMOIN, source, "utf8");
}

/** Lance la vraie commande. Rend le code de sortie et la sortie fusionnée. */
function lancerLaGarde(): { code: number; sortie: string } {
  try {
    const sortie = execSync("npx tsx scripts/check-admin-page-guards.ts", {
      cwd: RACINE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    const sortie = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    // Un code absent signifie que le PROCESSUS n'a pas démarré — ce n'est pas un
    // refus de la garde, et le confondre rendrait ce fichier menteur.
    if (err.status === undefined) {
      throw new Error(`le sous-processus n'a pas démarré du tout :\n${sortie}`);
    }
    return { code: err.status, sortie };
  }
}

/** `121 par gardePage, 168 par auth()+refus, …` → le nombre nommé. */
function compteAnnonce(sortie: string, famille: string): number | null {
  const m = sortie.match(new RegExp(`(\\d+)\\s+${famille}`));
  return m ? Number(m[1]) : null;
}

describe("admin-gardes:check refuse une page de console sans garde de session", () => {
  it("passe sur l'arbre réel — et ANNONCE ce qu'il a mesuré", () => {
    const { code, sortie } = lancerLaGarde();
    expect(code, `la garde devait passer sur un arbre propre.\n${sortie}`).toBe(0);

    // 🔴 TÉMOIN POSITIF. Un vert obtenu sans rien mesurer est indiscernable d'un
    //    vrai vert : on exige que le balayage ait vu des pages ET que les deux
    //    familles gardées soient peuplées.
    const total = sortie.match(/(\d+) page\(s\) de la console/);
    expect(total, `la garde n'annonce pas son décompte.\n${sortie}`).not.toBeNull();
    expect(Number(total?.[1] ?? 0), "le balayage ne trouve presque plus de pages").toBeGreaterThan(
      300,
    );
    expect(compteAnnonce(sortie, "par gardePage"), "aucune page par gardePage").toBeGreaterThan(0);
    expect(
      compteAnnonce(sortie, "par auth\\(\\)\\+refus"),
      "aucune page par auth()",
    ).toBeGreaterThan(0);
  });

  it("ROUGIT sur un écran qui ne consulte aucune session — et le NOMME", () => {
    poserLeTemoin(SANS_GARDE);
    const { code, sortie } = lancerLaGarde();
    expect(code, `un écran sans garde devait faire ÉCHOUER la garde.\n${sortie}`).toBe(1);
    expect(sortie).toMatch(/ne consultent AUCUNE session/);
    // Sans cette ligne, un rouge pour une tout autre raison passerait pour une preuve.
    expect(sortie).toContain(ROUTE_TEMOIN);
  });

  it("VERDIT sur le MÊME écran une fois gardé — elle juge le contenu, pas la nouveauté", () => {
    poserLeTemoin(AVEC_GARDE);
    const { code, sortie } = lancerLaGarde();
    expect(code, `le même écran, gardé, devait PASSER.\n${sortie}`).toBe(0);
  });

  it("ROUGIT sur une garde posée CÔTÉ CLIENT — le serveur a déjà écrit la réponse", () => {
    poserLeTemoin(GARDE_COTE_CLIENT);
    const { code, sortie } = lancerLaGarde();
    expect(code, `une garde côté client ne dé-rend rien : elle devait ÉCHOUER.\n${sortie}`).toBe(1);
    expect(sortie).toContain(ROUTE_TEMOIN);
  });

  it("ROUGIT sur une garde qui n'existe que dans un COMMENTAIRE", () => {
    poserLeTemoin(GARDE_EN_COMMENTAIRE);
    const { code, sortie } = lancerLaGarde();
    expect(code, `un commentaire n'est pas une garde : elle devait ÉCHOUER.\n${sortie}`).toBe(1);
    expect(sortie).toContain(ROUTE_TEMOIN);
  });

  it("laisse passer une SIMPLE REDIRECTION — les adresses héritées restent vivantes", () => {
    poserLeTemoin(SIMPLE_REDIRECTION);
    const { code, sortie } = lancerLaGarde();
    expect(code, `une page de simple redirection devait PASSER.\n${sortie}`).toBe(0);
  });

  it("redevient verte une fois le témoin retiré", () => {
    poserLeTemoin(SANS_GARDE);
    expect(lancerLaGarde().code, "le témoin devait d'abord faire rougir").toBe(1);
    nettoyer();
    const { code, sortie } = lancerLaGarde();
    expect(code, `retirer le témoin devait rendre le vert.\n${sortie}`).toBe(0);
  });
});
