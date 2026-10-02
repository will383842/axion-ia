/**
 * Page « Enregistreur » — le jeton s'affiche « Sans expiration » (révision du
 * 02/10, décision de Williams : le jeton vaut jusqu'à sa révocation).
 *
 *   · un appareil actif porte le badge « Sans expiration », jamais « expiré »
 *     ni « expire dans N j », et aucune date d'expiration ;
 *   · un jeton créé AVANT la révision (date d'origine dépassée en base) reste
 *     montré actif ;
 *   · la consigne après création ne parle plus de durée.
 *
 * La lecture de l'état est doublée ; la garde de rôle, les actions et l'îlot
 * client aussi (la garde rôle-avant-lecture a son propre test).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const d = vi.hoisted(() => ({ lire: vi.fn() }));

vi.mock("@/features/dossier-client/acces", () => ({
  gardeLectureEchanges: () => Promise.resolve({ autorise: true }),
}));
vi.mock("@/features/admin-enregistreur/actions", () => ({
  creerJetonAction: vi.fn(),
  renouvelerJetonAction: vi.fn(),
  revoquerJetonAction: vi.fn(),
}));
vi.mock("@/components/admin/visio/JetonAppareilForm", () => ({
  JetonAppareilForm: ({ libelle }: { libelle: string }) => <button type="button">{libelle}</button>,
}));
vi.mock("@/features/admin-enregistreur/queries", () => ({
  lireEtatEnregistreur: (...a: unknown[]) => d.lire(...a),
}));

import Page from "../page";
import { etatJetonCree } from "@/features/admin-enregistreur/etat-jeton";

const params = Promise.resolve({ locale: "fr", adminPrefix: "p" });

/** Un appareil d'avant la révision : en base, sa date d'origine (90 j) est passée. */
const APPAREIL = {
  id: "app-1",
  nom: "Poste de test",
  creeLe: new Date("2026-06-01T08:00:00Z"),
  expireLe: new Date("2026-08-30T08:00:00Z"),
  revoqueLe: null,
  dernierBattementLe: new Date("2026-10-02T08:00:00Z"),
  silencieux: false,
  versionExtension: "1.3.0",
};

function etat(appareils: ReadonlyArray<Record<string, unknown>>) {
  return {
    drapeau: { effectif: "pilote", motif: null },
    preavis: "Préavis envoyé.",
    temoinSite: "absent",
    temoinWorkerOkLe: null,
    drapeauVuParWorker: null,
    appareils,
  };
}

async function rendre(): Promise<string> {
  return renderToStaticMarkup((await Page({ params })) as ReactElement);
}

describe("page Enregistreur : le jeton s'affiche sans expiration", () => {
  it("un appareil actif : « Sans expiration », aucune date ni badge d'expiration", async () => {
    d.lire.mockResolvedValue(etat([APPAREIL]));
    const html = await rendre();
    expect(html).toContain("Sans expiration");
    // « expiration » seul est permis (le libellé) ; « expiré », « expire » non.
    expect(html).not.toMatch(/expir(?!ation)/i);
    expect(html).not.toContain("30/08/2026");
    // L'appareil ancien reste actif : la page ne dit pas « aucun jeton valide »…
    expect(html).not.toContain("Aucun jeton valide");
  });

  it("un appareil révoqué : « révoqué », et la création est proposée", async () => {
    d.lire.mockResolvedValue(etat([{ ...APPAREIL, revoqueLe: new Date("2026-10-01T08:00:00Z") }]));
    const html = await rendre();
    expect(html).toContain("révoqué");
    expect(html).toContain("Aucun jeton valide");
  });

  it("la consigne après création ne parle plus de durée", () => {
    const e = etatJetonCree("a".repeat(64));
    expect(e.etat).toBe("cree");
    if (e.etat !== "cree") return;
    expect(e.consigne).not.toMatch(/jusqu'au|expir(?!ation)|jours/i);
    expect(e.consigne).toContain("Valable jusqu'à sa révocation");
  });
});
