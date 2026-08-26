#!/usr/bin/env tsx
/**
 * Scénarios de recette de la CONSOLE — les cas que ni `qualiopi:seed-demo` ni la
 * fixture volumétrique ne fabriquent.
 *
 * ─── Pourquoi ce fichier existe ────────────────────────────────────────────
 *
 * L'audit « prise en main & fluidité » (cf.
 * `_AUDIT/PROMPT-CONSOLE-PRISE-EN-MAIN-FLUIDITE-50-AGENTS-2026-08-18.md`) juge la
 * console AU CLIC, sur ses 8 variantes de parcours et ses 17 crons. Mesuré le
 * 2026-08-25, après la séquence de semis complète, il manquait exactement trois
 * choses — et leur absence rendait des pans entiers de l'audit INVÉRIFIABLES :
 *
 *   1. `select type, count(*) from clients` → `entreprise | 301`, et RIEN d'autre.
 *      Aucun client PARTICULIER. La variante 2 du parcours (client particulier :
 *      droit de rétractation, CGV consommateur, facture au nom d'une personne
 *      physique) n'avait donc aucun support. Or c'est précisément la variante où
 *      le système est censé cesser de parler à une entreprise — un défaut déjà
 *      corrigé une fois côté pièces (#845), sans qu'aucune donnée locale ne
 *      permette de le REVOIR.
 *
 *   2. Un seul devis en base, celui de la démonstration, statut `accepte`. Le
 *      cron `formation-crons.devis-expiration` cherche `statut = envoye` et
 *      `dateValidite < now` : il ne trouvait jamais rien, et « le cron a tourné »
 *      ne prouvait donc rien du tout.
 *
 *   3. Une seule facture, payée. Le cron `formation-crons.factures-retard`
 *      cherche des factures émises dont l'échéance est dépassée : idem.
 *
 * ─── Ce que ce seed NE fait pas, et c'est délibéré ──────────────────────────
 *
 * Il ne pré-crée PAS le parcours de vente (client → devis → session →
 * inscription) que l'auditeur doit jouer LUI-MÊME au clic : ces gestes-là SONT
 * la mesure (combien de clics, combien de champs ressaisis). Pré-remplir ce que
 * l'on doit chronométrer reviendrait à effacer le résultat.
 *
 * Il fabrique uniquement les ÉTATS qu'on ne peut pas atteindre au clic en un
 * temps raisonnable : une facture échue depuis 45 jours, un devis expiré hier,
 * un dossier de particulier déjà soldé.
 *
 * ─── Sécurité ───────────────────────────────────────────────────────────────
 *
 * Deux verrous, les MÊMES que la fixture volumétrique — `cibleAutorisee()` est
 * IMPORTÉE, jamais recopiée : un prédicat de sécurité dupliqué diverge, et ce
 * dépôt a déjà payé quatre fois ce piège précis.
 *
 *   1. Liste blanche d'hôtes, refus par défaut (`garde-cible.ts`).
 *   2. Idempotence par `numero` préfixé `AXI-SCN-` : relancer n'ajoute rien.
 *      La purge (`--purge`) ne retire QUE ce préfixe, donc jamais le travail
 *      d'un autre.
 *
 * Usage :
 *   pnpm console:seed-scenarios            # écrit (ou remet à jour) les scénarios
 *   pnpm console:seed-scenarios --purge    # retire tout ce qu'il a écrit
 */

import { cibleAutorisee } from "../volumetrie/garde-cible";
import type { PrismaClient } from "../../generated/client";

/** Préfixe de TOUT ce que ce seed écrit. Sert aussi de périmètre de purge. */
export const PREFIXE_SCENARIOS = "AXI-SCN";

// ─────────────────────────────────────────────────────────────────────────────
// Dates — TOUJOURS relatives à maintenant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 Le point qui rend ce seed utile là où `seed-demo` ne l'était pas.
 *
 * `seed-demo` fige ses dates au 2026-03-10. Passé cette date, plus aucun cron ne
 * peut se déclencher dessus : la session est trop vieille pour la convocation
 * J-5, trop vieille pour la satisfaction J+1, trop vieille pour le suivi J+30.
 * Un semis à dates absolues a une date de péremption que rien n'annonce.
 *
 * Ici, tout est calculé depuis `maintenant` au moment de l'exécution : le jeu de
 * données tombe donc dans la fenêtre des crons quel que soit le jour où on le
 * lance.
 */
