// @vitest-environment node
/**
 * ⛔ « Après l'appel » propose vraiment la RELANCE (décision B11), et nomme
 * l'issue et la suite comme l'onglet « Rendez-vous ».
 *
 * Avant : la date venait de la règle de relance mais le menu imposait
 * « devis » en dur ; et la même suite s'affichait « Devis à envoyer » dans le
 * formulaire et « Envoyer un devis » sur la page du rendez-vous.
 *
 * Mutation qui fait rougir : remettre `defaultValue="devis"` (ou toute option
 * écrite en dur) dans `ApresLAppelVue.tsx` → le test de lecture du code
 * rougit ; faire rendre « devis » à `valeursInitialesDuSuivi` sans suivi →
 * le premier test rougit.
 * Contre-témoin : un point déjà fait se relit tel quel.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LIBELLE_ISSUE as ISSUE_ONGLET,
  LIBELLE_SUITE as SUITE_ONGLET,
} from "@/features/admin-rendezvous/suivi";
import { LIBELLE_ISSUE, LIBELLE_SUITE } from "../libelles";
import { suiteParDefaut, valeursInitialesDuSuivi } from "../suite-proposee";

const LUNDI = new Date("2026-10-05T12:00:00Z");

describe("⛔ « Après l'appel » propose la relance, avec les libellés de l'onglet", () => {
  it("sans point fait : « A eu lieu », relance, et SA date", () => {
    expect(valeursInitialesDuSuivi(null, LUNDI)).toEqual({
      issue: "eu_lieu",
      suite: "relance",
      suiteLe: suiteParDefaut(LUNDI).suiteLe,
    });
  });

  it("contre-témoin : un point déjà fait se relit tel quel", () => {
    expect(
      valeursInitialesDuSuivi(
        { issue: "eu_lieu", suite: "devis", suiteLe: new Date("2026-10-20T00:00:00Z") },
        LUNDI,
      ),
    ).toEqual({ issue: "eu_lieu", suite: "devis", suiteLe: "2026-10-20" });
  });

  it("une seule table de libellés pour l'issue et la suite", () => {
    expect(LIBELLE_SUITE).toBe(SUITE_ONGLET);
    expect(LIBELLE_ISSUE).toBe(ISSUE_ONGLET);
  });

  it("l'écran construit ses options depuis la source (lecture du code)", () => {
    const vue = readFileSync(
      join(process.cwd(), "src/components/admin/dossier-client/ApresLAppelVue.tsx"),
      "utf8",
    );
    expect(vue).toContain("valeursInitialesDuSuivi(");
    expect(vue).not.toMatch(/defaultValue=\{?["'](devis|relance|eu_lieu)["']/);
    expect(vue).not.toMatch(
      /<option value="(devis|relance|proposition|aucune|eu_lieu|absent|reporte)"/,
    );
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/rencontres/[rencontreId]/page.tsx",
      ),
      "utf8",
    );
    expect(page).not.toMatch(/const LIBELLE_ISSUE\s*=/);
  });
});
