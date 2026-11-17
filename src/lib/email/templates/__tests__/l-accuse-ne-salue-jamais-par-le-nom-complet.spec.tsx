/**
 * Les 4 accusés de réception ne saluent plus par « Prénom Nom » (décision du
 * fondateur, 17/11/2026) : civilité + nom, sinon prénom, sinon « Bonjour, ».
 * `contactName` reste dans la charge (l'ancien worker en a besoin) mais ne sert
 * jamais à saluer.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const GABARITS = [
  "contact-confirmed",
  "audit-confirmed",
  "implementation-confirmed",
  "quote-request-received",
] as const;

const BASE = { contactName: "Michel Dupont", submissionId: "s" };

describe.each(["fr", "en"] as const)("accusés — salutation (%s)", (locale) => {
  const bonjour = locale === "fr" ? "Bonjour" : "Hello";
  const monsieur = locale === "fr" ? "Monsieur" : "Mr";

  it.each(GABARITS)("%s : contactName seul → « %s, » sans nom complet", async (gabarit) => {
    const { html } = await renderEmailTemplate(gabarit, locale, BASE);
    expect(html).toContain(`${bonjour},`);
    expect(html).not.toContain("Michel Dupont");
    expect(html).not.toContain(`${bonjour} Michel`);
  });

  it.each(GABARITS)("%s : civilité + prénom + nom → civilité et nom", async (gabarit) => {
    const { html } = await renderEmailTemplate(gabarit, locale, {
      ...BASE,
      civilite: "monsieur",
      prenom: "Michel",
      nomFamille: "Dupont",
    });
    expect(html).toContain(`${bonjour} ${monsieur} Dupont,`);
    expect(html).not.toContain("Michel Dupont");
  });

  it.each(GABARITS)("%s : prénom seul → le prénom", async (gabarit) => {
    const { html } = await renderEmailTemplate(gabarit, locale, { ...BASE, prenom: "Michel" });
    expect(html).toContain(`${bonjour} Michel,`);
  });
});

describe("garde de source", () => {
  const DOSSIER = join(process.cwd(), "src", "lib", "email", "templates");

  it.each(GABARITS)("%s n'a plus d'intro par le nom complet et importe salutation", (gabarit) => {
    const src = readFileSync(join(DOSSIER, `${gabarit}.tsx`), "utf8");
    expect(src).not.toMatch(/intro:\s*\(n/);
    expect(src).not.toContain("p.contactName");
    expect(src).toMatch(/import \{ salutation \} from "\.\.\/salutation"/);
  });

  /**
   * Cliquet : les gabarits qui écrivent encore `Bonjour ${…}` / `Hello ${…}`.
   * Liste figée le 17/11/2026 (39 fichiers, les 4 accusés en sont sortis) ;
   * elle ne peut que DIMINUER. Un gabarit migré s'en retire ; en ajouter un
   * est refusé.
   */
  const ENCORE_PAR_LE_NOM = new Set([
    "_formateur-independant.tsx",
    "appel-rappel.tsx",
    "apporteur-attribution-confirmee.tsx",
    "apporteur-demarrage.tsx",
    "apporteur-invitation-appel.tsx",
    "apporteur-invitation-relance.tsx",
    "apporteur-issue-echange.tsx",
    "apporteur-lien-espace.tsx",
    "autofacture-transmission.tsx",
    "avis-recu.tsx",
    "cancellation-confirmed-by-user.tsx",
    "candidature-commercial-confirmee.tsx",
    "candidature-entretien-rappel.tsx",
    "candidature-recue.tsx",
    "convention-envoi.tsx",
    "devis-commande-confirmation.tsx",
    "devis-envoi.tsx",
    "facture-envoi.tsx",
    "facture-pieces-remboursement-opco.tsx",
    "force-majeure-notice.tsx",
    "formateur-mission-proposee.tsx",
    "lead-apporteur-recu.tsx",
    "lead-apporteur-relance.tsx",
    "opco-suivi-entreprise.tsx",
    "payment-failed.tsx",
    "payment-link.tsx",
    "payment-receipt.tsx",
    "podcast-demande-recue.tsx",
    "qualiopi-convocation.tsx",
    "questionnaire-avant-audit-confirmation.tsx",
    "questionnaire-avant-audit-relance.tsx",
    "questionnaire-avant-audit.tsx",
    "questionnaire-relance-equipe.tsx",
    "rappel-confirme.tsx",
    "recueil-besoin.tsx",
    "relance-devis-client.tsx",
    "roi-report.tsx",
    "visio-email-suivi.tsx",
    "vivier-information.tsx",
  ]);

  it("aucun nouveau gabarit ne salue par `Bonjour ${…}` (liste figée, décroissante)", () => {
    const motif = /(Bonjour|Hello) \$\{/;
    const trouves = readdirSync(DOSSIER)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => motif.test(readFileSync(join(DOSSIER, f), "utf8")));
    const nouveaux = trouves.filter((f) => !ENCORE_PAR_LE_NOM.has(f));
    expect(nouveaux).toEqual([]);
  });
});
