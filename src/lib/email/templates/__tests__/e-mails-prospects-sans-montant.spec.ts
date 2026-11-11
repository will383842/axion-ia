/**
 * R7 — les e-mails envoyés à des PROSPECTS ou au public ne citent aucun montant, sauf
 * la Journée IA (1 490 € HT). Ordre de Williams du 08/11/2026.
 *
 * Chaque gabarit est RENDU (fr) avec le jeu d'exemple de l'aperçu de la console
 * (`PAYLOAD_EXEMPLE`). Un montant qui ne fait que RÉPÉTER une valeur du payload (le
 * budget que le visiteur a lui-même coché, l'estimation qu'il a lui-même calculée) n'est
 * pas un prix affiché par Axion-IA : il est toléré. Tout autre montant rougit.
 *
 * HORS PÉRIMÈTRE, et nommés pour qu'un gabarit nouveau ne s'y glisse pas en silence :
 * les e-mails transactionnels d'un client sous devis (devis, facture, convention,
 * paiement, relance d'impayé), ceux du stagiaire et du formateur, ceux de l'apporteur
 * RETENU ou sous contrat (barème du contrat, `_bareme-apporteur.ts`), et les alertes
 * internes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/reviews/queries", () => ({
  getPublishedReviewStats: async () => ({ count: 0, average: 0 }),
}));

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

/** Gabarits qui NE partent PAS à un prospect ou au public (motif dans le nom du groupe). */
const HORS_PROSPECTS: ReadonlySet<string> = new Set([
  // Client sous devis / commande : transactionnel, le montant y est dû.
  "devis-envoi",
  "relance-devis-client",
  "convention-envoi",
  "piece-exemplaire-signe",
  "devis-commande-confirmation",
  "devis-code-signature",
  "devis-signe-a-contresigner",
  "facture-envoi",
  "facture-pieces-remboursement-opco",
  "payment-link",
  "payment-receipt",
  "payment-failed",
  "qualiopi-relance-impayee",
  "autofacture-transmission",
  "opco-suivi-entreprise",
  "recueil-besoin",
  // Apporteur retenu ou sous contrat : barème du contrat, privé.
  "apporteur-issue-retenu",
  "apporteur-demarrage",
  "apporteur-contrat-signe",
  "apporteur-releve",
  "apporteur-virement-fait",
  "apporteur-vigilance",
  "apporteur-commission-avoir-client",
  "apporteur-commission-suspension",
  "apporteur-non-commissionne",
  "apporteur-commande-signee",
  "apporteur-commande-non-attribuee",
  "apporteur-attribution-confirmee",
  // Rapport du simulateur de gains : les euros sont les ÉCONOMIES que le dirigeant a lui-même
  // estimées (payload numérique, `savedEur*`), jamais un prix d'Axion-IA — le gabarit n'importe
  // ni `pricing.ts` ni l'offre (vérifié ci-dessous).
  "roi-report",
]);

/** Les familles privées par préfixe : stagiaire / organisme (qualiopi-*), formateur. */
const PREFIXES_PRIVES = ["qualiopi-", "formateur-", "formateur_"] as const;

function estProspect(nom: string): boolean {
  if (HORS_PROSPECTS.has(nom)) return false;
  return !PREFIXES_PRIVES.some((p) => nom.startsWith(p));
}

function texte(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;| | /gi, " ")
    .replace(/\s+/g, " ");
}

/** Montants en euros, sauf la Journée IA (1 490). */
function montants(t: string): string[] {
  return [
    ...t.matchAll(/\d[\d ]*(?:[.,]\d+)?\s*(?:€|euros?\b|EUR\b)/g),
    ...t.matchAll(/€\s*\d[\d ,.]*/g),
  ]
    .map((m) => m[0].trim())
    .filter((m) => !/^1 ?490\b/.test(m) && !/€\s*1 ?490\b/.test(m));
}

/** Les montants que le payload porte déjà (saisis par le destinataire) — tolérés. */
const ECHOS = new Set(
  JSON.stringify(PAYLOAD_EXEMPLE)
    .replace(/\\u00a0|\\u202f/g, " ")
    .match(/\d[\d  ]*(?:[.,]\d+)?\s*€/g)
    ?.flatMap((m) => montants(m.replace(/ | /g, " "))) ?? [],
);

const PROSPECTS = EMAIL_TEMPLATE_NAMES.filter(estProspect);

describe("e-mails aux prospects et au public : aucun montant hors Journée IA", () => {
  it("le périmètre n'est pas vide (témoin : la garde regarde quelque chose)", () => {
    expect(PROSPECTS.length).toBeGreaterThan(20);
    expect(PROSPECTS).toContain("appel-rappel");
    expect(PROSPECTS).toContain("lead-apporteur-recu");
  });

  it("roi-report n'affiche que les gains estimés : aucune source de prix importée", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/email/templates/roi-report.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/@\/content\/(pricing|offers-catalog|pricing-tokens)/);
  });

  for (const nom of PROSPECTS) {
    it(nom, async () => {
      const r = await renderEmailTemplate(nom, "fr", { ...PAYLOAD_EXEMPLE });
      const t = `${r.subject} ${texte(r.html)} ${r.text}`;
      expect(montants(t).filter((m) => !ECHOS.has(m))).toEqual([]);
    });
  }
});
