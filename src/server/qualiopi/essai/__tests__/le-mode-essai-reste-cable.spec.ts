// @vitest-environment node
/**
 * 🔑 QNC L02 — LE MODE ESSAI RESTE CÂBLÉ LÀ OÙ LES TESTS DE COMPORTEMENT NE
 * PASSENT PAS.
 *
 * Les invariances (`un-essai-est-absent-des-chiffres`) et les canaux
 * (`un-essai-n-atteint-aucun-canal-externe`) exercent le VRAI code des sites
 * principaux. Les sites ci-dessous ne s'exercent qu'au prix d'un décor
 * démesuré (transactions de facturation, page serveur, passage apporteur) :
 * cette garde vérifie qu'ils portent toujours leur filtre ou leur numéro
 * d'essai. Retirer l'un d'eux rougit ici, avec le site nommé.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../../..");
const lire = (f: string) => readFileSync(path.join(RACINE, f), "utf8");

const SITES: ReadonlyArray<{ fichier: string; doit: RegExp; pourquoi: string }> = [
  // ── Numéros hors suite légale ─────────────────────────────────────────────
  {
    fichier: "src/server/qualiopi/financements/facture-formation-emission.ts",
    doit: /estTestInterne\s*\?\s*numeroEssai\("facture"\)/,
    pourquoi: "facture de session d'essai : numéro `-ESSAI-`",
  },
  {
    fichier: "src/server/qualiopi/financements/facturation-service.ts",
    doit: /estTestInterne\s*\?\s*numeroEssai\("facture"\)/,
    pourquoi: "facture (service historique) d'essai : numéro `-ESSAI-`",
  },
  {
    fichier: "src/server/actions/qualiopi/factures-inter.ts",
    doit: /estInscriptionReelle\(enrollment\)[\s\S]{0,120}numeroEssai\("facture"\)/,
    pourquoi: "facture par inscription d'essai : numéro `-ESSAI-`",
  },
  {
    fichier: "src/server/qualiopi/financements/facture-libre.ts",
    doit: /estNumeroEssai\(origine\.numero\)\s*\?\s*numeroEssai\("avoir"\)/,
    pourquoi: "avoir d'une facture d'essai : numéro `-ESSAI-`",
  },
  {
    fichier: "src/server/actions/qualiopi/sessions.ts",
    doit: /estEssai\s*\?\s*numeroEssai\("session"\)/,
    pourquoi: "session d'essai : numéro `-ESSAI-`",
  },
  {
    fichier: "src/server/actions/qualiopi/sessions.ts",
    doit: /refusSessionDEssai\(\{\s*etat: await lireInterrupteurQualiopi\(LOT_ESSAI\)/,
    pourquoi: "création d'un essai sous l'interrupteur `qualiopi.essai.actif`",
  },
  {
    fichier: "src/server/actions/qualiopi/enrollments.ts",
    doit: /cible\?\.estTestInterne === true \? \{ estTestInterne: true \}/,
    pourquoi: "l'inscription hérite du drapeau d'essai de sa session",
  },
  {
    fichier: "src/server/actions/qualiopi/sessions-recurrentes.ts",
    doit: /ancienne\.estTestInterne\s*\?\s*numeroEssai\("session"\)/,
    pourquoi: "report d'un essai : numéro `-ESSAI-`, jamais la suite légale",
  },
  {
    fichier: "src/server/queue/workers/qualiopi-formation-crons-worker.ts",
    doit: /estImportee: false,[\s\S]{0,120}\.\.\.FACTURE_HORS_ESSAI,/,
    pourquoi: "relance d'impayé : aucune proposition sur une facture d'essai",
  },
  {
    fichier: "src/server/actions/qualiopi/facturation-hub.ts",
    doit: /Relance \$\{libellePalier[\s\S]{0,260}entityType: "FactureFormation",\s*entityId: facture\.id/,
    pourquoi: "relance d'impayé : l'envoi est rattaché à la facture (liste blanche des essais)",
  },
  // ── Argent : aucun indicateur, aucune écriture comptable ───────────────────
  {
    fichier: "src/server/admin/pilotage-dashboard.ts",
    doit: /\.\.\.FACTURE_HORS_ESSAI,[\s\S]{0,200}emiseAt/,
    pourquoi: "CA émis du tableau de bord",
  },
  {
    fichier: "src/server/admin/pilotage-dashboard.ts",
    doit: /\.\.\.SESSION_REELLE,\s*statut: "realisee",\s*dateDebut/,
    pourquoi: "CA réalisé du tableau de bord",
  },
  {
    fichier: "src/server/qualiopi/remuneration/marge.ts",
    doit: /where: \{ \.\.\.SESSION_REELLE, statut: "realisee", dateDebut: plage \}/,
    pourquoi: "marges et consolidation mensuelle",
  },
  {
    fichier: "src/server/qualiopi/previsionnel/queries.ts",
    doit: /\.\.\.FACTURE_HORS_ESSAI,/,
    pourquoi: "prévisionnel de trésorerie",
  },
  {
    fichier: "src/server/actions/qualiopi/facturation-hub.ts",
    doit: /\.\.\.FACTURE_HORS_ESSAI,[\s\S]{0,120}emiseAt: \{ gte: debut, lt: fin \}/,
    pourquoi: "export FEC",
  },
  {
    fichier: "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/facturation/page.tsx",
    doit: /\.\.\.FACTURE_HORS_ESSAI,\s*statut: \{ in: \["emise"/,
    pourquoi: "KPI « CA émis » de la page facturation",
  },
  // ── Sorties qui ne s'exercent pas ici ─────────────────────────────────────
  {
    fichier: "src/features/apporteurs-reseau/passage-quotidien.ts",
    doit: /\.\.\.FACTURE_HORS_ESSAI,\s*statut: "payee"/,
    pourquoi: "commissions d'apporteur",
  },
  {
    fichier: "src/server/qualiopi/remuneration/statements.ts",
    doit: /where: \{ \.\.\.SESSION_REELLE, dateDebut: \{ gte: debut, lt: fin \} \}/,
    pourquoi: "relevés formateur (aucune ligne d'honoraires sur un essai)",
  },
  {
    fichier: "src/server/qualiopi/financements/facture-auto-regles.ts",
    doit: /\.\.\.SESSION_REELLE,\s*statut: "realisee",\s*dateFin/,
    pourquoi: "l'automate de facture ne charge pas les essais",
  },
  {
    fichier: "src/server/qualiopi/documents/signature/apres-signature.ts",
    doit: /sortieSaufEssai\(essai, alerteBloquee/,
    pourquoi: "alertes Telegram de signature",
  },
  {
    fichier: "src/server/qualiopi/trainers/convocation-formateur.ts",
    doit: /sortieSaufEssai\(\s*estNumeroEssai\(numeroSession\)/,
    pourquoi: "alerte Telegram « lettre de mission non signée »",
  },
  {
    fichier: "src/server/actions/qualiopi/portail.ts",
    doit: /void alerterTelegramAdaptation\(trainee\.id\)/,
    pourquoi: "alertes Telegram du portail stagiaire",
  },
  {
    fichier: "src/server/qualiopi/financements/e-invoicing/pa-adapter.ts",
    doit: /return avecGardeEssai\(new StubPaAdapter\(\)\)/,
    pourquoi: "tout adaptateur de Plateforme Agréée passe par la garde",
  },
];

describe("🔑 QNC L02 — chaque site garde son câblage d'essai", () => {
  for (const s of SITES) {
    it(`${s.fichier} — ${s.pourquoi}`, () => {
      expect(lire(s.fichier)).toMatch(s.doit);
    });
  }

  it("🔴 aucune alerte Telegram du portail ne part en direct (deux déclarations, une seule porte)", () => {
    const portail = lire("src/server/actions/qualiopi/portail.ts");
    expect(portail.match(/void alerterTelegramAdaptation\(/g)).toHaveLength(2);
    expect(portail).not.toMatch(/void sendTelegram\(/);
  });
});
