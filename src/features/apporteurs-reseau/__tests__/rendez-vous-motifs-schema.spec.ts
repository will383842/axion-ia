// L4a : les motifs de la règle « rendez-vous » existent en base (schéma ET migration), et la
// migration du lot 1 (déjà fusionnée) n'est pas réécrite. Lecture de fichiers seule.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const bloc = (nom: string): string =>
  schema.match(new RegExp(`model ${nom} \\{[\\s\\S]*?\\n\\}`))![0];

describe("L4a — colonnes de motif", () => {
  it("PropositionRendezVousPresentation porte ecarteeMotif et ecarteeNotifieeAt", () => {
    const b = bloc("PropositionRendezVousPresentation");
    expect(b).toMatch(/ecarteeMotif\s+String\?\s+@map\("ecartee_motif"\)\s+@db\.Text/);
    expect(b).toMatch(/ecarteeNotifieeAt\s+DateTime\?\s+@map\("ecartee_notifiee_at"\)/);
  });

  it("PresentationReservation porte validationMotif", () => {
    expect(bloc("PresentationReservation")).toMatch(
      /validationMotif\s+String\?\s+@map\("validation_motif"\)\s+@db\.Text/,
    );
  });

  it("une migration neuve, additive et rejouable, pose les trois colonnes", () => {
    const dossiers = readdirSync(join(RACINE, "prisma/migrations")).filter((d) =>
      d.includes("apporteurs_rdv_motifs"),
    );
    expect(dossiers).toHaveLength(1);
    const dossier = dossiers[0] ?? "";
    const sql = readFileSync(join(RACINE, "prisma/migrations", dossier, "migration.sql"), "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n");
    for (const c of ["ecartee_motif", "ecartee_notifiee_at", "validation_motif"])
      expect(sql).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS "${c}"`));
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  });

  it("la migration du lot 1 reste telle que fusionnée (aucune colonne de motif)", () => {
    const sql = readFileSync(
      join(
        RACINE,
        "prisma/migrations/20261125090000_apporteurs_validation_rendez_vous/migration.sql",
      ),
      "utf8",
    );
    expect(sql).not.toContain("_motif");
  });
});
