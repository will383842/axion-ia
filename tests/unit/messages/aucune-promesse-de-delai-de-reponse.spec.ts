// AUCUNE PROMESSE DE DÉLAI DE RÉPONSE DANS LES MESSAGES (Williams, 11/11/2026).
//
// « Il ne faut pas dire réponse sous 48 h, ça me limite trop. » Les fichiers de
// messages (fr et en) ne contiennent plus aucune promesse de délai de réponse à
// un contact. Un délai de LIVRAISON (rapport, devis) n'est pas visé ici.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROMESSE =
  /r[ée]ponse\s+(?:humaine\s+)?(?:sous|en moins de)\s+\d|r[ée]pondons?\s+sous\s+\d|reply\s+within\s+\d|repl(?:y|ies)\s+within\s+\d|respon[sd]e?\s+within\s+\d|\d+\s?(?:business|working)[\s-]hours?/i;

describe("les messages ne promettent aucun délai de réponse", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale}.json ne contient aucune promesse « réponse sous 48 h »`, () => {
      const brut = readFileSync(join(process.cwd(), "src", "messages", `${locale}.json`), "utf8");
      const fautes = brut.split("\n").filter((ligne) => PROMESSE.test(ligne));
      expect(fautes).toEqual([]);
    });
  }
});

// Fichiers de contenu et de composants nettoyés : aucune promesse de RÉPONSE à un
// contact. Les délais de LIVRAISON (devis, rapport) ne sont pas visés.
const PROMESSE_SOURCE =
  /r[ée]ponse (?:humaine |presse |garantie |cadrée )?sous \d|(?:reply|response) within \d|on répond sous|nous répondons sous|on revient sous|revenons vers vous sous|recontacte personnellement sous/i;

const FICHIERS = [
  "src/app/[locale]/a-propos/page.tsx",
  "src/app/[locale]/appel/page.tsx",
  "src/app/[locale]/centre-aide/[slug]/page.tsx",
  "src/app/[locale]/centre-aide/page.tsx",
  "src/app/[locale]/confirmation/page.tsx",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/demande-devis/confirmation/page.tsx",
  "src/app/[locale]/demande-devis/page.tsx",
  "src/app/[locale]/interventions/demande/page.tsx",
  "src/app/[locale]/interventions/individuel/page.tsx",
  "src/app/[locale]/presse/[slug]/page.tsx",
  "src/app/[locale]/presse/page.tsx",
  "src/app/[locale]/tarifs/page.tsx",
  "src/app/llms.txt/route.ts",
  "src/components/formations/FormationDetailPage.tsx",
  "src/components/forms/UnifiedContactForm.tsx",
  "src/components/sections/AuditConversionBlocks.tsx",
  "src/components/sections/AuditDetailPage.tsx",
  "src/components/sections/ContactHeroSchema.tsx",
  "src/components/sections/FounderProfile.tsx",
  "src/components/sections/InterventionDetailPage.tsx",
  "src/components/sections/PricingGridVille.tsx",
  "src/components/sections/ProductPageTemplate.tsx",
  "src/components/services/audit/AuditFaq.tsx",
  "src/components/services/audit/AuditTrustPills.tsx",
  "src/components/services/implementation/ImplementationHero.tsx",
  "src/components/services/sites-web/SitesWebContactBand.tsx",
  "src/components/ville/OrangeContactBanner.tsx",
  "src/content/equipe/williams.ts",
  "src/content/implementation.ts",
  "src/content/keywords/g1-audit.ts",
  "src/content/keywords/i-geo.ts",
  "src/content/keywords/j-presse.ts",
  "src/content/press.ts",
  "src/lib/email/templates/audit-confirmed.tsx",
  "src/lib/email/templates/contact-confirmed.tsx",
  "src/lib/email/templates/implementation-confirmed.tsx",
  "src/lib/email/templates/quote-request-received.tsx",
  "src/lib/schemas/unified-contact-schema.ts",
  "src/server/chatbot/orchestrator.ts"
];

describe("les fichiers nettoyés ne promettent aucun délai de réponse", () => {
  for (const fichier of FICHIERS) {
    it(fichier, () => {
      const brut = readFileSync(join(process.cwd(), ...fichier.split("/")), "utf8");
      const fautes = brut.split("\n").filter((ligne) => PROMESSE_SOURCE.test(ligne));
      expect(fautes).toEqual([]);
    });
  }
});
