/**
 * CLIQUET — une colonne `VarChar(n)` doit accueillir la plus longue valeur que
 * son énumération autorise.
 *
 * ## Le défaut, mesuré le 2026-08-25 (cahier D6-1)
 *
 * `ArticleFeedback.type` était déclaré `@db.VarChar(10)`. Le code y écrit
 * `input.type`, validé par `z.enum(["thumbs_up", "thumbs_down"])`.
 *
 * `thumbs_down` fait **onze** caractères.
 *
 * Donc, depuis la création de la table le 2026-05-21, **tout vote négatif était
 * refusé par Postgres** (`value too long for type character varying(10)`), tandis
 * que `thumbs_up` (neuf caractères) passait. Le bouton « pouce vers le bas »
 * n'a jamais rien enregistré.
 *
 * 🔑 **Le défaut n'était visible d'aucun des deux côtés pris isolément.** Le
 * schéma est cohérent ; l'énumération est cohérente ; c'est leur RENCONTRE qui
 * ne l'est pas. Aucun test qui lit l'un des deux ne peut le voir — il faut les
 * croiser. Et TypeScript ne pouvait rien dire : `String` accepte n'importe
 * quelle longueur, la contrainte ne vit qu'en base.
 *
 * ## Pourquoi ce cliquet lie l'énumération au MODÈLE, pas au nom du champ
 *
 * Une première version comparait les champs par leur **nom**. Elle a rendu
 * trente-six faux positifs : un champ nommé `type` existe dans vingt modèles, et
 * elle rapprochait le `type` de JSON-LD (`"AdministrativeArea"`, 18 caractères)
 * de la colonne `ArticleFeedback.type`. C'est exactement le piège que ce dépôt a
 * déjà payé : *lire le nom, jamais le type.*
 *
 * Ici, un fichier n'est examiné que s'il **écrit vraiment** dans le modèle
 * (`prisma.<modèle>.create|update|upsert`), et l'énumération n'est retenue que
 * si son nom de champ existe **dans ce modèle-là**.
 *
 * ## Ce que ce cliquet ne voit PAS — dit franchement
 *
 * Il ne suit pas une valeur à travers plusieurs fichiers, ni une énumération
 * construite dynamiquement. Il attrape la forme fréquente — `z.enum` déclaré et
 * écrit dans le même module — et rien de plus. Un contre-témoin vérifie qu'il
 * examine réellement des couples, pour qu'il ne devienne pas vert en cessant de
 * regarder.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

/** `Modele` → `{ champ: limite }`, pour les seules colonnes `VarChar`. */
function colonnesEtroites(): Map<string, Map<string, number>> {
  const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf-8");
  const parModele = new Map<string, Map<string, number>>();
  let modele: string | null = null;
  for (const ligne of schema.split(/\r?\n/)) {
    const mm = /^model (\w+)/.exec(ligne.trim());
    if (mm) {
      modele = mm[1] ?? null;
      if (modele) parModele.set(modele, new Map());
      continue;
    }
    const mc = /^\s*(\w+)\s+String\??\s+.*@db\.VarChar\((\d+)\)/.exec(ligne);
    if (mc && modele) {
      parModele.get(modele)?.set(mc[1] ?? "", Number(mc[2]));
    }
  }
  return parModele;
}

/** Nom d'appel Prisma (`articleFeedback`) → nom de modèle (`ArticleFeedback`). */
function nomsDAppel(parModele: Map<string, Map<string, number>>): Map<string, string> {
  const m = new Map<string, string>();
  for (const modele of parModele.keys()) {
    m.set(modele.charAt(0).toLowerCase() + modele.slice(1), modele);
  }
  return m;
}

function sourcesTs(depart: string): string[] {
  const sorties: string[] = [];
  const pile = [depart];
  while (pile.length > 0) {
    const dossier = pile.pop();
    if (dossier === undefined) continue;
    for (const entree of readdirSync(dossier)) {
      if (entree === "node_modules" || entree === ".next") continue;
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) pile.push(chemin);
      else if (/\.tsx?$/.test(entree) && !/\.(spec|test)\./.test(entree)) sorties.push(chemin);
    }
  }
  return sorties;
}

interface Couple {
  readonly fichier: string;
  readonly modele: string;
  readonly champ: string;
  readonly limite: number;
  readonly valeurs: readonly string[];
}

