/**
 * 🔴 CHANTIER QNC, LOT P9 — TOUT ENVOI DE FORMATION PORTE SON ENTITÉ.
 *
 * Le rattachement d'un e-mail à sa session (`rattacherEnvoisAUneSession`) passe par
 * `entityType` / `entityId`, jamais par l'adresse. Un `enqueueEmail(` sans entité
 * produit un e-mail orphelin : absent du dossier de la session, et — à l'effacement
 * — traité comme « hors dossier ». Ce test balaie le code et refuse l'oubli.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINES = ["src/server/qualiopi", "src/server/actions/qualiopi"];

/**
 * Envois HORS dossier de formation : liste blanche explicite, par fichier.
 * Chaque entrée dit pourquoi l'envoi n'a pas de session à laquelle se rattacher.
 * Vérifié sur origin/main : facturation-hub.ts, trainer-contrat.ts portent déjà
 * leur entité (pas de liste blanche) ; alertes/hors-bande.ts n'est qu'un commentaire.
 */
const HORS_DOSSIER: Readonly<Record<string, string>> = {
  "src/server/qualiopi/portail/rgpd-service.ts":
    "accusé de demande RGPD d'un stagiaire : une personne, pas une session",
  "src/server/qualiopi/remuneration/autofacture-emission.ts":
    "autofacture du formateur : pièce de rémunération, hors dossier",
};

function fichiersSource(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      return nom === "__tests__" || nom === "formateurs-independants" ? [] : fichiersSource(chemin);
    }
    return /\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Retire les commentaires en gardant les longueurs (les positions restent valides). */
export function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`\\])\/\/[^\n]*/g,
      (m, avant: string) => avant + " ".repeat(m.length - avant.length),
    );
}

/** Texte des arguments de chaque appel `enqueueEmail(` (parenthèses équilibrées). */
export function appelsEnqueueEmail(src: string): { ligne: number; args: string }[] {
  const code = sansCommentaires(src);
  const appels: { ligne: number; args: string }[] = [];
  for (const m of code.matchAll(/\benqueueEmail\s*\(/g)) {
    const debut = m.index! + m[0].length;
    let profondeur = 1;
    let i = debut;
    while (i < code.length && profondeur > 0) {
      const c = code[i];
      if (c === "(") profondeur++;
      else if (c === ")") profondeur--;
      i++;
    }
    appels.push({
      ligne: code.slice(0, m.index).split("\n").length,
      args: code.slice(debut, i - 1),
    });
  }
  return appels;
}

const aEntite = (args: string, source = "") => {
  const portee = (t: string) => /\bentityType\b/.test(t) && /\bentityId\b/.test(t);
  if (portee(args)) return true;
  // Options passées par une variable : on lit sa déclaration `const <nom> = {…}`.
  const nom = /,\s*([A-Za-z_$][\w$]*)\s*,?\s*$/.exec(args)?.[1];
  if (nom === undefined) return false;
  const decl = new RegExp(`\\bconst\\s+${nom}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\};`).exec(
    sansCommentaires(source),
  );
  return decl !== null && portee(decl[1]!);
};
describe("tout envoi de formation est rattaché à une entité", () => {
  const fichiers = RACINES.flatMap(fichiersSource);
  const tous = fichiers.flatMap((f) => {
    const source = readFileSync(f, "utf8");
    return appelsEnqueueEmail(source).map((a) => ({
      fichier: f,
      ...a,
      rattache: aEntite(a.args, source),
    }));
  });

  it("le balayage trouve les appels (le test ne tourne pas à vide)", () => {
    expect(tous.length).toBeGreaterThanOrEqual(30);
    expect(fichiers.some((f) => f.includes("formateurs-independants"))).toBe(false);
  });

  it("chaque `enqueueEmail(` porte entityType ET entityId, hors liste blanche", () => {
    const orphelins = tous.filter((a) => !a.rattache && !(a.fichier in HORS_DOSSIER));
    expect(
      orphelins,
      "Envoi sans entité : " +
        orphelins.map((o) => `${o.fichier}:${o.ligne}`).join(", ") +
        ". Ajouter `entityType` et `entityId` aux options de l'envoi ; " +
        "si l'envoi est hors dossier, l'inscrire (avec sa raison) dans HORS_DOSSIER.",
    ).toEqual([]);
  });

  it("la liste blanche ne garde que des fichiers qui ont encore un envoi sans entité", () => {
    const orphelins = new Set(tous.filter((a) => !a.rattache).map((a) => a.fichier));
    expect(Object.keys(HORS_DOSSIER).filter((f) => !orphelins.has(f))).toEqual([]);
  });

  it("le détecteur distingue un envoi rattaché d'un envoi orphelin", () => {
    const src = `
      // enqueueEmail("x", …) en commentaire
      await enqueueEmail("a", to, "fr", p, { entityType: "Enrollment", entityId: id });
      await enqueueEmail("b", to, "fr", f(p), { dedupKey: k });
      const opts = { entityType: "Enrollment", entityId: id };
      await c.enqueueEmail("c", to, "fr", p, opts);
      const autres = { jobId: j };
      await enqueueEmail("d", to, "fr", p, autres);`;
    const appels = appelsEnqueueEmail(src);
    expect(appels).toHaveLength(4);
    expect(appels.map((a) => aEntite(a.args, src))).toEqual([true, false, true, false]);
  });
});
