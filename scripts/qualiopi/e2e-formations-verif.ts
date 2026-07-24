/**
 * Vérification e2e « session de formation COLLECTIVE complète » (throwaway DB).
 *
 * Miroir collectif de e2e-afest-verif.ts. Seede une session réelle (offre +
 * formation + session réalisée OPCO + client + 3 stagiaires inscrits présents)
 * puis fait tourner TOUTE la chaîne :
 *   14 documents réglementaires (generateDocument + templates) → attestations
 *   (heures × taux) → factures OPCO horaire / entreprise / France Travail →
 *   conformité (22 indicateurs) → mode auditeur (manifeste) → BPF. Rend des PDF.
 *
 * Lancer avec DATABASE_URL pointant sur la DB jetable. Sortie : JSON résumé +
 * PDF dans _AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14/pdf/.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import React from "react";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { genererFactureFormation } from "@/server/qualiopi/financements/facturation-service";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";
import { evaluerConformite } from "@/server/qualiopi/conformite/conformite-service";
import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";
import { computeBpf } from "@/server/qualiopi/bpf/service";
// Templates (mêmes que les Server Actions documents.ts)
import { ConventionPdf } from "@/server/qualiopi/documents/templates/convention";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { ContratFormationPdf } from "@/server/qualiopi/documents/templates/contrat-formation";
import { ConvocationPdf } from "@/server/qualiopi/documents/templates/convocation";
import { EmargementPdf } from "@/server/qualiopi/documents/templates/emargement";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { GrilleEvaluationPdf } from "@/server/qualiopi/documents/templates/grille-evaluation";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { KitOpcoPdf } from "@/server/qualiopi/documents/templates/kit-opco";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";
import { ReglementInterieurPdf } from "@/server/qualiopi/documents/templates/reglement-interieur";
import { LivretAccueilPdf } from "@/server/qualiopi/documents/templates/livret-accueil";

const OUT_DIR =
  "C:/Users/willi/Documents/Projets/Axion-IA/axionia/.claude/worktrees/qualiopi-1to1/_AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14";
const PDF_DIR = `${OUT_DIR}/pdf`;
const fmt = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

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
  const identite = await getOrganismeIdentite();
  const stamp = Date.now();

  // ── Fixture : session collective réalisée, financée OPCO ───────────────────
  const offre = await prisma.offreSite.create({
    data: {
      code: `OFF-E2E-${stamp}`,
      titreFr: "Maîtriser l'IA générative en équipe",
      slug: `offre-e2e-${stamp}`,
      formatPedagogique: "collectif_2jours",
      publicViseFr: "Salariés et dirigeants de TPE/PME souhaitant intégrer l'IA à leurs process.",
      dureeHeuresMin: 14,
      dureeHeuresMax: 14,
      tarifType: "fixe",
      promessePrincipaleFr: "Gagner 1 journée par semaine grâce à l'IA générative.",
      anglePedagogiqueFr: "Atelier pratique sur les cas réels de l'entreprise.",
    },
  });
  const formation = await prisma.formation.create({
    data: {
      numero: `AXI-FORMP-${stamp}`,
      titre: "Maîtriser l'IA générative en équipe",
      slug: `formation-e2e-${stamp}`,
      offreSiteId: offre.id,
      dureeHeures: 14,
      objectifsPedagogiques: [
        { id: "o1", description: "Rédiger des prompts efficaces" },
        { id: "o2", description: "Automatiser des tâches bureautiques avec l'IA" },
      ],
    },
  });
  const client = await prisma.client.create({
    data: {
      numero: `AXI-CLI-${stamp}`,
      raisonSociale: "BÊTA Industries SARL",
      siret: "12345678900021",
      adresse: "8 avenue des Tests, 38000 Grenoble",
      contactNom: "Claire Martin",
      contactEmail: "claire.martin@beta.test",
      opcoIdentifie: "OPCO 2i",
      opcoNumeroAdherent: "ADH-998877",
    },
  });
  const session = await prisma.trainingSession.create({
    data: {
      numero: `AXI-SESS-${stamp}`,
      titreSession: "Maîtriser l'IA générative en équipe — session juin 2026",
      formationId: formation.id,
      clientId: client.id,
      dateDebut: new Date("2026-03-10"),
      dateFin: new Date("2026-03-11"),
      modalite: "presentiel",
      nbParticipantsPrevus: 3,
      nbParticipantsReels: 3,
      dureeReelleHeures: 14,
      montantHtCents: 360000,
      statut: "realisee",
      financementType: "opco",
      opcoSubrogation: true,
      numeroDossierOpco: "OPCO2I-DOSSIER-7788",
      priseEnChargeMontantCents: 2500, // 25 €/h
      priseEnChargeUnite: "euro_heure",
      coFormateurs: [{ prenom: "Jean", nom: "Formateur" }] as never,
    },
  });

  const traineesData = [
    { nom: "Durand", prenom: "Alice", fonction: "Responsable RH" },
    { nom: "Bernard", prenom: "Hugo", fonction: "Chargé de communication" },
    { nom: "Petit", prenom: "Léa", fonction: "Assistante commerciale" },
  ];
  const enrollments: Array<{ id: string; traineeNom: string; traineePrenom: string }> = [];
  for (const t of traineesData) {
    const trainee = await prisma.trainee.create({
      data: {
        nom: t.nom,
        prenom: t.prenom,
        email: `${t.prenom.toLowerCase()}-${stamp}@beta.test`,
        entreprise: "BÊTA Industries SARL",
        fonction: t.fonction,
      },
    });
    const enr = await prisma.enrollment.create({
      data: {
        sessionId: session.id,
        traineeId: trainee.id,
        statut: "presente",
        tauxPresencePct: 100,
      },
    });
    enrollments.push({ id: enr.id, traineeNom: t.nom, traineePrenom: t.prenom });
  }

  const objectifs = ["Rédiger des prompts efficaces", "Automatiser des tâches bureautiques"];
  const dD = fmt(new Date(session.dateDebut));
  const dF = fmt(new Date(session.dateFin));
  const lieu = identite.adresseExercice || identite.adresseSiege || "—";
  const prixHt = session.montantHtCents / 100;
  const enr0 = enrollments[0]!;
  const gen = async (type: string, element: React.ReactElement, refs: Record<string, string>) => {
    const r = await generateDocument({ type: type as never, buildElement: () => element, refs });
    return { type, numero: r.numero, documentId: r.id };
  };

  // ── 1..15 documents réglementaires ─────────────────────────────────────────
  const docs: Array<{ type: string; numero: string; documentId: string }> = [];
  docs.push(
    await gen(
      "convention",
      React.createElement(ConventionPdf, {
        data: {
          numero: "PENDING",
          client: {
            raisonSociale: client.raisonSociale,
            siret: client.siret!,
            adresse: client.adresse!,
            contact: client.contactNom!,
          },
          intitule: session.titreSession,
          objectifs,
          publicVise: offre.publicViseFr,
          dureeHeures: formation.dureeHeures,
          dateDebut: dD,
          dateFin: dF,
          modalite: "Présentiel",
          lieu,
          effectif: 3,
          prixHt,
          dateConvention: fmt(new Date()),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "convention_tripartite",
      React.createElement(ConventionTripartitePdf, {
        data: {
          numero: "PENDING",
          client: {
            raisonSociale: client.raisonSociale,
            siret: client.siret!,
            adresse: client.adresse!,
            contact: client.contactNom!,
          },
          opco: { nom: client.opcoIdentifie!, numeroPriseEnCharge: session.numeroDossierOpco! },
          intitule: session.titreSession,
          objectifs,
          publicVise: offre.publicViseFr,
          dureeHeures: formation.dureeHeures,
          dateDebut: dD,
          dateFin: dF,
          modalite: "Présentiel",
          lieu,
          effectif: 3,
          prixHt,
          montantPrisEnCharge: 350,
          resteAChargeClient: prixHt - 350,
          dateConvention: fmt(new Date()),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "contrat",
      React.createElement(ContratFormationPdf, {
        data: {
          numero: "PENDING",
          stagiaire: { nomPrenom: `${enr0.traineePrenom} ${enr0.traineeNom}` },
          intitule: session.titreSession,
          objectifs,
          dureeHeures: formation.dureeHeures,
          dateDebut: dD,
          dateFin: dF,
          modalite: "Présentiel",
          lieu,
          prixNet: prixHt,
          dateContrat: fmt(new Date()),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "convocation",
      React.createElement(ConvocationPdf, {
        data: {
          numero: "PENDING",
          intituleFormation: session.titreSession,
          dateDebut: dD,
          dateFin: dF,
          horaires: "09h00–17h00",
          dureeHeures: formation.dureeHeures,
          modalite: "présentiel",
          nomFormateur: "Jean Formateur",
          contactEmail: identite.email,
          nomStagiaire: `${enr0.traineePrenom} ${enr0.traineeNom}`,
          entreprise: "BÊTA Industries SARL",
          financement: "opco",
          numeroOrdrePriseEnCharge: session.numeroDossierOpco!,
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "emargement",
      React.createElement(EmargementPdf, {
        data: {
          numero: "PENDING",
          intituleFormation: session.titreSession,
          numeroSession: session.numero,
          lieu,
          nda: identite.nda,
          journees: [
            {
              dateLisible: "mercredi 10 juin 2026",
              horaires: "09:00–17:00",
              formateurNom: "Jean Formateur",
              modules: ["Module 1 — Cadrage"],
              entetes: ["Matin", "Après-midi"],
              lignes: enrollments.map((e) => ({
                nom: `${e.traineePrenom} ${e.traineeNom}`,
                entreprise: "",
                cases: ["", ""],
                ancrage: "—",
              })),
              contresignatures: [],
              contresignaturesManquantes: ["Matin", "Après-midi"],
            },
          ],
          totalSignatures: 0,
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "positionnement",
      React.createElement(PositionnementPdf, {
        data: { numero: "PENDING", intituleFormation: session.titreSession, dateSession: dD },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "grille_evaluation",
      React.createElement(GrilleEvaluationPdf, {
        data: {
          numero: "PENDING",
          intituleFormation: session.titreSession,
          dateEvaluation: dF,
          typeEvaluation: "finale",
          nomFormateur: "Jean Formateur",
          nomStagiaire: `${enr0.traineePrenom} ${enr0.traineeNom}`,
          competences: objectifs.map((libelle) => ({ libelle })),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "satisfaction",
      React.createElement(SatisfactionPdf, {
        data: { numero: "PENDING", intituleFormation: session.titreSession, dateSession: dF },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "certificat_realisation",
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero: "PENDING",
          dateEmission: fmt(new Date()),
          identite,
          entreprise: {
            raisonSociale: client.raisonSociale,
            siret: client.siret!,
            adresse: client.adresse!,
          },
          stagiaire: {
            nom: enr0.traineeNom,
            prenom: enr0.traineePrenom,
            fonction: "Responsable RH",
          },
          intituleAction: formation.titre,
          dateDebut: dD,
          dateFin: dF,
          dureeHeures: 14,
        },
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "kit_opco",
      React.createElement(KitOpcoPdf, {
        data: {
          numero: "PENDING",
          dateEmission: fmt(new Date()),
          identite,
          nomOpco: client.opcoIdentifie!,
          numeroDossier: session.numeroDossierOpco!,
          intituleFormation: session.titreSession,
          dateDebut: dD,
          dateFin: dF,
          ventilation: enrollments.map((e) => ({
            nomParticipant: `${e.traineePrenom} ${e.traineeNom}`,
            heuresRealisees: 14,
            baremePrisEnChargeHeureCents: 2500,
            montantPrisEnChargeCents: 35000,
            resteAChargeCents: 85000,
          })),
          totalPrisEnChargeCents: 105000,
          totalResteAChargeCents: 255000,
        },
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "kit_cpf",
      React.createElement(KitCpfPdf, {
        data: {
          numero: "PENDING",
          dateEmission: fmt(new Date()),
          identite,
          beneficiaire: { nom: enr0.traineeNom, prenom: enr0.traineePrenom },
          codeCpf: "RS-COLL-TEST",
          intituleFormation: session.titreSession,
          dateDebut: dD,
          dateFin: dF,
          montantCpfCents: 100000,
          resteAChargeCents: 20000,
          coutTotalCents: 120000,
        },
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "kit_france_travail",
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero: "PENDING",
          dateEmission: fmt(new Date()),
          identite,
          dispositif: "AIF",
          beneficiaire: { nom: enr0.traineeNom, prenom: enr0.traineePrenom },
          intituleFormation: session.titreSession,
          dateDebut: dD,
          dateFin: dF,
          montants: {
            montantAideFranceTravailCents: 120000,
            resteAChargeCents: 0,
            coutTotalCents: 120000,
          },
        },
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "lettre_mission",
      React.createElement(LettreMissionPdf, {
        data: {
          numero: "PENDING",
          formateur: {
            nomPrenom: "Jean Formateur",
            adresse: "—",
            email: identite.email,
            specialite: "Formation IA",
          },
          objetMission: "Animation de la formation professionnelle continue.",
          formations: [
            {
              intitule: session.titreSession,
              dateDebut: dD,
              dateFin: dF,
              lieuOuModalite: "Présentiel",
              dureeHeures: 14,
            },
          ],
          tarifJourHt: 0,
          dateMission: fmt(new Date()),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "reglement_interieur",
      React.createElement(ReglementInterieurPdf, {
        data: { numero: "PENDING", dateVersion: fmt(new Date()) },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  docs.push(
    await gen(
      "livret_accueil",
      React.createElement(LivretAccueilPdf, {
        data: {
          numero: "PENDING",
          contactPedagogique: { nomPrenom: "Jean Formateur", email: identite.email },
          dateVersion: fmt(new Date()),
        },
        identite,
      }),
      { sessionId: session.id },
    ),
  );
  report.documents = docs;
  report.nbDocuments = docs.length;

  // ── Attestations (heures × taux) ───────────────────────────────────────────
  report.attestations = [];
  for (const e of enrollments) {
    const a = await genererAttestationPourEnrollment(e.id);
    (report.attestations as unknown[]).push({
      enrollment: `${e.traineePrenom} ${e.traineeNom}`,
      resultat: a.resultat,
    });
  }

  // ── Factures : OPCO horaire + entreprise forfait + France Travail forfait ───
  report.factureOpcoHoraire = await genererFactureFormation({
    sessionId: session.id,
    destinataire: "opco",
    ventilation: "horaire",
  });
  report.factureEntreprise = await genererFactureFormation({
    sessionId: session.id,
    destinataire: "entreprise",
    ventilation: "forfait",
  });
  report.factureFranceTravail = await genererFactureFormation({
    sessionId: session.id,
    destinataire: "france_travail",
    ventilation: "forfait",
  });

  // ── Conformité 22 indicateurs + mode auditeur + BPF ────────────────────────
  const conf = await evaluerConformite();
  report.conformite = {
    scorePct: conf.scorePct,
    nbIndicateurs: conf.indicateurs.length,
    couverts: conf.indicateurs.filter((i) => i.statut === "couvert").length,
    aCompleter: conf.indicateurs.filter((i) => i.statut === "a_completer").length,
    nonApplicables: conf.indicateurs.filter((i) => i.statut === "non_applicable").length,
  };
  const manifeste = await genererManifesteAudit();
  report.manifesteIndicateurs = manifeste.json.indicateurs?.length ?? 0;
  const bpf = await computeBpf(2026);
  report.bpf = {
    nbSessions: bpf.nbSessions,
    nbStagiairesDistincts: bpf.nbStagiairesDistincts,
    nbHeuresStagiaires: bpf.nbHeuresStagiaires,
    nbHeuresStagiairesCollectif: bpf.nbHeuresStagiairesCollectif,
    caTotalHtCents: bpf.caTotalHtCents,
    caOpco: bpf.caParFinanceur.opco,
  };

  // ── PDF réels (convention + certificat) ────────────────────────────────────
  const conv = await renderPdfToBuffer(
    React.createElement(ConventionPdf, {
      data: {
        numero: formatDocumentNumber("formation", new Date().getFullYear(), 1),
        client: {
          raisonSociale: client.raisonSociale,
          siret: client.siret!,
          adresse: client.adresse!,
          contact: client.contactNom!,
        },
        intitule: session.titreSession,
        objectifs,
        publicVise: offre.publicViseFr,
        dureeHeures: 14,
        dateDebut: dD,
        dateFin: dF,
        modalite: "Présentiel",
        lieu,
        effectif: 3,
        prixHt,
        dateConvention: fmt(new Date()),
      },
      identite,
    }),
  );
  writeFileSync(`${PDF_DIR}/convention-collective.pdf`, conv.buffer);
  report.pdfConventionBytes = conv.buffer.length;
  report.pdfIsValid = conv.buffer.subarray(0, 5).toString() === "%PDF-";

  writeFileSync(`${OUT_DIR}/e2e-formations-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("E2E FORMATIONS FAIL:", e);
  process.exit(1);
});
