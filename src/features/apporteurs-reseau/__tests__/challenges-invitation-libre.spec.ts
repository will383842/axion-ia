// Garde-fous du dirigeant : un challenge est une INVITATION LIBRE (risque de salariat, §1.5).
// Les modules qui touchent au contrat, au manquement, à la résiliation ou aux relances
// n'importent AUCUN code de challenge ; aucun envoi d'e-mail ne vient des challenges ; aucun
// champ de rang ou de participants.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AR = join(__dirname, "..");
const lire = (f: string) => readFileSync(join(AR, f), "utf8");
const challenge = readdirSync(AR).filter(
  (f) => /^(challenge-|actions-challenges-)/.test(f) && f.endsWith(".ts"),
);

describe("challenges : invitation libre", () => {
  it("les fichiers de challenge existent", () => {
    expect(challenge.length).toBeGreaterThanOrEqual(4);
  });
  it("aucun module de manquement, résiliation, retrait ni passage quotidien n'importe les challenges", () => {
    for (const f of readdirSync(AR).filter(
      (x) =>
        /^(manquement|resiliation|retrait|declaration-regles|passage-quotidien|envois|relance)/.test(
          x,
        ) && x.endsWith(".ts"),
    )) {
      expect(lire(f), f).not.toMatch(/challenge/i);
    }
  });
  it("aucun envoi d'e-mail ni mise en file depuis les challenges", () => {
    for (const f of challenge)
      expect(lire(f), f).not.toMatch(/enqueueEmail|from "\.\/envois"|nodemailer|sendMail/);
  });
  it("aucun rang, aucun classement, aucun nombre de participants, aucun export", () => {
    for (const f of challenge) {
      const code = lire(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // Le filtre de formules NOMME les classements qu'il interdit : seul « classement » y est permis.
      const motif = f.endsWith("challenge-textes-interdits.ts")
        ? /\brang\b|\bparticipants?\b|exporter|\/export\b/i
        : /\brang\b|\bparticipants?\b|\bclassement\b|exporter|\/export\b/i;
      expect(code, f).not.toMatch(motif);
    }
  });
  it("le schéma n'a aucun champ « apporteurs concernés » ni seuil individuel", () => {
    const schema = readFileSync(join(AR, "..", "..", "..", "prisma", "schema.prisma"), "utf8");
    const m = /model ChallengeApporteur \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(m).toContain("seuil");
    expect(m).not.toMatch(/apporteurId|apporteursConcernes|seuilIndividuel/);
  });
});
