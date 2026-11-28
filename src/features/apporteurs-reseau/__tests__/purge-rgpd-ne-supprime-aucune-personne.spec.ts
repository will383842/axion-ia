// PR N : la purge n'efface aucune personne. Garde statique + comportement.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ecritures, fauxPrisma } from "./purge-rgpd-faux-prisma";

const etat = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return etat.prisma;
  },
}));
vi.mock("../alerte-interne", () => ({ alerteInterne: vi.fn(async () => true) }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { purgerDonneesApporteurs } from "../purge-rgpd";

const RACINE = join(__dirname, "..");
const INTERDITS = [
  "apporteurReseau",
  "presentationEntreprise",
  "commissionApporteur",
  "releveMensuelApporteur",
  "pieceAutofactureApporteur",
  "apporteurVirementCompte",
];

describe("la purge ne supprime aucune personne (garde statique)", () => {
  const src = readFileSync(join(RACINE, "purge-rgpd.ts"), "utf8");
  it.each(INTERDITS)("aucun delete / deleteMany sur %s", (modele) => {
    expect(src).not.toMatch(new RegExp(`${modele}\\.(delete|deleteMany)\\b`));
  });
  it("le seul deleteMany est celui des octets de pièces", () => {
    const l = [...src.matchAll(/(\w+)\.deleteMany/g)].map((m) => m[1]);
    expect(new Set(l)).toEqual(new Set(["pieceApporteurContenu"]));
  });
  it("la fiche n'est touchée que sur l'IBAN", () => {
    expect(src).toMatch(
      /apporteurReseau\.updateMany\(\{\s*where: \{ id: apporteurId, iban: \{ not: null \} \},\s*data: \{ iban: null \},/,
    );
  });
});

describe("comportement : la fiche reste, seul l'IBAN part", () => {
  const maintenant = new Date("2031-01-01T00:00:00Z");
  beforeEach(() => {
    etat.prisma = fauxPrisma({
      "apporteurPurgeRgpd.findMany": [],
      "apporteurReseau.findMany": [
        {
          id: "a1",
          statut: "refuse",
          refuseAt: new Date("2030-01-01T00:00:00Z"),
          resilieAt: null,
          majAt: new Date("2030-01-01T00:00:00Z"),
          signeParSocieteAt: null,
        },
      ],
      "pieceApporteur.findMany": (a: { where: { apporteurId?: string } }) =>
        a.where.apporteurId
          ? [
              { id: "p1", type: "identite" },
              { id: "p2", type: "rib" },
            ]
          : [],
      "apporteurChangementIban.findMany": [{ id: "d1" }],
    });
  });
  it("aucune suppression hors octets, journal écrit, réglage local posé AVANT les écritures", async () => {
    const b = await purgerDonneesApporteurs(maintenant, "appliquer");
    expect(b.purgees).toBe(1);
    const p = etat.prisma as ReturnType<typeof fauxPrisma>;
    const ops = ecritures(p.appels);
    expect(ops[0]).toEqual({
      op: "$executeRawUnsafe",
      args: "SET LOCAL axion.reecriture_pii = 'purge'",
    });
    for (const o of ops) {
      if (o.op.endsWith(".delete") || o.op.endsWith(".deleteMany")) {
        expect(o.op).toBe("pieceApporteurContenu.deleteMany");
      }
      for (const m of INTERDITS.filter((x) => x !== "apporteurReseau"))
        expect(o.op.startsWith(`${m}.`)).toBe(false);
    }
    const fiche = ops.filter((o) => o.op.startsWith("apporteurReseau."));
    expect(fiche).toHaveLength(1);
    expect((fiche[0]!.args as { data: unknown }).data).toEqual({ iban: null });
    expect(ops.some((o) => o.op === "apporteurPurgeRgpd.create")).toBe(true);
  });
});
