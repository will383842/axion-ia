/**
 * Positionnement et signature des e-mails (2026-11-08, audit d'harmonie, P1).
 *
 * - La tagline dit la cible « PME » (positionnement du 07/11), jamais « ETI et
 *   grands groupes » ; la ligne de services ne promet ni financement OPCO.
 * - Les rendez-vous sont signés Williams ; les accusés techniques « L'équipe ».
 * - Le pied légal garde l'adresse complète (LCEN) : seule exception à « Grenoble ».
 */
import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

import { EmailLayout } from "../_layout";
import { AppelRappelEmail } from "../appel-rappel";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function layout(locale: "fr" | "en", signature: "equipe" | "fondateur") {
  return texte(
    await render(
      <EmailLayout famille="B" signature={signature} preview="p" title="t" locale={locale}>
        <p>corps</p>
      </EmailLayout>,
    ),
  );
}

describe("tagline et services", () => {
  it.each(["fr", "en"] as const)("%s : cible PME, aucun OPCO ni ETI", async (locale) => {
    for (const sig of ["equipe", "fondateur"] as const) {
      const t = await layout(locale, sig);
      expect(t).not.toMatch(/OPCO/i);
      expect(t).not.toMatch(/\bETI\b|grands groupes|mid-market|enterprise/i);
    }
  });

  it("fr : la tagline est le positionnement PME", async () => {
    expect(await layout("fr", "equipe")).toContain("PME");
  });

  it("le pied légal garde l'adresse complète du siège (LCEN)", async () => {
    const t = await layout("fr", "equipe");
    expect(t).toContain(EMAIL_LEGAL.address);
  });

  it("Grenoble n'apparaît qu'une fois : dans le pied légal", async () => {
    const t = await layout("fr", "fondateur");
    expect(t.match(/Grenoble/g)?.length ?? 0).toBe(1);
  });
});

describe("signature des rendez-vous", () => {
  const rendre = async (locale: "fr" | "en", moment: string) =>
    texte(
      await render(
        <AppelRappelEmail
          locale={locale}
          payload={{ prenom: "Camille", heure: "10 h", dureeMinutes: 45, moment }}
        />,
      ),
    );

  it.each([
    ["confirmation", "À très vite, Williams"],
    ["j1", "À demain, Williams"],
    ["h1", "À tout à l'heure, Williams"],
  ])("fr %s : signé Williams", async (moment, attendu) => {
    expect(await rendre("fr", moment)).toContain(attendu);
  });

  it.each(["confirmation", "j1", "h1"])("en %s : signé Williams, pas l'équipe", async (moment) => {
    const t = await rendre("en", moment);
    expect(t).not.toContain("The Axion-IA team");
    expect(t).toMatch(/Talk (soon|tomorrow),\s*Williams/);
  });
});
