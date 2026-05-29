// Tests du résolveur de tokens prix (Sprint Pricing SSOT 2026-05-29).
// Les attendus sont DÉRIVÉS des helpers pricing.ts (jamais de montant en dur) :
// le test vérifie que chaque mode route vers le bon helper, pas une valeur figée
// — il reste donc vert si Will change un tarif dans la SSOT.
import { describe, it, expect, vi } from "vitest";
import { fmtNumber } from "@/lib/intl";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  MAINTENANCE_TIERS,
  formatAmount,
  formatAmountRange,
  formatPrice,
  formatPriceWithOnsite,
  getTierById,
} from "./pricing";
import {
  hasPriceToken,
  resolvePriceTokens,
  resolvePriceTokensDeep,
  PRICE_TOKEN_REGISTRY,
} from "./pricing-tokens";

const flash = getTierById(AUDIT_TIERS, "audit-flash");
const cible = getTierById(AUDIT_TIERS, "audit-cible");
const conference = getTierById(INTERVENTION_TIERS, "intervention-conference");
const maintenance = getTierById(MAINTENANCE_TIERS, "maintenance-standard");

describe("hasPriceToken", () => {
  it("détecte un token, ignore le texte sans token", () => {
    expect(hasPriceToken("prix : {{price:audit-flash}}")).toBe(true);
    expect(hasPriceToken("aucun prix ici")).toBe(false);
  });
});

describe("resolvePriceTokens — modes", () => {
  it("full (défaut) → formatPrice", () => {
    expect(resolvePriceTokens("{{price:audit-flash}}", "fr")).toBe(formatPrice(flash, "fr"));
    expect(resolvePriceTokens("{{price:audit-flash|full}}", "fr")).toBe(formatPrice(flash, "fr"));
  });

  it("flat → formatAmount du priceFlat", () => {
    expect(resolvePriceTokens("{{price:audit-flash|flat}}", "fr")).toBe(
      formatAmount(flash.priceFlat!, "fr"),
    );
  });

  it("onsite → formatPriceWithOnsite", () => {
    expect(resolvePriceTokens("{{price:audit-flash|onsite}}", "fr")).toBe(
      formatPriceWithOnsite(flash, "fr"),
    );
  });

  it("range → formatAmountRange des bornes", () => {
    expect(resolvePriceTokens("{{price:audit-cible|range}}", "fr")).toBe(
      formatAmountRange(cible.priceMin!, cible.priceMax!, "fr"),
    );
  });

  it("from → « À partir de » + prix d'entrée", () => {
    expect(resolvePriceTokens("{{price:audit-cible|from}}", "fr")).toBe(
      `À partir de ${formatAmount(cible.priceMin!, "fr")}`,
    );
  });

  it("entry → montant d'entrée brut formaté", () => {
    expect(resolvePriceTokens("{{price:audit-cible|entry}}", "fr")).toBe(
      formatAmount(cible.priceMin!, "fr"),
    );
  });

  it("compact → montant sans « HT » (tier flat et sous-tier)", () => {
    expect(resolvePriceTokens("{{price:audit-flash|compact}}", "fr")).toBe(
      formatAmount(flash.priceFlat!, "fr", { compact: true }),
    );
    expect(resolvePriceTokens("{{price:audit-cible-solo|compact}}", "fr")).toBe(
      formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr", { compact: true }),
    );
  });

  it("num → nombre seul sans devise (1er membre d'un range « entre X et … »)", () => {
    expect(resolvePriceTokens("{{price:audit-cible-solo|num}}", "fr")).toBe(
      fmtNumber(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr"),
    );
    expect(resolvePriceTokens("entre {{price:audit-cible-solo|num}} et X", "fr")).not.toContain(
      "€",
    );
  });

  it("tier onQuote → « Sur devis » / « On request »", () => {
    expect(resolvePriceTokens("{{price:intervention-conference}}", "fr")).toBe(
      formatPrice(conference, "fr"),
    );
    expect(resolvePriceTokens("{{price:intervention-conference|from}}", "fr")).toBe("Sur devis");
    expect(resolvePriceTokens("{{price:intervention-conference|from}}", "en")).toBe("On request");
  });

  it("récurrence préservée (maintenance /mois)", () => {
    expect(resolvePriceTokens("{{price:maintenance-standard}}", "fr")).toBe(
      formatPrice(maintenance, "fr"),
    );
  });

  it("sous-tier → formatAmount du priceFlat du sous-tier", () => {
    const standard = PRICE_TOKEN_REGISTRY.get("essentielle-standard");
    expect(standard).toBeDefined();
    if (standard?.kind === "subTier") {
      expect(resolvePriceTokens("{{price:essentielle-standard}}", "fr")).toBe(
        formatAmount(standard.subTier.priceFlat, "fr"),
      );
    }
  });

  it("locale EN respectée", () => {
    expect(resolvePriceTokens("{{price:audit-flash}}", "en")).toBe(formatPrice(flash, "en"));
  });

  it("plusieurs tokens dans une phrase", () => {
    const out = resolvePriceTokens(
      "Audit dès {{price:audit-flash|flat}}, coaching {{price:intervention-dirigeants|flat}}.",
      "fr",
    );
    expect(out).toContain(formatAmount(flash.priceFlat!, "fr"));
    expect(out).not.toContain("{{price:");
  });
});

describe("resolvePriceTokens — robustesse", () => {
  it("token à tier inconnu : laissé en l'état + warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolvePriceTokens("{{price:tier-inexistant}}", "fr")).toBe("{{price:tier-inexistant}}");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("mode inconnu : laissé en l'état + warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolvePriceTokens("{{price:audit-flash|bogus}}", "fr")).toBe(
      "{{price:audit-flash|bogus}}",
    );
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("texte sans token renvoyé inchangé", () => {
    expect(resolvePriceTokens("aucun prix", "fr")).toBe("aucun prix");
  });
});

describe("resolvePriceTokensDeep", () => {
  it("résout récursivement string / array / objet, conserve la structure", () => {
    const input = {
      title: "Offre",
      price: "{{price:audit-flash|flat}}",
      nested: { faq: ["Q ?", "Tarif {{price:audit-cible|range}}."] },
      keep: 42,
    };
    const out = resolvePriceTokensDeep(input, "fr");
    expect(out.title).toBe("Offre");
    expect(out.price).toBe(formatAmount(flash.priceFlat!, "fr"));
    expect(out.nested.faq[1]).toContain(formatAmountRange(cible.priceMin!, cible.priceMax!, "fr"));
    expect(out.keep).toBe(42);
    // immutabilité : l'entrée n'est pas mutée
    expect(input.price).toBe("{{price:audit-flash|flat}}");
  });
});
