/**
 * ⛔ Le préavis ne part JAMAIS directement : il attend la validation de Will.
 *
 * ## Pourquoi
 *
 * Ordre permanent : rien ne part à un client sans validation. Le préavis est,
 * de plus, un texte juridique relu par Will (point d'arrêt du chantier). Le
 * script qui le met en file est lancé à la main dans le worker : s'il envoyait
 * directement, une seule commande ferait partir un texte non relu.
 *
 * ## Ce que la garde vérifie
 *
 * - sans `--envoyer`, AUCUN appel à la mise en file ;
 * - avec `--envoyer`, CHAQUE appel porte `exigerValidation: true` ;
 * - une adresse qui a déjà un préavis en file (hors refus) n'en reçoit pas un
 *   second ;
 * - les arguments inconnus ou contradictoires sont refusés ;
 * - le script ne met rien en file lui-même : il passe par `envoyerPreavis`, et
 *   n'importe que des modules de `src/` (il est copié seul dans le worker).
 *
 * Mutation vérifiée : `exigerValidation: false` dans `preavis-envoi.ts` → le
 * test « chaque appel porte exigerValidation » rougit ; `envoyer: true` par
 * défaut dans `lireArgumentsPreavis` → le test « sans --envoyer » rougit.
 * Contre-témoin : le test « avec --envoyer » compte bien un appel (la garde ne
 * passe pas sur une liste vide).
 *
 * Angle mort avoué : la garde teste le module, pas le vrai `enqueueEmail`. Que
 * `exigerValidation: true` gare bien l'e-mail est gardé ailleurs
 * (`src/server/queue/__tests__/`).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { envoyerPreavis, lireArgumentsPreavis, type DependancesPreavis } from "../preavis-envoi";

type Appel = { to: string; options: Record<string, unknown> };

function deps(
  fiches: Array<{ id: string; contactEmail: string | null; _count: Record<string, number> }>,
  dejaEnFile: string[] = [],
): { deps: DependancesPreavis; appels: Appel[] } {
  const appels: Appel[] = [];
  return {
    appels,
    deps: {
      prisma: {
        client: { findMany: async () => fiches },
        emailOutbox: { findMany: async () => dejaEnFile.map((recipient) => ({ recipient })) },
      },
      identite: async () => ({ legalName: "ENTITE TEST SAS", dpoContact: "rgpd@exemple.invalid" }),
      mettreEnFile: async (_t, to, _l, _p, options) => {
        appels.push({ to, options: options as unknown as Record<string, unknown> });
        return { garePourValidation: true };
      },
    },
  };
}

const ACTIVE = (n: number, email: string | null) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  contactEmail: email,
  _count: { devis: 1 },
});

describe("préavis — jamais sans validation", () => {
  it("⛔ sans --envoyer, aucun appel à la mise en file", async () => {
    const args = lireArgumentsPreavis([]);
    expect(args.envoyer).toBe(false);
    const { deps: d, appels } = deps([ACTIVE(1, "a@exemple.invalid")]);
    const b = await envoyerPreavis({ envoyer: args.envoyer }, d);
    expect(appels).toEqual([]);
    expect(b.mode).toBe("a-blanc");
    expect(b.destinataires).toBe(1);
    expect(b.misEnFile).toBe(0);
  });

  it("--dry-run explicite : aucun appel non plus", async () => {
    expect(lireArgumentsPreavis(["--dry-run"]).envoyer).toBe(false);
  });

  it("⛔ avec --envoyer, chaque appel porte exigerValidation: true", async () => {
    const args = lireArgumentsPreavis(["--envoyer"]);
    expect(args.envoyer).toBe(true);
    const { deps: d, appels } = deps([
      ACTIVE(1, "a@exemple.invalid"),
      ACTIVE(2, "b@exemple.invalid"),
    ]);
    const b = await envoyerPreavis({ envoyer: args.envoyer }, d);
    expect(appels).toHaveLength(2);
    for (const a of appels) {
      expect(a.options["exigerValidation"], `préavis vers ${a.to} sans validation`).toBe(true);
      expect(a.options["bypassValidation"]).toBeUndefined();
    }
    expect(b.misEnFile).toBe(2);
    expect(b.nonMisEnFile).toBe(0);
  });

  it("une adresse qui a déjà un préavis en file n'en reçoit pas un second", async () => {
    const { deps: d, appels } = deps(
      [ACTIVE(1, "a@exemple.invalid"), ACTIVE(2, "b@exemple.invalid")],
      ["A@exemple.invalid"],
    );
    const b = await envoyerPreavis({ envoyer: true }, d);
    expect(appels.map((a) => a.to)).toEqual(["b@exemple.invalid"]);
    expect(b.dejaEnFile).toBe(1);
  });

  it("un préavis non garé (file indisponible) est compté, jamais tu", async () => {
    const { deps: d } = deps([ACTIVE(1, "a@exemple.invalid")]);
    const b = await envoyerPreavis(
      { envoyer: true },
      { ...d, mettreEnFile: async () => ({ corbeilleIndisponible: true }) },
    );
    expect(b.misEnFile).toBe(0);
    expect(b.nonMisEnFile).toBe(1);
  });

  it("refuse les arguments inconnus ou contradictoires", () => {
    expect(lireArgumentsPreavis(["--envoi"]).erreur).toMatch(/inconnu/);
    expect(lireArgumentsPreavis(["--dry-run", "--envoyer"]).erreur).toMatch(/incompatibles/);
    expect(lireArgumentsPreavis(["--envoi"]).envoyer).toBe(false);
  });

  it("⛔ le script passe par envoyerPreavis et n'importe que src/", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "visio", "envoyer-preavis.ts"),
      "utf8",
    );
    expect(source).not.toContain("enqueueEmail");
    expect(source).toContain("lireArgumentsPreavis(process.argv.slice(2))");
    expect(source).toContain("envoyerPreavis({ envoyer: args.envoyer })");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) expect(i, `import hors de src/ : ${i}`).toMatch(/^@\//);
  });
});
