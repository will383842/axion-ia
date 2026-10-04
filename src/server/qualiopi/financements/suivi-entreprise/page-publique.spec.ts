/**
 * Lot OPCO A8 — pages publiques de réponse. Témoins : aucune page ne porte de
 * script ; la confirmation n'écrit que par un formulaire POST ; la page neutre
 * ne dit rien du dossier ; le GET de la route n'appelle jamais l'écriture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENTETES_PAGE_SUIVI,
  pageConfirmation,
  pageMerci,
  pageNeutre,
  pageQuestion,
} from "./page-publique";

const C = {
  chemin: "/api/qualiopi/suivi-opco/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCde",
  question: "depot" as const,
  intituleFormation: "IA <au> quotidien",
  nomOpco: "Atlas",
  dossierTelechargeable: true,
};

describe("pages publiques du suivi OPCO", () => {
  const pages = [
    pageNeutre(),
    pageQuestion(C),
    pageQuestion({ ...C, question: "reponse" }),
    pageConfirmation(C, "oui", "2026-10-06"),
    pageConfirmation({ ...C, question: "reponse" }, "accord", "2026-10-06", "Date ?"),
    pageMerci("oui", "aucun"),
    pageMerci("accord", "non_analyse"),
  ];

  it("aucune page ne porte de script ni de lien vers un autre site", () => {
    for (const p of pages) {
      expect(p).not.toMatch(/<script/i);
      expect(p).not.toMatch(/href="https?:/);
    }
  });

  it("le texte est échappé", () => {
    expect(pageQuestion(C)).toContain("IA &lt;au&gt; quotidien");
  });

  it("🔴 la confirmation n'écrit que par un formulaire POST", () => {
    const p = pageConfirmation(C, "oui", "2026-10-06");
    expect(p).toContain(`<form method="post" action="${C.chemin}">`);
    expect(p).toContain('name="reponse" value="oui"');
  });

  it("accord : date (pas dans le futur) et PDF facultatif, jamais de montant à saisir", () => {
    const p = pageConfirmation({ ...C, question: "reponse" }, "accord", "2026-10-06");
    expect(p).toContain('enctype="multipart/form-data"');
    expect(p).toContain('max="2026-10-06"');
    expect(p).not.toMatch(/name="montant/);
  });

  it("🔴 page neutre : rien sur le dossier", () => {
    const p = pageNeutre();
    expect(p).not.toContain("Atlas");
    expect(p).not.toContain("quotidien");
  });

  it("en-têtes : noindex, no-store, CSP sans script", () => {
    expect(ENTETES_PAGE_SUIVI["X-Robots-Tag"]).toContain("noindex");
    expect(ENTETES_PAGE_SUIVI["Cache-Control"]).toBe("no-store");
    expect(ENTETES_PAGE_SUIVI["Content-Security-Policy"]).toContain("default-src 'none'");
  });

  it("🔴 le GET de la route n'appelle jamais l'écriture", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/qualiopi/suivi-opco/[jeton]/route.ts"),
      "utf8",
    );
    const get = source.slice(
      source.indexOf("export async function GET"),
      source.indexOf("async function cleDeDebit"),
    );
    expect(get.length).toBeGreaterThan(100);
    expect(get).not.toContain("enregistrerReponse");
    expect(get).toContain('lireJeton(jeton, "reponse")');
    const telechargement = readFileSync(
      join(process.cwd(), "src/app/api/qualiopi/suivi-opco/[jeton]/dossier/route.ts"),
      "utf8",
    );
    expect(telechargement).not.toMatch(
      /export async function POST|enregistrerReponse|\.update|\.create/,
    );
  });

  it("next.config.ts pose les en-têtes de la route", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const i = config.indexOf('source: "/api/qualiopi/suivi-opco/:path*"');
    expect(i).toBeGreaterThan(-1);
    const bloc = config.slice(i, i + 700);
    expect(bloc).toContain("same-origin");
    expect(bloc).toContain("noindex");
    expect(bloc).toContain("default-src 'none'");
  });
});
