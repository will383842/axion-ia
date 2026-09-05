import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * **LA GARDE QUI VÉRIFIE QUE LA RÉCIPROQUE MORD.**
 *
 * `pnpm admin-nav:routes-check` porte, depuis le 2026-09-05, une troisième
 * passe : une route admin livrée **sans aucune entrée de menu** n'était gardée
 * par rien. Elle existe, elle répond, elle expose des données, et personne ne
 * l'ouvre — ou pire, on la croit retirée.
 *
 * ═══ CE QUE CE FICHIER DOIT PROUVER, ET QUI NE VA PAS DE SOI ═══
 *
 * ⚠️ **QU'ELLE ROUGIT.** Une garde qu'on n'a jamais vue refuser n'est pas une
 *    garde. On fabrique donc un vrai écran sans entrée de menu, et on affirme
 *    le code 1.
 *
 * ⚠️ **QU'ELLE NE ROUGIT PAS SUR LA NOUVEAUTÉ.** C'est le test qui compte le
 *    plus. La MÊME adresse, avec un corps de simple redirection, doit PASSER —
 *    sinon la passe ne juge pas le contenu de la page mais le fait qu'un
 *    fichier soit apparu, et elle interdirait les adresses héritées qu'on garde
 *    délibérément en vie pour les favoris.
 *
 * ⚠️ **QUE LES LIENS ÉPINGLÉS SONT PORTEURS.** La navigation admin a DEUX
 *    sources : `buildAdminNav()` et les destinations épinglées en pied de barre
 *    latérale (`ADMIN_LIENS_EPINGLES`). Un audit du 2026-09-04 n'avait lu que
 *    la première et a compté DOUZE écrans vivants comme orphelins —
 *    `/console-editoriale`, ses dix écrans, et `/agenda` — jusqu'à proposer
 *    leur suppression. Ce test épingle le fait que la seconde source est lue.
 *
 * ⚠️ **ET ON LANCE LA VRAIE COMMANDE, dans un sous-processus.** Ce que la CI
 *    lit, c'est un code de sortie ; un test qui importerait le script
 *    mesurerait un chargement de module. Même raisonnement, et mêmes pièges
 *    Windows (`execSync` et non `execFileSync`, `npx` étant un script shell),
 *    que `mcp-ne-fuit-aucun-chemin-admin.spec.ts`.
 */

const RACINE = resolve(__dirname, "../../..");
const ADMIN_ROOT = join(RACINE, "src/app/[locale]/(admin)/[adminPrefix]");
// ⚠️ PAS de tiret bas en tête. Next traite `_x` comme un dossier PRIVÉ, la
//    garde l'ignore donc — et un témoin nommé `__temoin` ne serait jamais vu :
//    le test rendrait vert en croyant avoir prouvé que la garde rougit. Premier
//    jet de ce fichier, exactement ce piège.
const DOSSIER_TEMOIN = join(ADMIN_ROOT, "temoin-de-garde-reciproque");
const PAGE_TEMOIN = join(DOSSIER_TEMOIN, "page.tsx");
const FICHIER_NAV = join(RACINE, "src/lib/admin-nav.ts");

/** Un écran ordinaire : du JSX, et aucune entrée de menu. */
const ECRAN_ORDINAIRE = `export default function TemoinDeGarde() {
  return <div>Un écran livré sans entrée de menu.</div>;
}
`;

/** La même adresse, mais qui ne fait que rediriger — famille légitime. */
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

/**
 * Écrit un fichier SOURCE PARTAGÉ sans jamais le laisser à moitié écrit.
 *
 * ⚠️ `writeFileSync` n'est pas atomique. Ce fichier-ci mute `admin-nav.ts`, que
 *    d'autres travailleurs Vitest importent au même moment : une lecture tombée
 *    au milieu de l'écriture rendrait une erreur de syntaxe dans un test qui
 *    n'a rien à voir, et le rouge serait impossible à rattacher à sa cause. Un
 *    `rename` sur le même volume, lui, est atomique.
 */
function ecrireAtomiquement(chemin: string, contenu: string): void {
  const provisoire = `${chemin}.temoin-tmp`;
  writeFileSync(provisoire, contenu, "utf8");
  renameSync(provisoire, chemin);
}

