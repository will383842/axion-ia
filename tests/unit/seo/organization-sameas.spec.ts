// @vitest-environment node
//
// Environnement `node` REQUIS : `buildOrganizationJsonLd` lit des variables
// d'environnement SERVEUR (t3-env), dont l'acces leve sous jsdom (« server var
// on client »). Meme raison que `src/lib/__tests__/seo-organization-qualiopi.spec.ts`,
// qui porte la meme directive et le meme commentaire — c'est un piege deja paye
// une fois sur ce meme builder.
/**
 * Verrou GEO-020 / GEO-045 — les fiches tierces déclarées en `sameAs`
 * (audit GEO/AEO end-to-end du 2026-08-14).
 *
 * ## Pourquoi ces URLs comptent
 *
 * Sur « Qui est Axion-IA ? », le moteur de réponse testé cite **Crunchbase en
 * source n°1 et F6S en n°2**, et **zéro fois** axion-ia.com. Ce sont donc ces
 * pages qui définissent l'entreprise pour les moteurs de réponse. Les déclarer
 * en `sameAs`, c'est dire explicitement « cette fiche, c'est moi » au lieu de
 * laisser deviner.
 *
 * ## 🔴 L'ordre est la condition — arbitrage A4
 *
 * Avant correction, LinkedIn et Les Pépites Tech ancraient l'entité à **Paris**
 * et écorchaient le nom du fondateur. Les déclarer dans cet état revenait à
 * **signer soi-même l'erreur** que les moteurs arbitrent déjà contre nous.
 * Corriger d'abord, déclarer ensuite. Les fiches ont été corrigées par Will le
 * 2026-08-16.
 *
 * ## ⚠️ Ce que cette garde NE peut pas faire
 *
 * Elle ne vérifie pas le CONTENU des fiches : les deux plateformes bloquent les
 * robots — Crunchbase répond 403 (« One moment, please… »), F6S sert un mur
 * anti-bot qui rend un **200 trompeur** (« Checking your browser »). Un contrôle
 * automatique par requête ne prouvera jamais rien ici, et un `200` n'y signifie
 * pas « la page est bonne ». La vérification du contenu est humaine, connectée,
 * et c'est une limite assumée — pas un oubli.
 *
 * Ce que la garde vérifie, c'est la FORME : une URL malformée dans `sameAs`
 * casse la corroboration sans que rien ne rougisse.
 */

import { describe, expect, it } from "vitest";

import { buildOrganizationJsonLd } from "@/lib/seo";

function sameAsDe(locale: "fr" | "en"): string[] {
  const node = buildOrganizationJsonLd({ locale }) as { sameAs?: unknown };
  return Array.isArray(node.sameAs) ? (node.sameAs as string[]) : [];
}

describe("Organization sameAs — les fiches qui définissent l'entité", () => {
  const SAME_AS = sameAsDe("fr");

  it("garde anti-test-vide : le nœud expose bien un sameAs peuplé", () => {
    expect(SAME_AS.length, "sameAs vide — la corroboration d'entité a disparu").toBeGreaterThan(3);
  });

  for (const [nom, fragment] of [
    ["LinkedIn", "linkedin.com/company/axion-ia-france"],
    ["Crunchbase", "crunchbase.com/organization/axion-ia"],
    ["F6S", "f6s.com/axion-ia1"],
  ] as const) {
    it(`${nom} est déclarée`, () => {
      expect(
        SAME_AS.some((u) => u.includes(fragment)),
        `${nom} n'est plus declaree en sameAs. C'est l'une des sources que les ` +
          `moteurs de reponse citent a la place du site : sans declaration, la ` +
          `corroboration redevient une devinette.`,
      ).toBe(true);
    });
  }

  it("🔴 le slug F6S porte bien le suffixe `1` — ce n'est PAS un doublon", () => {
    // F6S a du suffixer parce que `axion-ia` etait deja pris par le profil
    // MEMBRE : deux types d'objets ne partagent pas une URL. Un futur lecteur
    // pourrait prendre ce `1` pour une coquille et le « corriger » vers une
    // page qui n'est pas la societe.
    expect(SAME_AS.some((u) => u.endsWith("/axion-ia1"))).toBe(true);
  });

  it("toutes les URLs sont absolues et en https", () => {
    for (const u of SAME_AS) {
      expect(u.startsWith("https://"), u).toBe(true);
    }
  });

  it("aucune URL ne porte de paramètre de tracking ni de redirection connue", () => {
    // Une URL avec `utm_source` ou un `www.` qui redirige dilue le signal : le
    // moteur suit une chaine au lieu d'atterrir sur la fiche.
    for (const u of SAME_AS) {
      expect(u.includes("utm_"), `${u} porte un parametre de tracking`).toBe(false);
      expect(u.includes("?"), `${u} porte une query string`).toBe(false);
    }
  });

  it("aucun doublon", () => {
    expect(new Set(SAME_AS).size, "une fiche est declaree deux fois").toBe(SAME_AS.length);
  });

  it("la déclaration est identique en EN — l'entité ne change pas de locale", () => {
    expect(sameAsDe("en")).toEqual(SAME_AS);
  });
});
