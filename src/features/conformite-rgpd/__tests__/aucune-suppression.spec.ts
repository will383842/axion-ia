// GARDE-FOU — doctrine du propriétaire : « on garde tout ». Ni route, ni action, ni
// requête ne peut effacer un traitement, un écart ou un incident. Un traitement
// s'archive, un écart corrigé reste visible, un incident se clôt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINES = [
  "src/features/conformite-rgpd",
  "src/components/admin/conformite-rgpd",
  "src/app/[locale]/(admin)/[adminPrefix]/conformite-rgpd",
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === "__tests__" ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

const SOURCES = RACINES.flatMap((r) => fichiers(join(process.cwd(), r))).map((f) => ({
  f,
  texte: readFileSync(f, "utf8"),
}));

describe("Conformité RGPD — aucune suppression", () => {
  it("a bien trouvé le code à surveiller", () => {
    expect(SOURCES.length).toBeGreaterThan(10);
  });

  it.each([
    ["un appel delete / deleteMany", /\.delete(Many)?\s*\(/],
    ["une route DELETE", /export\s+(async\s+)?function\s+DELETE\b/],
    ["du SQL brut", /\$(executeRaw|queryRaw)(Unsafe)?\b/],
    ["une requête DELETE / TRUNCATE / DROP", /\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i],
    ["un bouton ou une action « Supprimer »", /\b[Ss]upprimer\b|\bsupprimer[A-Z]\w*/],
    [
      "une fonction d'effacement",
      /\b(effacer|supprimer|delete|remove)(Traitement|Ecart|Incident)\w*/i,
    ],
  ])("aucun fichier ne contient %s", (_libelle, motif) => {
    const fautifs = SOURCES.filter((s) => motif.test(s.texte)).map((s) => s.f);
    expect(fautifs).toEqual([]);
  });

  it("la migration ne fait que créer", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261011120000_conformite_rgpd_base/migration.sql"),
      "utf8",
    )
      .replace(/^--.*$/gm, "")
      .replace(/ON DELETE RESTRICT/g, "");
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME)\b/i);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    // Additive : aucune table existante n'est modifiée.
    const alteres = [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    expect(alteres.every((t) => t === "ecarts_rgpd")).toBe(true);
  });

  it("le schéma interdit l'effacement en cascade d'un écart avec son traitement", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const bloc = schema.slice(schema.indexOf("model EcartRgpd {"));
    expect(bloc.slice(0, bloc.indexOf("}"))).toMatch(/onDelete: Restrict/);
  });
});