/** Lance la vraie commande. Rend le code de sortie et la sortie fusionnée. */
function lancerLaGarde(): { code: number; sortie: string } {
  try {
    const sortie = execSync("npx tsx scripts/check-admin-nav-routes.ts", {
      cwd: RACINE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    const sortie = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    // Un code absent signifie que le PROCESSUS n'a pas démarré — ce n'est pas
    // un refus de la garde, et le confondre rendrait ce fichier menteur.
    if (err.status === undefined) {
      throw new Error(`le sous-processus n'a pas démarré du tout :\n${sortie}`);
    }
    return { code: err.status, sortie };
  }
}

describe("admin-nav:routes-check refuse une route admin sans entrée de menu", () => {
  it("passe sur l'arbre réel — et ANNONCE le compte de chaque famille", () => {
    const { code, sortie } = lancerLaGarde();

    expect(code, `la garde devait passer sur un arbre propre.\n${sortie}`).toBe(0);

    // ⚠️ TÉMOIN POSITIF. Sans ces comptes, la passe pourrait ne rien balayer et
    //    rendre le vert : « aucune route sans entrée » et « je n'ai lu aucune
    //    route » sont indiscernables sur le seul code de sortie.
    const routes = /(\d+) routes admin, toutes justifiées/.exec(sortie);
    expect(routes, `la passe réciproque n'a pas rendu son décompte.\n${sortie}`).not.toBeNull();
    expect(Number(routes?.[1] ?? 0)).toBeGreaterThan(100);

    expect(sortie).toMatch(/écrans de détail/);
    expect(sortie).toMatch(/redirections héritées/);
    expect(sortie).toMatch(/épinglées/);
  });

  it("ROUGIT sur un vrai écran livré sans entrée de menu", () => {
    poserLeTemoin(ECRAN_ORDINAIRE);

    const { code, sortie } = lancerLaGarde();

    expect(code, `un écran sans entrée de menu devait faire ÉCHOUER la garde.\n${sortie}`).toBe(1);
    expect(sortie).toMatch(/sans\s+aucune entrée de menu/);
    expect(sortie).toContain("/temoin-de-garde-reciproque");
  });

  it("PASSE sur la MÊME adresse quand la page ne fait que rediriger", () => {
    // 🔑 Le test le plus important du fichier. S'il rougissait, la passe
    //    jugerait l'APPARITION d'un fichier et non son CONTENU — et
    //    interdirait les adresses héritées qu'on garde en vie pour les favoris.
    poserLeTemoin(SIMPLE_REDIRECTION);

    const { code, sortie } = lancerLaGarde();

    expect(code, `une page de simple redirection devait PASSER.\n${sortie}`).toBe(0);
  });

  it("redevient verte dès que le témoin est retiré", () => {
    poserLeTemoin(ECRAN_ORDINAIRE);
    expect(lancerLaGarde().code).toBe(1);

    nettoyer();
    const { code, sortie } = lancerLaGarde();
    expect(code, `retirer le témoin devait rendre le vert.\n${sortie}`).toBe(0);
  });

  it("lit BIEN les liens épinglés — les neutraliser fait ressortir les douze écrans", () => {
    // 🔴 CE TEST EXISTE À CAUSE D'UN AUDIT QUI S'EST TROMPÉ. Le 2026-09-04,
    //    `/console-editoriale`, ses dix écrans et `/agenda` ont été comptés
    //    comme orphelins et proposés à l'arbitrage — parce que leurs liens
    //    étaient écrits en dur dans `AdminSidebarNav.tsx`, hors du SSOT. Ils
    //    sont épinglés en pied de barre, à la demande explicite de Will.
    const intact = readFileSync(FICHIER_NAV, "utf8");
    const neutralise = intact.replace(
      /export const ADMIN_ROUTES_EPINGLEES: ReadonlyArray<string> =[\s\S]*?;/,
      "export const ADMIN_ROUTES_EPINGLEES: ReadonlyArray<string> = [];",
    );
    // Sans cette assertion, un renommage de la constante ferait passer le
    // remplacement à côté : la garde resterait verte et le test aussi.
    expect(neutralise, "la constante des liens épinglés est introuvable").not.toBe(intact);

    try {
      ecrireAtomiquement(FICHIER_NAV, neutralise);

      const { code, sortie } = lancerLaGarde();

      expect(code, `neutraliser les liens épinglés devait faire ÉCHOUER la garde.\n${sortie}`).toBe(
        1,
      );
      expect(sortie).toMatch(/12 route\(s\) admin sans aucune entrée de menu/);
      expect(sortie).toContain("- /agenda");
      expect(sortie).toContain("- /console-editoriale");
    } finally {
      ecrireAtomiquement(FICHIER_NAV, intact);
    }

    expect(readFileSync(FICHIER_NAV, "utf8"), "l'arbre doit être restauré à l'octet près").toBe(
      intact,
    );
    expect(lancerLaGarde().code, "et la garde doit être redevenue verte").toBe(0);
  });
});
