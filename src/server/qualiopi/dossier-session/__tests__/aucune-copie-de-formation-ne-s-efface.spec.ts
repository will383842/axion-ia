/**
 * 🔒 GARDE DE DÉPÔT — chantier QNC, L11 : la copie d'un e-mail de formation ne
 * s'efface par AUCUN chemin, et la cascade `email_logs → email_log_contents`
 * n'est déclenchée par rien qui touche la formation.
 *
 * ## Pourquoi une garde statique
 *
 * `email_log_contents.email_log_id` est en `ON DELETE CASCADE` : supprimer une
 * ligne du journal supprime sa copie, sans un mot. Le schéma ne peut pas être
 * changé dans ce lot (aucune migration — cf. « Besoin de schéma » de la PR) :
 * la protection est donc ici, sur le CODE. Elle échoue si :
 *
 *   · un fichier de production supprime des lignes de `email_logs` ailleurs
 *     que dans la purge de la lettre et du guide, elle-même bornée à deux
 *     gabarits qui ne sont pas de formation ;
 *   · un fichier de production supprime ou modifie une copie ailleurs que dans
 *     l'effacement art. 17 (`rgpd-erase.ts`, qui garde les copies de formation
 *     et n'en réécrit que l'adresse) et l'écrivain de la copie
 *     (`copie-envoi.ts`, création seule interrupteur allumé) ;
 *   · du SQL brut supprime dans l'une de ces deux tables.
 *
 * ⚠️ TÉMOIN POSITIF : la garde vérifie qu'elle trouve bien les écritures
 * qu'elle prétend surveiller. Une garde qui n'inspecte rien passe au vert sans
 * rien garder (#1104).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GABARITS_LETTRE_GUIDE } from "@/server/newsletter/retention";
import { gabaritsClasses } from "../classement";

const RACINE = resolve(__dirname, "../../../../..");
const SRC = join(RACINE, "src");

function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dossier)) {
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) {
      if (e === "node_modules" || e === "__tests__") continue;
      fichiers(chemin, acc);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.(spec|test)\.tsx?$/.test(e)) {
      acc.push(chemin);
    }
  }
  return acc;
}

const SOURCES = fichiers(SRC).map((c) => ({
  chemin: relative(RACINE, c),
  contenu: readFileSync(c, "utf8"),
}));

function qui(motif: RegExp): string[] {
  return SOURCES.filter((s) => motif.test(s.contenu))
    .map((s) => s.chemin)
    .sort();
}

describe("🔒 aucune copie d'e-mail de formation ne s'efface", () => {
  it("seule la purge lettre/guide supprime des lignes du journal", () => {
    expect(qui(/\bemailLog\.delete(Many)?\s*\(/)).toEqual(["src/server/newsletter/retention.ts"]);
  });

  it("…et ses gabarits ne sont pas des e-mails de formation (la cascade ne touche rien de la session)", () => {
    const formation = new Set(gabaritsClasses());
    expect(GABARITS_LETTRE_GUIDE.filter((g) => formation.has(g))).toEqual([]);
    expect(GABARITS_LETTRE_GUIDE.some((g) => g.startsWith("qualiopi-"))).toBe(false);
  });

  it("seul l'effacement art. 17 supprime ou modifie une copie", () => {
    expect(qui(/\bemailLogContent\.(delete|deleteMany|update|updateMany)\s*\(/)).toEqual([
      "src/lib/rgpd-erase.ts",
    ]);
  });

  it("l'écrivain de la copie crée, et ne réécrit qu'interrupteur éteint", () => {
    const ecrivain = SOURCES.find((s) => s.chemin === "src/server/email/copie-envoi.ts")!;
    expect(ecrivain.contenu).toMatch(/emailLogContent\.create\(/);
    expect(qui(/\bemailLogContent\.(create|upsert)\s*\(/)).toEqual([
      "src/server/email/copie-envoi.ts",
    ]);
  });

  it("aucun SQL brut ne supprime dans le journal ni dans les copies", () => {
    expect(qui(/DELETE\s+FROM\s+"?email_log(_content)?s"?/i)).toEqual([]);
    expect(qui(/TRUNCATE[^;]*email_log/i)).toEqual([]);
  });

  it("témoin positif : la garde voit bien les fichiers qu'elle surveille", () => {
    expect(SOURCES.length).toBeGreaterThan(500);
    expect(SOURCES.some((s) => s.chemin === "src/lib/rgpd-erase.ts")).toBe(true);
  });
});
