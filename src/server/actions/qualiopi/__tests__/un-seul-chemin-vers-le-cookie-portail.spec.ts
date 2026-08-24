/**
 * CLIQUET — il n'y a qu'UN chemin vers le cookie de session du portail, et il
 * est protégé contre le brute-force.
 *
 * ## Le défaut (2026-08-25, balayage des exports sans appelant)
 *
 * 🔴 Deux fonctions échangeaient un token d'accès portail contre le cookie de
 * session :
 *
 * - `app/[locale]/portail/acces/[token]/route.ts` — **avec** un rate-limit de
 *   10 tentatives / 60 s par IP, posé avant la vérification du token ;
 * - `actions/qualiopi/portail.ts` → `accederPortailAction` — **sans**.
 *
 * Ce second fichier porte `"use server"` : chacune de ses fonctions exportées
 * est un **endpoint HTTP**. C'était donc un second chemin d'entrée au portail,
 * dépourvu de la seule protection qui garde le premier.
 *
 * Et il n'avait **aucun appelant de production** — trouvé par le balayage des
 * exports sans appelant, la méthode qui a déjà rendu trois fonctionnalités
 * inatteignables dans ce dépôt.
 *
 * ⚠️ **Le correctif n'a PAS été d'y recopier le rate-limit.** Un prédicat
 * recopié diverge toujours — ce dépôt l'a payé quatre fois. On a retiré le
 * second chemin.
 *
 * ## Ce que ce fichier garde
 *
 * La propriété, pas le symptôme : **un seul site pose le cookie de session**, et
 * ce site porte un rate-limit. Un troisième chemin écrit demain serait vu sans
 * qu'on touche à ce fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * Le code seul, lignes de commentaire écartées.
 *
 * ⚠️ Indispensable ici : le fichier d'où l'action a été retirée **explique** en
 * commentaire pourquoi elle ne doit pas revenir, en la nommant et en nommant
 * `setPortailCookie`. Un extracteur naïf compterait cette explication comme un
 * appel et rendrait un faux rouge. Ce dépôt s'est fait piéger trois fois par ce
 * motif la même journée.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

/** Tous les `.ts` / `.tsx` de production sous `src/`, specs exclues. */
function sourcesDeProduction(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules" || entree === "__tests__") continue;
      sourcesDeProduction(chemin, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (entree.includes(".spec.") || entree.includes(".test.")) continue;
    acc.push(chemin);
  }
  return acc;
}

/** Les fichiers qui APPELLENT `setPortailCookie` (hors sa définition). */
function poseursDuCookie(): string[] {
  return sourcesDeProduction(SRC)
    .filter((f) => !f.endsWith(join("portail", "cookie.ts")))
    .filter((f) => /\bsetPortailCookie\s*\(/.test(codeSeul(f)))
    .map((f) => f.slice(SRC.length + 1));
}

describe("un seul chemin vers le cookie de session du portail", () => {
  it("le balayage voit réellement des fichiers — sinon il ne garde rien", () => {
    // 🔑 CONTRE-TÉMOIN. Si la descente de répertoires cassait, le test central
    // rendrait une liste vide de poseurs et passerait au vert en n'examinant
    // AUCUN fichier — exactement la panne que ce dépôt a payée cinq fois.
    const total = sourcesDeProduction(SRC);
    expect(
      total.length,
      "le balayage ne trouve plus aucun fichier de production sous `src/` : les " +
        "tests suivants ne gardent plus rien.",
    ).toBeGreaterThan(500);
  });

  it("🔴 exactement UN site pose le cookie de session", () => {
    const poseurs = poseursDuCookie();
    expect(
      poseurs,
      "plusieurs chemins posent le cookie de session du portail. C'est le défaut " +
        "du 2026-08-25 : une Server Action le posait sans le rate-limit " +
        "anti-brute-force que porte la route, et sans appelant — un second " +
        "endpoint HTTP d'entrée au portail, non protégé. Si un nouveau chemin est " +
        "légitime, il doit porter le rate-limit ; le plus sûr reste de n'en avoir " +
        "qu'un.",
    ).toHaveLength(1);
  });

  it("🔴 ce site porte un rate-limit AVANT de vérifier le token", () => {
    // Le rate-limit doit précéder la vérification : le placer après laisserait
    // le brute-force consommer la vérification, qui est le travail coûteux et
    // le signal utile à l'attaquant.
    const poseur = poseursDuCookie()[0];
    expect(poseur, "aucun poseur de cookie trouvé").toBeDefined();

    // ⚠️ On compare les positions des APPELS, pas des mentions : le nom suivi
    // d'une parenthèse. Une ligne `import { verifierToken } from …` ne contient
    // PAS `verifierToken(` — c'est le motif lui-même qui distingue l'appel de
    // la mention, aucun filtrage d'imports n'est nécessaire.
    //
    // Premier jet de ce test : rouge parce qu'il comparait des MENTIONS, et
    // l'import en tête de fichier faisait croire que la vérification précédait
    // toujours le rate-limit. Un motif trop naïf accuse à tort.
    const code = codeSeul(join(SRC, poseur ?? ""));
    const iRate = code.indexOf("checkRateLimit(");
    const iVerif = code.indexOf("verifierToken(");

    expect(
      iVerif,
      `${poseur} n'appelle plus \`verifierToken\` : ce test ne mesure plus rien.`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      iRate,
      `${poseur} pose le cookie de session sans aucun rate-limit : le token ` +
        `d'accès au portail redevient brute-forçable.`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      iRate,
      `${poseur} vérifie le token AVANT de rate-limiter : le brute-force consomme ` +
        `la vérification, et l'attaquant garde son signal.`,
    ).toBeLessThan(iVerif);
  });

  it("le contre-témoin : l'extracteur écarte bien les commentaires", () => {
    // 🔑 Sans lui, le test central compterait comme « poseur » le fichier d'où
    // l'action a été retirée — il NOMME `setPortailCookie` dans le commentaire
    // qui explique pourquoi elle ne doit pas revenir.
    const faux = [
      "// elle appelait setPortailCookie( sans rate-limit",
      " * puis setPortailCookie( — interdit désormais",
      "const vrai = 1;",
    ].join("\n");
    const code = faux
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
      .join("\n");

    expect(
      /\bsetPortailCookie\s*\(/.test(code),
      "l'extracteur compte les commentaires comme des appels : il accuserait le " +
        "fichier qui explique le correctif d'être le défaut.",
    ).toBe(false);
    expect(code, "l'extracteur a mangé du vrai code").toContain("const vrai");
  });
});
