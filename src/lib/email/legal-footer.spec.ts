/**
 * Garde de NON-DIVERGENCE du pied de page légal des e-mails.
 *
 * ── L'ARCHITECTURE, ET POURQUOI ELLE EST AINSI ──────────────────────────────
 *
 * `legal-footer.ts` DÉRIVE son identité de `identite-legale-ssot.ts`, un module
 * sans aucun import. Ce détour n'est pas gratuit : la raison sociale vivait dans
 * `brand.ts`, mais `brand.ts` fait `import { env } from "@/env"`, et le pied de
 * page est rendu dans le worker BullMQ — sur un trajet qui, par convention du
 * dépôt, ne charge pas la validation Zod des secrets de production.
 *
 * Une première version RECOPIAIT donc le littéral, en s'en expliquant. C'était
 * une erreur, et `identite-legale-registre.spec.ts` l'a refusée sur-le-champ :
 * ce test interdit toute copie littérale de la raison sociale sous `src/`,
 * parce qu'elle avait déjà divergé en sept copies — dont une écrivait
 * « Axion-IA SAS » là où le Kbis porte « AXION IA ». Un caractère d'écart casse
 * le rapprochement d'entité que Google fait avec SIRENE et l'INPI.
 *
 * La sortie n'était pas d'arbitrer entre les deux règles, mais de DÉPLACER le
 * littéral hors de `brand.ts`. Les tests ci-dessous vérifient que la dérivation
 * tient — un futur « juste une constante en dur, c'est plus simple » les fait
 * rougir.
 *
 * ── ET LA JUSTESSE DES IDENTIFIANTS ─────────────────────────────────────────
 *
 * Une coquille dans un SIRET ou un n° de TVA ne se voit pas à l'œil et ne fait
 * échouer aucun build : elle part sur chaque e-mail jusqu'à ce qu'un comptable
 * la signale. Les clés de contrôle, elles, ne pardonnent pas — on les vérifie.
 */

import { describe, it, expect } from "vitest";
import { EMAIL_LEGAL, EMAIL_SIGNATURE } from "./legal-footer";
import { BRAND, FOUNDER } from "@/lib/brand";
import { NDA_NUMERO, MENTION_NON_AGREMENT } from "@/server/qualiopi/legal/legal-mentions";

describe("Pied de page légal des e-mails — non-divergence avec les SSOT", () => {
  it("la raison sociale est celle de BRAND, à la casse près d'aucun caractère", () => {
    expect(EMAIL_LEGAL.legalName).toBe(BRAND.legalName);
  });

  it("le fondateur est celui de FOUNDER", () => {
    expect(EMAIL_SIGNATURE.fullName).toBe(FOUNDER.fullName);
    expect(EMAIL_SIGNATURE.linkedin).toBe(FOUNDER.linkedin);
  });

  it("le n° de déclaration d'activité vient de la SSOT, jamais retapé", () => {
    expect(EMAIL_LEGAL.nda).toBe(NDA_NUMERO);
  });

  it("la mention de non-agrément vient de la SSOT — publier le numéro seul est une infraction", () => {
    // Art. L.6352-12 C. trav. : interdiction de faire état de l'enregistrement
    // sans préciser qu'il ne vaut pas agrément de l'État.
    expect(EMAIL_LEGAL.mentionNonAgrement).toBe(MENTION_NON_AGREMENT);
  });
});

describe("Pied de page légal des e-mails — exactitude des identifiants", () => {
  it("l'adresse porte le complément « ELITE BUREAUX - boîte 53 »", () => {
    // 🔴 SIRENE le porte sur sa propre ligne : l'omettre casse le rapprochement
    // exact-match NAP entre le JSON-LD du site et les registres. C'est la
    // valeur que `COMPANY_ADDRESS` n'avait PAS en production le 02/08/2026.
    expect(EMAIL_LEGAL.address).toContain("ELITE BUREAUX - boîte 53");
    expect(EMAIL_LEGAL.address).toContain("11 Avenue Paul Verlaine");
    expect(EMAIL_LEGAL.address).toContain("38100 Grenoble");
  });

  it("le SIREN fait 9 chiffres et le SIRET le prolonge", () => {
    expect(EMAIL_LEGAL.siren).toMatch(/^\d{9}$/);
    expect(EMAIL_LEGAL.siret).toMatch(/^\d{14}$/);
    expect(EMAIL_LEGAL.siret.startsWith(EMAIL_LEGAL.siren)).toBe(true);
  });

  it("le SIRET a une clé de Luhn valide", () => {
    // Une coquille dans un identifiant légal se voit rarement à l'œil ; la clé,
    // elle, ne pardonne pas. Un chiffre inversé fait rougir ce test.
    const somme = [...EMAIL_LEGAL.siret].reduce((acc, c, i) => {
      let n = Number(c);
      if (i % 2 === 0) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      return acc + n;
    }, 0);
    expect(somme % 10).toBe(0);
  });

  it("le n° de TVA intracommunautaire est la clé + le SIREN", () => {
    expect(EMAIL_LEGAL.vat).toBe(`FR51${EMAIL_LEGAL.siren}`);
    // La clé française vaut (12 + 3 × (SIREN mod 97)) mod 97.
    const cle = (12 + 3 * (Number(EMAIL_LEGAL.siren) % 97)) % 97;
    expect(EMAIL_LEGAL.vat.slice(2, 4)).toBe(String(cle).padStart(2, "0"));
  });

  it("l'adresse de contact n'est pas un noreply@ (référentiel §3.2)", () => {
    expect(EMAIL_LEGAL.contactEmail).not.toMatch(/^no[-_.]?reply@/i);
    expect(EMAIL_LEGAL.contactEmail).toContain("@axion-ia.com");
  });
});
