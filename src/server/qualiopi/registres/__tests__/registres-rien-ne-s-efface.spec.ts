/**
 * L09 — RIEN NE S'EFFACE dans les registres des réclamations et des incidents.
 *
 * Les journaux du socle (`incident_notes`, `reclamation_etapes`) sont protégés
 * en base par des déclencheurs d'ajout seul. Les deux registres eux-mêmes
 * (`incidents`, `reclamations`) ne le sont pas : c'est le code qui doit ne
 * porter AUCUN chemin d'effacement. Ce test lit tout `src/` (hors tests) et
 * rougit au premier `delete` réapparu, comme à la première action exportée
 * qui s'appellerait « supprimer… ».
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__") continue;
      out.push(...fichiers(chemin));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(chemin);
    }
  }
  return out;
}

const MODELES = "incident|incidentNote|reclamation|reclamationEtape";
const EFFACEMENT = new RegExp(
  `\\b(?:prisma|tx|client|db)\\s*\\.\\s*(${MODELES})\\s*\\.\\s*(delete|deleteMany)\\b`,
  "g",
);

describe("registres des réclamations et des incidents — rien ne s'efface", () => {
  const sources = fichiers(SRC).map((f) => ({
    f: relative(process.cwd(), f),
    texte: readFileSync(f, "utf-8"),
  }));

  it("témoin : l'analyse voit bien les services des deux registres", () => {
    const noms = sources.map((s) => s.f.replace(/\\/g, "/"));
    expect(noms).toContain("src/server/qualiopi/registres/incidents-service.ts");
    expect(noms).toContain("src/server/qualiopi/registres/reclamations-service.ts");
  });

  it("🔴 aucun code n'efface un incident, une réclamation, une note ou une étape", () => {
    const trouves = sources.flatMap((s) =>
      [...s.texte.matchAll(EFFACEMENT)].map((m) => `${s.f} : ${m[0]}`),
    );
    expect(trouves).toEqual([]);
  });

  it("🔴 aucune action ni aucun service n'exporte un « supprimer » sur ces registres", () => {
    const modules = [
      "src/server/actions/qualiopi/incidents.ts",
      "src/server/actions/qualiopi/reclamations.ts",
      "src/server/qualiopi/registres/incidents-service.ts",
      "src/server/qualiopi/registres/reclamations-service.ts",
    ];
    const exports = modules.flatMap((m) =>
      [
        ...readFileSync(join(process.cwd(), m), "utf-8").matchAll(
          /^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm,
        ),
      ].map((e) => `${m}#${e[1]}`),
    );
    expect(exports.length).toBeGreaterThan(8);
    expect(exports.filter((n) => /#(supprimer|delete|effacer)/i.test(n))).toEqual([]);
  });

  it("contre-témoin : un effacement ajouté serait vu", () => {
    const faux = "await prisma.incident.delete({ where: { id } });";
    expect([...faux.matchAll(EFFACEMENT)].length).toBe(1);
  });
});
