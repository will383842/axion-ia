// Les réponses reçues par e-mail des candidats apporteurs (2026-09-27) sont
// des données de la personne : effacées à l'art. 17, restituées à l'art. 15,
// et purgées avec sa fiche. Ce fichier le garde.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const deleteMany = vi.hoisted(() => vi.fn(async () => ({ count: 2 })));
vi.mock("@/lib/prisma", () => ({
  prisma: { submissionInboundReply: { deleteMany } },
}));

import { eraseReponsesEntrantesForEmail } from "../rgpd-erase";
import { hashEmailForLookup } from "../security/email-hash";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

describe("🔴 art. 17 — l'effacement", () => {
  it("supprime les réponses par l'EMPREINTE de l'expéditeur, casse et espaces normalisés", async () => {
    const r = await eraseReponsesEntrantesForEmail("  Camille@Exemple.FR ");
    expect(r).toEqual({ supprimees: 2 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { fromEmailHash: hashEmailForLookup("camille@exemple.fr") },
    });
  });

  it("la route d'effacement l'appelle, et le dit dans son compte rendu", () => {
    const route = lire("src/app/api/gdpr-erase/route.ts");
    expect(route).toMatch(/eraseReponsesEntrantesForEmail\(email\)/);
    expect(route).toMatch(/reponsesEntrantesSupprimees: reponsesEntrantesResult\.supprimees/);
  });
});

describe("🔴 art. 15 — l'export", () => {
  it("restitue date, objet, extrait déchiffré et nature, par la même empreinte", () => {
    const route = lire("src/app/api/gdpr-export/route.ts");
    expect(route).toMatch(
      /submissionInboundReply\.findMany\(\{\s*where: \{ fromEmailHash: lookupHash \}/,
    );
    expect(route).toMatch(/reponsesRecues: reponsesRecues\.map/);
    expect(route).toMatch(/extrait: r\.excerpt \? decryptPii\(r\.excerpt\) : null/);
  });
});

describe("🔴 minimisation et rétention — le schéma", () => {
  const schema = lire("prisma/schema.prisma");
  const modele = /model SubmissionInboundReply \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";

  it("le modèle existe", () => {
    expect(modele).not.toBe("");
  });

  it("il suit sa fiche : suppression EN CASCADE (purge 24 mois, effacement console)", () => {
    expect(modele).toMatch(
      /submission\s+Submission\s+@relation\(fields: \[submissionId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it("aucune adresse en clair, aucun corps complet : une empreinte, un objet, un extrait", () => {
    expect(modele).toMatch(/fromEmailHash\s+String/);
    expect(modele).not.toMatch(/^\s*(email|fromEmail|fromAddress|body\w*|html|text)\s/m);
    expect(modele).toMatch(/excerpt\s+String\?/);
    expect(modele).toMatch(/subject\s+String\s+@db\.VarChar\(500\)/);
  });
});
