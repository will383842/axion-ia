/**
 * Vérification e2e « dossier AFEST 1-to-1 complet » (throwaway DB).
 *
 * Seede un parcours AFEST réel (bénéficiaire + tuteur + 3 séances avec durées,
 * cartographie, mises en situation, phases réflexives, évaluation finale,
 * contrat OPCO) puis fait tourner TOUTE la chaîne :
 *   protocole → attestation (heures = Σ séances) → facture OPCO → conformité
 *   (off.13/14/15/28) → mode auditeur (manifeste). Rend aussi les PDF réels.
 *
 * Lancer avec DATABASE_URL pointant sur la DB jetable. Sortie : JSON résumé +
 * PDF dans _AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14/pdf/.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import React from "react";
import { prisma } from "@/lib/prisma";
import { genererProtocoleAfest } from "@/server/qualiopi/coaching-afest/protocole-1to1";
import { genererAttestation1to1 } from "@/server/qualiopi/coaching-afest/attestation-1to1";
import { genererFactureCoaching } from "@/server/qualiopi/coaching-afest/facturation-1to1";
import { genererEmargement1to1 } from "@/server/qualiopi/coaching-afest/emargement-1to1";
import { getHeuresReelles1to1 } from "@/server/qualiopi/coaching-afest/heures";
import { validateCoachingFinancement } from "@/server/qualiopi/coaching-afest/financement-1to1";
import {
  genererKitOpcoCoaching,
  genererKitCpfCoaching,
  genererKitFranceTravailCoaching,
  genererConventionTripartiteCoaching,
  genererCertificat1to1,
} from "@/server/qualiopi/coaching-afest/kits-1to1";
import { computeBpf, bpfToCsv } from "@/server/qualiopi/bpf/service";
import { evaluerConformite } from "@/server/qualiopi/conformite/conformite-service";
import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ProtocoleAfestPdf } from "@/server/qualiopi/documents/templates/protocole-afest";

const OUT_DIR =
  "C:/Users/willi/Documents/Projets/Axion-IA/axionia/.claude/worktrees/qualiopi-1to1/_AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14";
const PDF_DIR = `${OUT_DIR}/pdf`;

async function seedConfig() {
  const set = async (key: string, value: string) => {
    try {
      await prisma.siteSetting.upsert({
        where: { key: `qualiopi.${key}` },
        create: { key: `qualiopi.${key}`, value: value as never, category: "qualiopi" },
        update: { value: value as never },
      });
    } catch {
      /* defaults si échec */
    }
  };
  await set("raison_sociale", "Axion-IA SAS");
  await set("site_url", "https://axion-ia.com");
  await set("adresse_siege", "Saint-Lattier (Isère)");
  await set("nda_numero", "NDA-TEST-PLACEHOLDER");
  await set("qualiopi_numero", "QUALIOPI-TEST-PLACEHOLDER");
  await set("siret", "SIRET-TEST-PLACEHOLDER");
}

