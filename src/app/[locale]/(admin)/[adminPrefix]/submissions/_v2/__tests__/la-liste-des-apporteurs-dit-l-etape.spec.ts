// La liste « Apporteurs » (2026-10-07, demande de Will) :
//   · la colonne « Réponse » devient « Étape » — pour CE périmètre seulement ;
//   · un filtre « En cours » (par défaut) / « Archivés » / « Tous » ;
//   · « Archiver » / « Désarchiver » sur la ligne ET sur la fiche ;
//   · l'archivage automatique tourne dans un passage existant, et un rattrapage
//     se lance à la main.
// Les autres listes (Messages, Clients, Presse…) ne changent pas.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ongletsListe } from "@/features/admin-submissions/onglets-liste";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const LISTE = "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx";

describe("les onglets", () => {
  const base = "/fr/admin/contacts/commercial";

  it("apporteurs : En cours (par défaut) / Archivés / Tous / Corbeille", () => {
    const o = ongletsListe({ perimetre: "apporteurs", base, searchParams: {} });
    expect(o.options.map((x) => x.label)).toEqual(["En cours", "Archivés", "Tous", "Corbeille"]);
    expect(o.current).toBe("active");
    expect(o.options.find((x) => x.value === "active")!.href).toBe(base);
  });

  it("apporteurs : « Tous » montre les archivés AVEC les autres", () => {
    const o = ongletsListe({ perimetre: "apporteurs", base, searchParams: {} });
    expect(o.options.find((x) => x.value === "all")!.href).toBe(`${base}?includeArchived=true`);
    expect(
      ongletsListe({ perimetre: "apporteurs", base, searchParams: { includeArchived: "true" } })
        .current,
    ).toBe("all");
    expect(
      ongletsListe({
        perimetre: "apporteurs",
        base,
        searchParams: { includeArchived: "true", status: "archived" },
      }).current,
    ).toBe("archived");
    expect(
      ongletsListe({ perimetre: "apporteurs", base, searchParams: { deleted: "true" } }).current,
    ).toBe("trash");
  });

  it("les autres listes gardent Actifs / Archivés / Corbeille", () => {
    const o = ongletsListe({ base: "/fr/admin/contacts/messages", searchParams: {} });
    expect(o.options.map((x) => x.label)).toEqual(["Actifs", "Archivés", "Corbeille"]);
    expect(ongletsListe({ base, searchParams: { includeArchived: "true" } }).current).toBe(
      "active",
    );
  });
});

describe("la colonne", () => {
  const src = lire(LISTE);

  it("« Étape » pour les apporteurs, « Réponse » partout ailleurs", () => {
    expect(src).toMatch(/perimetre === "apporteurs" \? "Étape" : "Réponse"/);
  });

  it("l'étape se lit par le module dédié, et se clique", () => {
    expect(src).toContain("etapeDuSuivi(");
    expect(src).toContain("libelleEtapeSuivi(");
    expect(src).toContain("lienEtapeSuivi(");
  });

  it("sous « Candidat », la raison du lien non parti s'affiche en petit", () => {
    expect(src).toContain("precisionEtapeSuivi(etape)");
    expect(src).toMatch(/lireMotifsSansLien\([\s\S]{0,200}\}\s*catch \(err\)/);
  });

  it("la lecture des dossiers est accessoire : la liste ne tombe pas pour elle", () => {
    expect(src).toMatch(/lireDossiersApporteurListe\([\s\S]{0,200}\}\s*catch \(err\)/);
  });
});

describe("les gestes", () => {
  it("la fiche porte « Archiver » / « Désarchiver »", () => {
    const f = lire("src/components/admin/contacts/GestesApporteur.tsx");
    expect(f).toContain("archiveSubmissionAction");
    expect(f).toContain("unarchiveSubmissionAction");
    expect(f).toContain("Archiver");
    expect(f).toContain("Désarchiver");
  });

  it("la ligne porte toujours « Archiver » / « Désarchiver »", () => {
    const l = lire(
      "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionRowActions.tsx",
    );
    expect(l).toContain("archiveSubmissionAction(id)");
    expect(l).toContain("unarchiveSubmissionAction(id)");
  });
});

describe("l'archivage automatique et le rattrapage", () => {
  it("le passage des invitations (toutes les 5 minutes) archive aussi, sur une fenêtre bornée", () => {
    const w = lire("src/server/queue/workers/apporteur-crons-worker.ts");
    expect(w).toContain("archiverApporteursTermines");
    expect(w).toMatch(/depuis: new Date\(/);
  });

  it("le rattrapage est un script, à blanc par défaut", () => {
    const pkg = JSON.parse(lire("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["rattrapage:archivage-apporteurs"]).toBe(
      "tsx scripts/rattrapage-archivage-apporteurs.ts",
    );
    const s = lire("scripts/rattrapage-archivage-apporteurs.ts");
    expect(s).toContain('process.argv.includes("--appliquer")');
    expect(s).toContain("depuis: null");
  });

  it("le préfixe des rappels du dossier est celui du passage quotidien", async () => {
    const { PREFIXE_RAPPEL_DOSSIER } =
      await import("@/lib/commercial-application/etape-suivi-apporteur");
    const q = lire("src/features/apporteurs-reseau/passage-quotidien.ts");
    expect(q).toContain(`PREFIXE_JOB_RAPPEL_DOSSIER = "${PREFIXE_RAPPEL_DOSSIER}"`);
  });
});