function jours(n: number, base: Date): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function aHeure(d: Date, h: number): Date {
  const x = new Date(d);
  x.setUTCHours(h, 0, 0, 0);
  return x;
}

// ─────────────────────────────────────────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultatScenarios {
  clientParticulier: string;
  devis: { numero: string; statut: string; echeance: string }[];
  factures: { numero: string; statut: string; echeance: string }[];
  sessionParticulier: string;
}

export async function ecrireScenarios(
  prisma: PrismaClient,
  maintenant: Date,
): Promise<ResultatScenarios> {
  // Une formation du catalogue sert de support : on ne duplique pas le catalogue,
  // qui est la SSOT de `qualiopi:seed`.
  const formation = await prisma.formation.findFirst({
    where: { statut: "actif" },
    orderBy: { createdAt: "asc" },
    select: { id: true, titre: true },
  });
  if (formation == null) {
    throw new Error("Aucune formation active en base — lancer `pnpm qualiopi:seed` avant ce seed.");
  }

  // ── 1. LE CLIENT PARTICULIER ────────────────────────────────────────────
  //
  // `raisonSociale` porte le nom civil : le modèle n'a pas de champ distinct, et
  // c'est justement ce que la variante 2 doit éprouver à l'écran — un écran qui
  // affiche « Raison sociale : Camille Berger » pour un particulier est un
  // constat, pas une fatalité du schéma.
  const clientNumero = `${PREFIXE_SCENARIOS}-CLI-PART-001`;
  const client = await prisma.client.upsert({
    where: { numero: clientNumero },
    update: {},
    create: {
      numero: clientNumero,
      type: "particulier",
      raisonSociale: "Camille Berger",
      // Pas de SIRET, pas de SIREN, pas d'IDCC, pas d'OPCO : un particulier n'en a
      // pas. Tout écran qui les exige pour avancer est un BLOQUANT de la variante 2.
      adresseRue: "14 rue des Alliés",
      adresseCodePostal: "38100",
      adresseVille: "Grenoble",
      adressePaysCode: "FR",
      contactNom: "Camille Berger",
      contactEmail: "camille.berger@scenario.axion-ia.invalid",
      contactTelephone: "+33 6 12 34 56 78",
      statut: "client_actif",
      source: "scenario-console",
      notes:
        "Scénario de recette — client PARTICULIER (variante 2 du parcours). " +
        "Financement personnel, droit de rétractation applicable, CGV consommateur.",
    },
    select: { id: true },
  });

  // ── 2. LA SESSION DU PARTICULIER ────────────────────────────────────────
  // Terminée il y a 3 jours : assez récente pour que la satisfaction à chaud et
  // l'attestation soient d'actualité, assez ancienne pour être « réalisée ».
  const sessionNumero = `${PREFIXE_SCENARIOS}-SES-PART-001`;
  const debutSession = aHeure(jours(-4, maintenant), 9);
  const finSession = aHeure(jours(-3, maintenant), 17);
  const session = await prisma.trainingSession.upsert({
    where: { numero: sessionNumero },
    update: {},
    create: {
      numero: sessionNumero,
      titreSession: `${formation.titre} — session particulier`,
      formationId: formation.id,
      clientId: client.id,
      dateDebut: debutSession,
      dateFin: finSession,
      modalite: "distanciel",
      montantHtCents: 120000,
      nbParticipantsPrevus: 1,
      statut: "realisee",
    },
    select: { id: true },
  });

  const trainee = await prisma.trainee.upsert({
    where: { email: "camille.berger@scenario.axion-ia.invalid" },
    update: {},
    create: {
      nom: "Berger",
      prenom: "Camille",
      email: "camille.berger@scenario.axion-ia.invalid",
      consentementFormation: true,
    },
    select: { id: true },
  });

  const dejaInscrit = await prisma.enrollment.findFirst({
    where: { sessionId: session.id, traineeId: trainee.id },
    select: { id: true },
  });
  if (dejaInscrit == null) {
    await prisma.enrollment.create({
      data: { sessionId: session.id, traineeId: trainee.id, statut: "presente" },
    });
  }

  // ── 3. LES DEVIS, DANS LES QUATRE ÉTATS QUI COMPTENT ────────────────────
  //
  // Le cron `devis-expiration` (06:45 UTC) cherche `statut = envoye` ET
  // `dateValidite < now`. Sans le troisième cas ci-dessous, il ne trouve rien —
  // et « le cron a tourné » ne prouve alors strictement rien.
  const devisVoulus = [
    {
      suffixe: "VALIDE",
      statut: "envoye" as const,
      validite: jours(20, maintenant),
      quoi: "envoyé, largement valide — ne doit PAS expirer",
    },
    {
      suffixe: "J1",
      statut: "envoye" as const,
      validite: aHeure(jours(1, maintenant), 23),
      quoi: "envoyé, expire demain — doit remonter en alerte, pas encore expirer",
    },
    {
      suffixe: "EXPIRE",
      statut: "envoye" as const,
      validite: aHeure(jours(-1, maintenant), 23),
      quoi: "envoyé, validité dépassée hier — LE cas que le cron doit attraper",
    },
    {
      suffixe: "ACCEPTE",
      statut: "accepte" as const,
      validite: jours(10, maintenant),
      quoi: "accepté — témoin négatif : le cron ne doit PAS y toucher",
    },
  ];

  const devisEcrits: ResultatScenarios["devis"] = [];
  for (const d of devisVoulus) {
    const numero = `${PREFIXE_SCENARIOS}-DEV-${d.suffixe}`;
    await prisma.devis.upsert({
      where: { numero },
      update: { statut: d.statut, dateValidite: d.validite },
      create: {
        numero,
        clientId: client.id,
        lignes: [
          {
            designation: `${formation.titre} — 1 participant`,
            quantite: 1,
            prixUnitaireHtCents: 120000,
            totalHtCents: 120000,
          },
        ],
        montantTotalHtCents: 120000,
        // Un particulier ne bénéficie pas de l'exonération 261-4-4° au même titre
        // qu'un employeur : la mention est celle du régime réellement appliqué.
        mentionTva: "TVA 20 % — prestation de formation facturée à un particulier",
        statut: d.statut,
        dateValidite: d.validite,
      },
    });
    devisEcrits.push({
      numero,
      statut: d.statut,
      echeance: d.validite.toISOString().slice(0, 10),
    });
  }

  // ── 4. LES FACTURES EN RETARD ───────────────────────────────────────────
  //
  // Le cron `factures-retard` passe `emise → en_retard` quand `echeanceAt` est
  // dépassée, propose une relance, et n'envoie AUCUN e-mail (relances manuelles,
  // par décision produit). Les trois cas ci-dessous permettent de voir les trois
  // comportements — dont le témoin négatif, sans lequel « rien ne s'est passé »
  // ne se distingue pas de « la garde ne marche pas ».
  const facturesVoulues = [
    {
      suffixe: "RETARD-15",
      statut: "emise" as const,
      echeance: jours(-15, maintenant),
      quoi: "échue depuis 15 jours — doit passer en_retard",
    },
    {
      suffixe: "RETARD-45",
      statut: "emise" as const,
      echeance: jours(-45, maintenant),
      quoi: "échue depuis 45 jours — relance de second niveau",
    },
    {
      suffixe: "A-ECHOIR",
      statut: "emise" as const,
      echeance: jours(20, maintenant),
      quoi: "à échoir — témoin négatif : ne doit PAS bouger",
    },
  ];

  const facturesEcrites: ResultatScenarios["factures"] = [];
  for (const f of facturesVoulues) {
    const numero = `${PREFIXE_SCENARIOS}-FAC-${f.suffixe}`;
    await prisma.factureFormation.upsert({
      where: { numero },
      update: { statut: f.statut, echeanceAt: f.echeance },
      create: {
        numero,
        // Destinataire `stagiaire` : c'est un particulier qui paie pour lui-même.
        // Toute pièce qui l'appelle « entreprise » ou « OPCO » est un constat —
        // le défaut a déjà existé en production (#841, #845).
        destinataire: "stagiaire",
        destinataireNom: "Camille Berger",
        montantHtCents: 120000,
        montantTvaCents: 24000,
        regimeTva: "assujetti",
        lignes: [
          {
            designation: `${formation.titre} — 1 participant`,
            quantite: 1,
            prixUnitaireHtCents: 120000,
            totalHtCents: 120000,
          },
        ],
        statut: f.statut,
        emiseAt: jours(-60, maintenant),
        echeanceAt: f.echeance,
        clientId: client.id,
        sessionId: session.id,
      },
    });
    facturesEcrites.push({
      numero,
      statut: f.statut,
      echeance: f.echeance.toISOString().slice(0, 10),
    });
  }

  return {
    clientParticulier: clientNumero,
    devis: devisEcrits,
    factures: facturesEcrites,
    sessionParticulier: sessionNumero,
  };
}