async function main() {
  mkdirSync(PDF_DIR, { recursive: true });
  const report: Record<string, unknown> = {};

  await seedConfig();

  // ── Fixture : parcours AFEST complet ───────────────────────────────────────
  const trainer = await prisma.trainer.create({
    data: {
      nom: "Formateur",
      prenom: "AFEST",
      email: `coach-${Date.now()}@axion-ia.test`,
      statut: "salarie",
      afestHabiliteAt: new Date("2026-01-15"),
    },
  });
  const trainee = await prisma.trainee.create({
    data: {
      nom: "Dupont",
      prenom: "Marie",
      email: `benef-${Date.now()}@client.test`,
      entreprise: "ACME SARL",
      fonction: "Assistante de direction",
    },
  });
  const client = await prisma.client.create({
    data: {
      numero: `AXI-CLI-${Date.now()}`,
      raisonSociale: "ACME SARL",
      adresse: "12 rue du Test, 38000 Grenoble",
      opcoIdentifie: "OPCO Atlas",
    },
  });
  const contrat = await prisma.coachingContract.create({
    data: {
      numero: `AXI-FORM-2026-E2E-${Date.now()}`,
      traineeId: trainee.id,
      clientId: client.id,
      interventionSlug: "coaching-decouverte",
      montantHtCents: 99000,
      financementType: "opco",
      subrogation: true,
      numeroDossierOpco: "OPCO-DOSSIER-TEST-001",
      // Dossier OPCO subrogé → convention tripartite signée (L.6353-2), pré-requis
      // bloquant de la facturation (cf. validateCoachingFinancement).
      conventionTripartiteSigneeAt: new Date("2026-02-15"),
    },
  });
  const cs = await prisma.coachingSession.create({
    data: {
      trainerId: trainer.id,
      traineeId: trainee.id,
      coachingContractId: contrat.id,
      interventionSlug: "coaching-decouverte",
      dateSeance: new Date("2026-03-01"),
      statut: "realisee",
      estAfest: true,
      heuresPrevuesConvention: 14,
      tuteurEntrepriseNom: "Chef Service",
      tuteurEntrepriseEmail: "tuteur@client.test",
      objectifsPedagogiques: [
        { id: "o1", libelle: "Automatiser le tri des emails avec l'IA" },
        { id: "o2", libelle: "Générer des comptes-rendus de réunion" },
      ],
    },
  });
  await prisma.cartographieActivite.create({
    data: {
      coachingSessionId: cs.id,
      taches: [
        { tache: "Tri et classement des emails", frequence: "quotidienne" },
        { tache: "Rédaction de comptes-rendus", frequence: "hebdomadaire" },
        { tache: "Préparation de présentations", frequence: "mensuelle" },
      ],
      chronophages: "Tri manuel des emails (2h/jour)",
      irritants: "Ressaisie d'informations",
    },
  });
  // 3 séances : 300 + 300 + 240 = 840 min = 14 h réelles
  for (const [i, duree] of [300, 300, 240].entries()) {
    await prisma.compteRenduSeance.create({
      data: {
        coachingSessionId: cs.id,
        dateSeance: new Date(`2026-03-0${i + 1}`),
        dureeMinutes: duree,
        objectifs: `Séance ${i + 1}`,
        misesEnSituation: [
          {
            cas: `Traiter la boîte mail réelle (séance ${i + 1})`,
            usageIa: "Claude",
            resultat: "ok",
            autonomie: "guidée",
          },
        ],
        phasesReflexives: [
          {
            situation: `Analyse de la pratique séance ${i + 1}`,
            apprentissage: "Gain d'autonomie",
          },
        ],
        planRemis: i === 2,
        // Présence signée (preuve d'audit AFEST).
        beneficiairePresent: true,
        beneficiaireSigneAt: new Date(`2026-03-0${i + 1}`),
        formateurSigneAt: new Date(`2026-03-0${i + 1}`),
        presenceSigneeAt: new Date(`2026-03-0${i + 1}`),
      },
    });
  }
  await prisma.evaluationAcquis.create({
    data: {
      coachingSessionId: cs.id,
      type: "finale",
      dateEvaluation: new Date("2026-03-03"),
      scoreObtenu: 9,
      scoreMax: 9,
      scorePct: 100,
      niveauGlobal: "acquis",
      reussite: true,
      competences: [],
    },
  });

  // ── Chaîne e2e ─────────────────────────────────────────────────────────────
  report.heuresReelles = await getHeuresReelles1to1(cs.id); // attendu 14
  report.protocole = await genererProtocoleAfest(cs.id);
  report.protocoleIdempotent = await genererProtocoleAfest(cs.id); // doit renvoyer le MÊME doc
  report.emargement = await genererEmargement1to1(cs.id);
  report.attestation = await genererAttestation1to1(cs.id); // attendu complete, 14 h
  report.facture = await genererFactureCoaching(contrat.id);

  // ── Parité financement : OPCO ventilation + CPF + France Travail + RNCP/RS ───
  // Enrichit le contrat d'un barème horaire (50 €/h) + convention tripartite +
  // EDOF + date de signature (pour le CA BPF). Le parcours devient certifiant RS.
  await prisma.coachingContract.update({
    where: { id: contrat.id },
    data: {
      dateSigneeAt: new Date("2026-02-15"),
      conventionTripartiteSigneeAt: new Date("2026-02-15"),
      priseEnChargeMontantCents: 5000, // 50 €/h
      priseEnChargeUnite: "euro_heure",
      priseEnChargeReleveLe: new Date("2026-02-15"),
      edofVerifieAt: new Date("2026-02-10"),
      resteAChargeCents: 0,
      ftDispositif: "aif",
      ftAifPrescriptionDate: new Date("2026-02-12"),
    },
  });
  await prisma.coachingSession.update({
    where: { id: cs.id },
    data: { certificationType: "rs", codeRs: "RS-TEST-1234", cpfEligible: true },
  });

  const contratFin = await prisma.coachingContract.findUniqueOrThrow({
    where: { id: contrat.id },
    select: {
      financementType: true,
      montantHtCents: true,
      subrogation: true,
      numeroDossierOpco: true,
      conventionTripartiteSigneeAt: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      edofVerifieAt: true,
      resteAChargeCents: true,
      ftDispositif: true,
      ftAifPrescriptionDate: true,
      ftPoeiOffreEmploiNumero: true,
      ftPoeiAccordFinancementAt: true,
      ftPoeiEngagementSigneAt: true,
    },
  });
  report.financementValidation = validateCoachingFinancement(contratFin); // attendu null (OK)

  report.kitOpco = await genererKitOpcoCoaching(cs.id);
  report.kitCpf = await genererKitCpfCoaching(cs.id);
  report.kitFranceTravail = await genererKitFranceTravailCoaching(cs.id);
  report.conventionTripartite = await genererConventionTripartiteCoaching(cs.id);
  report.certificat = await genererCertificat1to1(cs.id);
  report.certificatIdempotent = await genererCertificat1to1(cs.id); // MÊME doc

  // Facture financement-aware : ventilation horaire OPCO (14 h × 50 € = 70000).
  report.factureVentilation = await genererFactureCoaching(contrat.id);

  // BPF : la contribution coaching doit apparaître (heures + CA + ligne CSV).
  const bpf = await computeBpf(2026);
  report.bpf = {
    nbHeuresStagiaires: bpf.nbHeuresStagiaires,
    nbHeuresStagiairesCoaching: bpf.nbHeuresStagiairesCoaching,
    nbCoachingParcours: bpf.nbCoachingParcours,
    caTotalHtCents: bpf.caTotalHtCents,
    caOpco: bpf.caParFinanceur.opco,
  };
  report.bpfCsvMentionneCoaching = bpfToCsv(bpf).includes("coaching AFEST 1-to-1");

  const conf = await evaluerConformite();
  // off.28 = AFEST (doit être couvert) ; off.13/14/15 = apprentissage (non applicable).
  report.indicateursAfest = [13, 14, 15, 28].map((n) => {
    const ind = conf.indicateurs.find((i) => i.numero === n);
    return { numero: n, statut: ind?.statut, preuves: ind?.preuves };
  });
  report.scoreConformite = conf.scorePct;

  const manifeste = await genererManifesteAudit();
  const indManifeste = manifeste.json.indicateurs?.filter?.((i: { numero: number }) =>
    [13, 14, 15, 28].includes(i.numero),
  );
  report.modeAuditeurAfest = indManifeste;

  // Documents rattachés au parcours
  report.documentsGeneres = await prisma.documentGenere.findMany({
    where: { coachingSessionId: cs.id },
    select: {
      type: true,
      numero: true,
      qrToken: true,
      suppressionPrevueAt: true,
      hashSha256: true,
    },
  });
  report.facturesContrat = await prisma.factureFormation.findMany({
    where: { coachingContractId: contrat.id },
    select: {
      numero: true,
      destinataire: true,
      tvaExoneree: true,
      subrogation: true,
      numeroDossierOpco: true,
    },
  });

  // ── Rend un PDF réel (protocole) pour inspection ────────────────────────────
  const identite = await getOrganismeIdentite();
  const { buffer } = await renderPdfToBuffer(
    React.createElement(ProtocoleAfestPdf, {
      data: {
        numero: "AXI-FORM-2026-PREVIEW",
        dateEmission: "01/03/2026",
        identite,
        intitule: "Collaborateur · Optimisation du poste",
        beneficiaire: {
          nom: "Dupont",
          prenom: "Marie",
          entreprise: "ACME SARL",
          fonction: "Assistante",
        },
        formateurAfest: { nom: "AFEST Formateur", role: "Formateur / accompagnateur AFEST" },
        tuteurEntreprise: { nom: "Chef Service", role: "Tuteur entreprise" },
        analyseActivite:
          "3 tâches cartographiées. Chronophages : tri des emails. Irritants : ressaisie.",
        objectifs: ["Automatiser le tri des emails", "Générer des comptes-rendus"],
        misesEnSituation: ["Mise en situation sur l'activité : Tri des emails"],
        phasesReflexives: "Analyse réflexive après chaque mise en situation.",
        modalitesEvaluation: "Positionnement amont, évaluation finale, satisfaction.",
        dureePrevueHeures: 14,
        dateDebut: "01/03/2026",
        dateFin: "03/03/2026",
        perimetreCertifie: false,
        qrToken: "preview-token",
      },
    }),
  );
  writeFileSync(`${PDF_DIR}/protocole-afest.pdf`, buffer);
  report.pdfProtocoleBytes = buffer.length;
  report.pdfIsValid = buffer.subarray(0, 5).toString() === "%PDF-";

  writeFileSync(`${OUT_DIR}/e2e-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("E2E FAIL:", e);
  process.exit(1);
});
