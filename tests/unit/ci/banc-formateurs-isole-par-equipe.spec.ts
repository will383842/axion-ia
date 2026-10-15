/**
 * Le banc `@formateurs` tourne en UN JOB PAR ÉQUIPE, et chaque spec a son groupe.
 *
 * 2026-10-15. Verts chacun sur sa PR, les scénarios des équipes A, B et D sont
 * devenus rouges une fois réunis dans un seul job sur `main` (run 38663145178) :
 * une base, un Redis et un worker partagés, trois verrous d'équipe qui ne se
 * voient pas. E39 coupait `invitation_auto` pendant qu'E02-E04 attendaient F1,
 * l'allumage de A rallumait `activation_auto` sous ED6, et le journal de
 * cascade d'E39 comptait les bascules des autres. Ce cliquet refuse :
 *
 *   · le retour d'un job unique (la matrice, et son `fail-fast: false`) ;
 *   · une équipe D (interrupteurs mères) lancée avec plus d'un worker ;
 *   · un job agrégé qui disparaît, ou qui passerait « sauté » sur un rouge ;
 *   · un spec `@formateurs` rangé dans aucun groupe, ou dans deux.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { codeYaml, corpsDuJob } from "./lire-un-workflow";

interface Partition {
  parGroupe: Record<string, string[]>;
  orphelins: string[];
  doublons: string[];
}
// Module ESM du banc, sans déclarations de types : chargé par son chemin.
const { GROUPES, partition } = (await import(
  pathToFileURL(path.join(process.cwd(), "scripts/banc-formateurs/groupes.mjs")).href
)) as {
  GROUPES: ReadonlyArray<{ id: string }>;
  partition: (fichiers?: readonly string[]) => Partition;
};

const BANC = codeYaml(".github/workflows/banc-formateurs.yml");

describe("le banc @formateurs est isolé par équipe", () => {
  it("une matrice d'équipes, qui ne s'arrête pas à la première rouge", () => {
    const equipe = corpsDuJob(BANC, "equipe") ?? "";
    expect(equipe).toMatch(/fail-fast: false/);
    for (const g of ["A", "B", "C", "D", "socle"]) {
      expect(equipe).toMatch(new RegExp(`- groupe: ${g}\\n`));
    }
    expect(equipe).toMatch(/groupes\.mjs liste "\$GROUPE"/);
    expect(equipe).toMatch(/groupes\.mjs verifier/);
    // Chaque équipe a ses propres services (sa base, son Redis, son puits).
    expect(equipe).toMatch(/services:\n\s+postgres:/);
    expect(equipe).toMatch(/redis:\n\s+image: redis:/);
    expect(equipe).toMatch(/mailpit:\n\s+image: axllent\/mailpit:/);
  });

  it("l'équipe D, qui coupe les interrupteurs mères, passe sur un seul worker", () => {
    const equipe = corpsDuJob(BANC, "equipe") ?? "";
    expect(equipe).toMatch(/- groupe: D\n[^-]*workers: 1\n/);
    expect(equipe).toMatch(/--workers="\$WORKERS_BANC"/);
  });

  it("le job agrégé garde le nom connu et rougit si une équipe rougit", () => {
    const banc = corpsDuJob(BANC, "banc") ?? "";
    expect(banc).toMatch(/name: Banc formateurs · file, worker, puits SMTP\n/);
    expect(banc).toMatch(/needs: equipe\n/);
    expect(banc).toMatch(/if: \$\{\{ always\(\) \}\}/);
    expect(banc).toMatch(/test "\$RESULTAT" = "success"/);
  });

  it("chaque spec @formateurs appartient à un groupe et un seul", () => {
    const { parGroupe, orphelins, doublons } = partition();
    expect(orphelins).toEqual([]);
    expect(doublons).toEqual([]);
    for (const id of ["A", "B", "D", "socle"]) {
      expect(parGroupe[id]?.length ?? 0, `groupe ${id}`).toBeGreaterThan(0);
    }
  });

  it("les motifs rangent les noms des quatre équipes là où ils doivent", () => {
    const f = (n: string) => `tests/e2e/formateurs/${n}-x.spec.ts`;
    const { parGroupe, orphelins } = partition([
      f("e01"),
      f("e12"),
      f("e33"),
      f("e38"),
      f("e13"),
      f("e19"),
      f("e34"),
      f("eb1"),
      f("e20"),
      f("e26"),
      f("e36"),
      f("ec3"),
      f("e27"),
      f("e30"),
      f("e39"),
      f("e40"),
      f("ed7"),
    ]);
    expect(orphelins).toEqual([]);
    expect(parGroupe["A"]).toEqual([f("e01"), f("e12"), f("e33"), f("e38")]);
    expect(parGroupe["B"]).toEqual([f("e13"), f("e19"), f("e34"), f("eb1")]);
    expect(parGroupe["C"]).toEqual([f("e20"), f("e26"), f("e36"), f("ec3")]);
    expect(parGroupe["D"]).toEqual([f("e27"), f("e30"), f("e39"), f("e40"), f("ed7")]);
    expect(GROUPES.map((g) => g.id)).toEqual(["A", "B", "C", "D", "socle"]);
  });

  it("un spec inconnu n'est pas avalé en silence", () => {
    const { orphelins } = partition(["tests/e2e/formateurs/e99-nouveau.spec.ts"]);
    expect(orphelins).toEqual(["tests/e2e/formateurs/e99-nouveau.spec.ts"]);
  });
});
