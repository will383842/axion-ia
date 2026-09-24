/**
 * Décision n° 4 de Will (24/09/2026) — « quelques lettres par an, à chaque
 * nouveauté utile ». LISTE FERMÉE des endroits où la cadence de la lettre, ou
 * l'inscription elle-même, apparaît (plan v2, lot L2).
 *
 * La promesse d'une « newsletter mensuelle » n'a jamais été tenue : aucune
 * lettre n'est partie depuis la première inscription. Une information inexacte
 * au moment de la collecte fragilise le caractère « éclairé » du consentement
 * (art. 4.11 RGPD). Ce verrou rougit si le mot revient dans l'un de ces
 * fichiers — en français comme en anglais, parce que la locale EN est prérendue
 * et qu'une réactivation ressortirait la vieille promesse.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CADENCE_LETTRE } from "@/content/guide-ia-formulaire";

const LISTE_FERMEE = [
  "src/app/[locale]/guide-ia/page.tsx",
  "src/messages/fr.json",
  "src/messages/en.json",
  "src/components/content-gen/ArticleNewsletterInline.tsx",
  "src/components/forms/NewsletterForm.tsx",
  "src/content/guide-ia-formulaire.ts",
  "src/app/[locale]/glossaire/page.tsx",
  "src/app/[locale]/glossaire/[slug]/page.tsx",
  "src/app/[locale]/desabonnement/page.tsx",
  "src/app/[locale]/confirmation/page.tsx",
  "src/app/[locale]/confirmation/newsletter/page.tsx",
  "src/lib/email/templates/appel-rappel.tsx",
  "src/lib/email/templates/guide-ia-envoi.tsx",
  "src/lib/email/templates/newsletter-confirm-optin.tsx",
  "src/content/imprimes.ts",
  "src/content/legal.ts",
] as const;

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

/** Le texte SERVI : sans les commentaires, qui racontent l'histoire du défaut. */
function texteServi(f: string): string {
  return lire(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/**
 * Dans les messages, le mot « mensuel » a d'AUTRES emplois légitimes (un
 * accompagnement mensuel de coaching). La règle porte sur la LETTRE : aucune
 * valeur ne peut parler à la fois d'elle et d'une cadence mensuelle.
 */
function valeursDeLettreMensuelle(f: string): string[] {
  const out: string[] = [];
  const parcourir = (v: unknown): void => {
    if (typeof v === "string") {
      if (/newsletter|lettre|letter/i.test(v) && /mensuel|monthly/i.test(v)) out.push(v);
    } else if (v && typeof v === "object") {
      for (const x of Object.values(v)) parcourir(x);
    }
  };
  parcourir(JSON.parse(lire(f)));
  return out;
}

describe("🔴 plus aucune promesse « mensuelle »", () => {
  for (const f of LISTE_FERMEE) {
    it(f, () => {
      if (f.endsWith(".json")) {
        expect(valeursDeLettreMensuelle(f)).toEqual([]);
        expect(lire(f)).not.toMatch(/Newsletter mensuelle|Monthly newsletter/);
      } else {
        expect(texteServi(f)).not.toMatch(/mensuel|monthly/i);
      }
    });
  }
});

describe("la cadence réelle est écrite, et depuis UNE source", () => {
  it("les deux phrases validées", () => {
    expect(CADENCE_LETTRE.fr).toBe("Quelques lettres par an, à chaque nouveauté utile.");
    expect(CADENCE_LETTRE.en).toBe(
      "A few emails a year, only when there is something new and useful.",
    );
  });

  it("l'e-mail « Votre guide » et la page de confirmation la lisent depuis la source", () => {
    expect(lire("src/lib/email/templates/guide-ia-envoi.tsx")).toContain("CADENCE_LETTRE");
    expect(lire("src/app/[locale]/confirmation/newsletter/page.tsx")).toContain("CADENCE_LETTRE");
  });

  it("la clé orpheline « Newsletter mensuelle » du pied de page a disparu des deux langues", () => {
    const fr = JSON.parse(lire("src/messages/fr.json")) as { footer?: Record<string, string> };
    const en = JSON.parse(lire("src/messages/en.json")) as { footer?: Record<string, string> };
    expect(fr.footer?.["newsletter"]).toBeUndefined();
    expect(en.footer?.["newsletter"]).toBeUndefined();
  });

  it("l'encart des articles n'annonce plus une inscription « confirmée » avant toute confirmation", () => {
    expect(texteServi("src/components/content-gen/ArticleNewsletterInline.tsx")).not.toContain(
      "Inscription confirmée",
    );
  });
});
