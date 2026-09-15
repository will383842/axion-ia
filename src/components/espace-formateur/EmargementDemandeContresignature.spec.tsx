/**
 * 🔴 LA DEMANDE DE CONTRESIGNATURE EST VISIBLE DANS L'ESPACE DU FORMATEUR.
 *
 * L'e-mail ne suffit pas (demande de Will, 2026-09-15) : le formateur doit
 * trouver la demande en ouvrant son espace, avec un accès DIRECT au geste — le
 * bloc d'émargement de la formation, où se trouve le bouton « Contresigner ».
 *
 * Trois surfaces, un seul bilan (`contresignatures-manquantes.ts`) :
 *  · la page de la formation affiche la demande en tête, liée à `#emargement` ;
 *  · l'accueil liste l'étape « Émargement contresigné par le formateur » et son
 *    lien mène au même bloc ;
 *  · le bloc d'émargement porte l'ancre que les deux autres visent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const findFirst = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      get findFirst() {
        return findFirst;
      },
    },
  },
}));

import { EmargementDemandeContresignature } from "./EmargementDemandeContresignature";
import { contresignaturesAttenduesDuFormateur } from "@/server/qualiopi/emargement/contresignatures-attendues";

const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MAINTENANT = new Date("2026-09-16T18:00:00.000Z");

describe("ce que CE formateur a à contresigner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    findFirst.mockResolvedValue({
      formateurPrincipalId: "t-moi",
      // Le formateur du 15 est bien membre : c'est la DÉSIGNATION qui l'écarte ici.
      sessionFormateurs: [{ trainerId: "t-autre" }],
      jours: [
        {
          date: jourDb("2026-09-15"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: "t-autre",
        },
        { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
      ],
      emargementContresignatures: [],
      enrollments: [
        {
          presences: [
            { date: jourDb("2026-09-15"), demiJournee: "matin" },
            { date: jourDb("2026-09-16"), demiJournee: "apres_midi" },
          ],
        },
      ],
    });
  });

  it("🔴 ne lui réclame QUE les demi-journées qui lui sont désignées", async () => {
    // Le 15 était animé par un autre formateur : lui demander d'attester
    // avoir animé une journée qu'il n'a pas tenue serait lui faire signer faux.
    const r = await contresignaturesAttenduesDuFormateur("sess-1", "t-moi", MAINTENANT);
    expect(r.map((d) => `${d.date}|${d.demiJournee}`)).toEqual(["2026-09-16|apres_midi"]);
  });

  it("scope la lecture sur la session ET sur l'appartenance du formateur", async () => {
    await contresignaturesAttenduesDuFormateur("sess-1", "t-moi", MAINTENANT);
    const where = JSON.stringify((findFirst.mock.calls[0]?.[0] as { where: unknown }).where);
    expect(where).toContain("sess-1");
    expect(where).toContain("t-moi");
  });

  it("stub SSG → rien, sans lecture", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await contresignaturesAttenduesDuFormateur("sess-1", "t-moi", MAINTENANT);
    delete process.env["DATABASE_URL"];
    expect(r).toEqual([]);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("le bandeau de demande", () => {
  it("🔴 nomme chaque demi-journée et mène DROIT au bloc d'émargement", () => {
    const html = renderToStaticMarkup(
      <EmargementDemandeContresignature
        demiJournees={[
          { date: "2026-09-16", demiJournee: "matin", formateurId: "t-moi" },
          { date: "2026-09-16", demiJournee: "apres_midi", formateurId: "t-moi" },
        ]}
      />,
    );
    expect(html).toContain("mercredi 16 septembre 2026 — matin");
    expect(html).toContain("mercredi 16 septembre 2026 — après-midi");
    expect(html).toContain('href="#emargement"');
    expect(html).toMatch(/[Cc]ontresign/);
  });

  it("rien à contresigner → aucun bandeau (un bandeau vide se lit comme une alerte)", () => {
    expect(renderToStaticMarkup(<EmargementDemandeContresignature demiJournees={[]} />)).toBe("");
  });
});

describe("les ancres existent là où on les vise", () => {
  const racine = process.cwd();
  const page = readFileSync(
    join(racine, "src/app/[locale]/espace-formateur/sessions/[id]/page.tsx"),
    "utf8",
  );
  const accueil = readFileSync(
    join(racine, "src/components/espace-formateur/EcheancesFormateur.tsx"),
    "utf8",
  );

  it("la page de la formation affiche la demande et porte l'ancre `emargement`", () => {
    expect(page).toContain("<EmargementDemandeContresignature");
    expect(page).toMatch(/id="emargement"/);
    expect(page).toContain("contresignaturesAttenduesDuFormateur(");
  });

  it("l'accueil mène au bloc d'émargement pour l'étape de contresignature", () => {
    expect(accueil).toContain("#emargement");
    expect(accueil).toContain("contresignature_formateur");
  });
});
