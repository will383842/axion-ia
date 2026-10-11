// @vitest-environment node

/**
 * Deux familles de versions arrêtées dans un seul registre : le contrat-cadre
 * (L7a : v3 arrêtée, v2 émise par défaut) et la lettre de mission (S5 : v2
 * arrêtée, v1 émise par défaut).
 *
 * Les deux lots ont été écrits en parallèle et touchaient le même registre.
 * Ce test prouve qu'aucun n'a écrasé l'autre :
 *
 *  · chaque famille garde sa version par défaut ET sa version arrêtée ;
 *  · chaque version se rejoue avec son propre composant — une lettre v1 déjà
 *    émise ou signée (avec ou sans version dans son instantané) avec le texte
 *    v1, jamais avec la v2 ;
 *  · les empreintes des textes déjà arrêtés ou déjà émis n'ont pas bougé ;
 *  · un fichier source n'est inscrit qu'à un seul endroit.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { composantGabarit } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { GABARITS_ARCHIVES } from "@/server/qualiopi/documents/templates/archives";
import { ContratCadrePdf } from "@/server/qualiopi/documents/templates/contrat-cadre";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import {
  versionGabaritCourante,
  versionGabaritInstantane,
} from "@/server/qualiopi/documents/templates/gabarit-versions";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";
import { LettreMissionV2Pdf } from "@/server/qualiopi/documents/templates/lettre-mission-v2";
import {
  VERSIONS_ARRETEES,
  derniereVersionArretee,
  verifierVersionDuComposant,
  versionGabaritAEcrire,
} from "@/server/qualiopi/documents/templates/versions-arretees";

const FAMILLES = [
  {
    type: "contrat_sous_traitance",
    parDefaut: {
      version: 2,
      fichier: "contrat-sous-traitance.tsx",
      Composant: ContratSousTraitancePdf,
    },
    arretee: { version: 3, fichier: "contrat-cadre.tsx", Composant: ContratCadrePdf },
  },
  {
    type: "lettre_mission",
    parDefaut: { version: 1, fichier: "lettre-mission.tsx", Composant: LettreMissionPdf },
    arretee: { version: 2, fichier: "lettre-mission-v2.tsx", Composant: LettreMissionV2Pdf },
  },
] as const;

/** Mêmes règles de mesure que `gabarit-empreinte.spec.ts`. */
function empreinte(fichier: string): string {
  const source = readFileSync(
    join(process.cwd(), "src", "server", "qualiopi", "documents", "templates", fichier),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/** Textes déjà arrêtés ou déjà émis : leur empreinte ne bouge jamais. */
const EMPREINTES: Readonly<Record<string, string>> = {
  "contrat-sous-traitance.tsx": "826c87dd9c49c4d2424bfb8a9457e22bd6b99cbb8c14752e6588fb05a01136eb",
  "contrat-cadre.tsx": "4b20c6f75447e7b8dccaaaf78be0db0c95aad7d7d275a0e6edde5ed119db76d0",
  "lettre-mission.tsx": "5ecd3292d85abac664088d4ef4648748c63de2a3a6330f86f11cc6a09a96fd9c",
  "lettre-mission-v2.tsx": "0272584e43169a8e7aeacb0735e02c1a462610e1e72ca10667c110ae06393b54",
};

describe("le registre porte les deux familles, sans que l'une écrase l'autre", () => {
  it("exactement deux familles arrêtées : contrat-cadre v3 et lettre de mission v2", () => {
    const inscrites = Object.entries(VERSIONS_ARRETEES).map(([type, parVersion]) => [
      type,
      Object.keys(parVersion ?? {}).map(Number),
    ]);
    expect(Object.fromEntries(inscrites)).toEqual({
      contrat_sous_traitance: [3],
      lettre_mission: [2],
    });
    expect(VERSIONS_ARRETEES.contrat_sous_traitance?.[3]?.arreteeLe).toBe("2026-10-10");
    expect(VERSIONS_ARRETEES.lettre_mission?.[2]?.arreteeLe).toBe("2026-10-10");
  });

  for (const f of FAMILLES) {
    describe(f.type, () => {
      it(`émet la v${f.parDefaut.version} par défaut, la v${f.arretee.version} sur demande seulement`, () => {
        expect(versionGabaritCourante(f.type)).toBe(f.parDefaut.version);
        expect(derniereVersionArretee(f.type)).toBe(f.arretee.version);
        expect(versionGabaritAEcrire(f.type)).toBe(f.parDefaut.version);
        expect(versionGabaritAEcrire(f.type, f.parDefaut.version)).toBe(f.parDefaut.version);
        expect(versionGabaritAEcrire(f.type, f.arretee.version)).toBe(f.arretee.version);
        expect(() => versionGabaritAEcrire(f.type, f.arretee.version + 1)).toThrow(
          /émission refusée/,
        );
      });

      it("chaque version se rejoue avec son propre composant", () => {
        expect(composantGabarit(f.type, f.parDefaut.version)).toBe(f.parDefaut.Composant);
        expect(composantGabarit(f.type, f.arretee.version)).toBe(f.arretee.Composant);
        expect(VERSIONS_ARRETEES[f.type]?.[f.arretee.version]?.fichier).toBe(f.arretee.fichier);
      });

      it("le composant rendu et la version inscrite ne se croisent pas", () => {
        expect(() =>
          verifierVersionDuComposant(f.type, f.parDefaut.Composant, f.parDefaut.version),
        ).not.toThrow();
        expect(() =>
          verifierVersionDuComposant(f.type, f.arretee.Composant, f.arretee.version),
        ).not.toThrow();
        expect(() =>
          verifierVersionDuComposant(f.type, f.arretee.Composant, f.parDefaut.version),
        ).toThrow(/émission refusée/);
        expect(() =>
          verifierVersionDuComposant(f.type, f.parDefaut.Composant, f.arretee.version),
        ).toThrow(/émission refusée/);
      });

      it("les textes déjà arrêtés ou émis n'ont pas changé", () => {
        expect(empreinte(f.parDefaut.fichier)).toBe(EMPREINTES[f.parDefaut.fichier]);
        expect(empreinte(f.arretee.fichier)).toBe(EMPREINTES[f.arretee.fichier]);
      });
    });
  }

  it("une lettre v1 déjà émise, avec ou sans version dans son instantané, se rend avec le texte v1", () => {
    expect(composantGabarit("lettre_mission", versionGabaritInstantane({}))).toBe(LettreMissionPdf);
    expect(
      composantGabarit("lettre_mission", versionGabaritInstantane({ gabaritVersion: 1 })),
    ).toBe(LettreMissionPdf);
  });

  it("un fichier source n'est inscrit qu'à un seul endroit (arrêté, archivé ou courant)", () => {
    const arretes = Object.values(VERSIONS_ARRETEES).flatMap((pv) =>
      Object.values(pv ?? {}).map((v) => v.fichier),
    );
    const archives = Object.values(GABARITS_ARCHIVES).flatMap((pv) =>
      Object.values(pv ?? {}).map((v) => `archives/${v.fichier}`),
    );
    const courants = FAMILLES.map((f) => f.parDefaut.fichier);
    const tous = [...arretes, ...archives, ...courants];
    expect(new Set(tous).size).toBe(tous.length);
  });
});
