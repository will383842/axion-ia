// @req REQ-INT-014
/**
 * Chantier Axion Partners — INT-T07-A : le bandeau d'attribution d'Axion Partners, et le nom qu'il
 * porte (conditions de la sécurité sur l'issue Partners 754).
 *
 * Ce fichier garde :
 *  — le RENDU : le texte décidé au serveur s'affiche comme TEXTE (jamais en HTML), et rien ne
 *    s'affiche quand il n'y a rien à dire ;
 *  — le MARQUEUR : un nom sentinelle rendu par une API 1 simulée n'arrive que dans le texte du
 *    bandeau, jamais sur la console ;
 *  — les CHEMINS du nom, lus sur le disque : le client de l'API 1 n'est appelé que par l'action du
 *    bandeau et la page de la fiche ; le bandeau n'est rendu que par le formulaire du devis,
 *    l'assistant de vente et la fiche, jamais par un gabarit de document, un PDF ou un courriel ;
 *    l'action du bandeau n'écrit pas dans le journal d'activité ; la fiche reste dynamique (`private,
 *    no-store`).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bandeauPourLeRole, creerCacheAttributions } from "@/server/partners/client-attributions";

import { BandeauAttributionPartners } from "../BandeauAttributionPartners";

const SENTINELLE = "Zéphyrin Q.";
const SIREN = "552100554";

/** Les sources `.ts`/`.tsx` d'un dossier, lues sur le disque (sans git). */
function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.posix.join(dossier, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(chemin);
    return /\.tsx?$/.test(e.name) && !/\.(spec|test)\.tsx?$/.test(e.name) ? [chemin] : [];
  });
}
const SRC = sources("src");
const importeurs = (motif: RegExp) => SRC.filter((f) => motif.test(readFileSync(f, "utf8"))).sort();

describe("REQ-INT-014 — le rendu du bandeau", () => {
  it("REQ-INT-014 — TÉMOIN : le texte s'affiche comme TEXTE, jamais en HTML", () => {
    const html = renderToStaticMarkup(
      <BandeauAttributionPartners
        texte={'Entreprise réservée par <b onclick="x">X</b> jusqu\'en mai 2027.'}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("&lt;b onclick=");
    expect(html).not.toContain("<b ");
  });

  it("REQ-INT-014 : rien à dire, rien de rendu", () => {
    expect(renderToStaticMarkup(<BandeauAttributionPartners texte={null} />)).toBe("");
  });
});

describe("REQ-INT-014 — le MARQUEUR : le nom ne sort que vers le bandeau", () => {
  const ENV = { ...process.env };
  beforeEach(() => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    process.env.PARTNERS_SYNC_URL = "https://partners.example.test/api/webhooks/axionia";
    process.env.AXIONIA_API_TOKEN = "a".repeat(48);
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  it("REQ-INT-014 — TÉMOIN : un nom sentinelle de l'API 1 simulée arrive dans le bandeau, et nulle part sur la console", async () => {
    const ecrits: string[] = [];
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((n) =>
      vi
        .spyOn(console, n)
        .mockImplementation((...a: unknown[]) => void ecrits.push(a.map(String).join(" "))),
    );
    let texte: string | null;
    try {
      texte = await bandeauPourLeRole("admin", SIREN, {
        fetch: (async () =>
          new Response(
            JSON.stringify({
              statut: "cliente",
              until: null,
              apporteurRef: "0190f0f0-0000-7000-8000-0000000000a1",
              nomAffichable: SENTINELLE,
            }),
            { status: 200 },
          )) as unknown as typeof fetch,
        maintenantMs: () => 0,
        cache: creerCacheAttributions(),
      });
    } finally {
      for (const e of espions) e.mockRestore();
    }
    expect(texte).toContain(SENTINELLE);
    expect(renderToStaticMarkup(<BandeauAttributionPartners texte={texte} />)).toContain(
      SENTINELLE,
    );
    expect(ecrits.join("\n")).not.toContain(SENTINELLE);
  });

  it("REQ-INT-014 — TÉMOIN STATIQUE : le client de l'API 1 n'est appelé que par l'action du bandeau et la page de la fiche", () => {
    expect(importeurs(/from "@\/server\/partners\/client-attributions"/)).toEqual([
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx",
      "src/server/actions/qualiopi/devis.ts",
    ]);
  });

  it("REQ-INT-014 — TÉMOIN STATIQUE : le bandeau n'est rendu que par le devis, l'assistant de vente et la fiche, jamais par un document, un PDF ou un courriel", () => {
    expect(importeurs(/BandeauAttributionPartners"/)).toEqual([
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx",
      "src/components/admin/qualiopi/DevisForm.tsx",
      "src/components/admin/qualiopi/VenteWizard.tsx",
    ]);
    const documents = SRC.filter((f) => /documents\/templates|\/emails?\/|pdf/i.test(f));
    expect(documents.length).toBeGreaterThan(0);
    for (const f of documents)
      expect(readFileSync(f, "utf8"), f).not.toMatch(
        /BandeauAttributionPartners|client-attributions|lireBandeauAttribution/,
      );
  });

  it("REQ-INT-014 — TÉMOIN STATIQUE : l'action du bandeau n'écrit ni dans le journal d'activité ni dans le devis", () => {
    const devis = readFileSync("src/server/actions/qualiopi/devis.ts", "utf8");
    const debut = devis.indexOf("export async function lireBandeauAttributionAction");
    expect(debut).toBeGreaterThan(-1);
    const corps = devis.slice(debut, devis.indexOf("\n}\n", debut));
    expect(corps).not.toMatch(/logQualiopiActivity|ActivityLog|\.create\(|\.update\(|console\./);
    expect(corps).toMatch(/requireAdminWrite\(\)/);
  });

  it("REQ-INT-014 : la fiche du client reste dynamique : Next y pose `private, no-store`", () => {
    const fiche = readFileSync(
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx",
      "utf8",
    );
    expect(fiche).toMatch(/export const dynamic = "force-dynamic";/);
  });
});
