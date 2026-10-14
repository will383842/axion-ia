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
import { ContratCadrePdf as ContratCadrePdfV3 } from "@/server/qualiopi/documents/templates/archives/contrat-cadre.v3";
import { LettreMissionV2Pdf as LettreMissionPdfV2 } from "@/server/qualiopi/documents/templates/archives/lettre-mission-v2.v2";
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
    // Étape 3 du C4 : la v4 est la dernière arrêtée ; la v3 est figée mot pour mot.
    arretee: { version: 4, fichier: "contrat-cadre.tsx", Composant: ContratCadrePdf },
    figee: {
      version: 3,
      fichier: "archives/contrat-cadre.v3.tsx",
      Composant: ContratCadrePdfV3,
    },
  },
  {
    type: "lettre_mission",
    parDefaut: { version: 1, fichier: "lettre-mission.tsx", Composant: LettreMissionPdf },
    arretee: { version: 3, fichier: "lettre-mission-v2.tsx", Composant: LettreMissionV2Pdf },
    figee: {
      version: 2,
      fichier: "archives/lettre-mission-v2.v2.tsx",
      Composant: LettreMissionPdfV2,
    },
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
  // Étape 3 du C4 : les textes v3 / v2 vivent désormais dans leurs copies figées, à
  // l'empreinte IDENTIQUE ; les fichiers courants portent la v4 et la v3 (retouchées le
  // 14/10/2026 avant toute signature : paiement 30 jours après l'autofacture).
  "archives/contrat-cadre.v3.tsx":
    "4b20c6f75447e7b8dccaaaf78be0db0c95aad7d7d275a0e6edde5ed119db76d0",
  "contrat-cadre.tsx": "2c8a6ec6e91f2ba9f9f2f0c802301b445e726c5c9eeaf683aed2b19bfed4eba6",
  "lettre-mission.tsx": "5ecd3292d85abac664088d4ef4648748c63de2a3a6330f86f11cc6a09a96fd9c",
  "archives/lettre-mission-v2.v2.tsx":
    "0272584e43169a8e7aeacb0735e02c1a462610e1e72ca10667c110ae06393b54",
  "lettre-mission-v2.tsx": "d36f90c00185f0e8696396628264afc469c8b0be8202d28ad68d96f8ca41f10e",
};

describe("le registre porte les deux familles, sans que l'une écrase l'autre", () => {
  it("exactement deux familles arrêtées : contrat-cadre v3 et v4, lettre de mission v2 et v3", () => {
    const inscrites = Object.entries(VERSIONS_ARRETEES).map(([type, parVersion]) => [
      type,
      Object.keys(parVersion ?? {}).map(Number),
    ]);
    expect(Object.fromEntries(inscrites)).toEqual({
      contrat_sous_traitance: [3, 4],
      lettre_mission: [2, 3],
    });
    expect(VERSIONS_ARRETEES.contrat_sous_traitance?.[3]?.arreteeLe).toBe("2026-10-10");
    expect(VERSIONS_ARRETEES.lettre_mission?.[2]?.arreteeLe).toBe("2026-10-10");
    expect(VERSIONS_ARRETEES.contrat_sous_traitance?.[4]?.arreteeLe).toBe("2026-10-14");
    expect(VERSIONS_ARRETEES.lettre_mission?.[3]?.arreteeLe).toBe("2026-10-14");
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
        expect(composantGabarit(f.type, f.figee.version)).toBe(f.figee.Composant);
        expect(VERSIONS_ARRETEES[f.type]?.[f.figee.version]?.fichier).toBe(f.figee.fichier);
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
        // La copie figée et la version courante ne se croisent pas non plus.
        expect(() =>
          verifierVersionDuComposant(f.type, f.figee.Composant, f.figee.version),
        ).not.toThrow();
        expect(() =>
          verifierVersionDuComposant(f.type, f.arretee.Composant, f.figee.version),
        ).toThrow(/émission refusée/);
      });

      it("les textes déjà arrêtés ou émis n'ont pas changé", () => {
        expect(empreinte(f.parDefaut.fichier)).toBe(EMPREINTES[f.parDefaut.fichier]);
        expect(empreinte(f.arretee.fichier)).toBe(EMPREINTES[f.arretee.fichier]);
        expect(empreinte(f.figee.fichier)).toBe(EMPREINTES[f.figee.fichier]);
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