/** Retire tout ce que ce seed a écrit — et rien d'autre. */
export async function purgerScenarios(prisma: PrismaClient): Promise<void> {
  const prefixe = { startsWith: PREFIXE_SCENARIOS };
  await prisma.factureFormation.deleteMany({ where: { numero: prefixe } });
  await prisma.devis.deleteMany({ where: { numero: prefixe } });
  // Les inscriptions partent en cascade avec la session.
  await prisma.trainingSession.deleteMany({ where: { numero: prefixe } });
  await prisma.trainee.deleteMany({
    where: { email: { endsWith: "@scenario.axion-ia.invalid" } },
  });
  await prisma.client.deleteMany({ where: { numero: prefixe } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const verdict = cibleAutorisee({
    DATABASE_URL: process.env["DATABASE_URL"],
    NODE_ENV: process.env["NODE_ENV"],
  });
  if (!verdict.ok) {
    console.error(`\n⛔ Scénarios de console REFUSÉS — ${verdict.raison}\n   ${verdict.message}\n`);
    process.exit(1);
  }

  const { PrismaClient: Client } = await import("../../generated/client");
  const prisma = new Client() as unknown as PrismaClient;

  try {
    if (process.argv.includes("--purge")) {
      await purgerScenarios(prisma);
      console.log(`\n✅ [console:seed-scenarios] Scénarios ${PREFIXE_SCENARIOS}-* retirés.\n`);
      return;
    }

    const maintenant = new Date();
    const r = await ecrireScenarios(prisma, maintenant);

    console.log(`\n✅ [console:seed-scenarios] Scénarios écrits sur ${verdict.base}.\n`);
    console.log(`   Client particulier  ${r.clientParticulier} (variante 2 du parcours)`);
    console.log(`   Session             ${r.sessionParticulier} — distanciel, réalisée il y a 3 j`);
    console.log(
      `   Devis               ${r.devis.length} — dont un expiré hier et un témoin négatif`,
    );
    for (const d of r.devis) {
      console.log(`     · ${d.numero.padEnd(32)} ${d.statut.padEnd(10)} validité ${d.echeance}`);
    }
    console.log(
      `   Factures            ${r.factures.length} — dont deux échues et un témoin négatif`,
    );
    for (const f of r.factures) {
      console.log(`     · ${f.numero.padEnd(32)} ${f.statut.padEnd(10)} échéance ${f.echeance}`);
    }
    console.log(
      `\n   Les dates sont RELATIVES à l'exécution : les crons devis-expiration et\n` +
        `   factures-retard trouvent de la matière quel que soit le jour du lancement.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const estPointDEntree =
  process.argv[1] != null && process.argv[1].replace(/\\/g, "/").includes("scenarios-console");
if (estPointDEntree) {
  void main();
}