/** Les couples (colonne étroite écrite ici) × (énumération déclarée ici). */
function couplesMesurables(): Couple[] {
  const parModele = colonnesEtroites();
  const appels = nomsDAppel(parModele);
  const ECRITURE = /\bprisma[\w.]*\.(\w+)\s*\.\s*(?:create|update|upsert|createMany|updateMany)\b/g;
  const couples: Couple[] = [];

  for (const fichier of sourcesTs(join(RACINE, "src"))) {
    let texte: string;
    try {
      texte = readFileSync(fichier, "utf-8");
    } catch {
      continue;
    }

    // Quels modèles ce fichier écrit-il ?
    const modelesEcrits = new Set<string>();
    for (const m of texte.matchAll(ECRITURE)) {
      const modele = appels.get(m[1] ?? "");
      if (modele) modelesEcrits.add(modele);
    }
    if (modelesEcrits.size === 0) continue;

    // Quelles énumérations littérales ce fichier déclare-t-il ?
    for (const m of texte.matchAll(/\b(\w+)\s*:\s*z\.enum\(\[([^\]]*)\]/g)) {
      const champ = m[1] ?? "";
      const valeurs = [...(m[2] ?? "").matchAll(/"([^"]*)"/g)].map((v) => v[1] ?? "");
      if (valeurs.length === 0) continue;
      for (const modele of modelesEcrits) {
        const limite = parModele.get(modele)?.get(champ);
        if (limite === undefined) continue;
        couples.push({ fichier, modele, champ, limite, valeurs });
      }
    }
  }
  return couples;
}

describe("une colonne VarChar accueille la plus longue valeur de son énumération", () => {
  it("le balayage trouve réellement des couples colonne × énumération", () => {
    // 🔑 CONTRE-TÉMOIN. Sans lui, un motif cassé rendrait zéro dépassement et le
    // test central passerait au vert **sans avoir croisé quoi que ce soit**.
    // C'est la panne que ce dépôt a payée cinq fois.
    expect(
      couplesMesurables().length,
      "aucun couple (colonne VarChar × z.enum) trouvé : le test suivant ne " +
        "croise plus rien et ne garde donc rien.",
    ).toBeGreaterThanOrEqual(1);
  });

  it("🔴 aucune valeur d'énumération ne dépasse la largeur de sa colonne", () => {
    const debordements = couplesMesurables().flatMap((c) =>
      c.valeurs
        .filter((v) => v.length > c.limite)
        .map(
          (v) =>
            `${c.modele}.${c.champ} VarChar(${c.limite}) ← "${v}" (${v.length}) ` +
            `— ${c.fichier.slice(RACINE.length + 1).replace(/\\/g, "/")}`,
        ),
    );

    expect(
      debordements,
      "Une valeur d'énumération est plus longue que la colonne qui la reçoit. " +
        "TypeScript ne peut PAS le voir (`String` n'a pas de longueur côté TS) : " +
        "l'écriture compile, passe la validation Zod, et Postgres la refuse en " +
        "production avec `value too long for type character varying(n)`. " +
        "C'est ainsi que le vote `thumbs_down` (11 caractères dans un " +
        "VarChar(10)) n'a jamais pu être enregistré pendant trois mois. " +
        "Élargir la colonne par une migration — jamais raccourcir la valeur.",
    ).toEqual([]);
  });

  it("le contre-témoin : le comparateur reconnaît bien un débordement", () => {
    // 🔑 Sans ce cas, le test central rendrait zéro même si sa comparaison ne
    // comparait plus rien.
    const faux: Couple = {
      fichier: "(témoin)",
      modele: "Temoin",
      champ: "type",
      limite: 10,
      valeurs: ["court", "onze_carac"],
    };
    expect(faux.valeurs.filter((v) => v.length > faux.limite)).toEqual([]);

    const debordant: Couple = { ...faux, valeurs: ["thumbs_up", "thumbs_down"] };
    expect(
      debordant.valeurs.filter((v) => v.length > debordant.limite),
      "le comparateur ne distingue plus une valeur trop longue d'une valeur qui " +
        "tient : le test central ne mesure plus rien.",
    ).toEqual(["thumbs_down"]);
  });
});
