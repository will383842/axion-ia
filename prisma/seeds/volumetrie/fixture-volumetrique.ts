#!/usr/bin/env tsx
/**
 * T0 — La fixture volumétrique. **Bloquante pour tout critère de performance.**
 *
 * ## Pourquoi elle existe
 *
 * La console est aujourd'hui mesurée sur **3 sessions et 2 inscriptions**. À ce
 * volume, tout est rapide et tout tient à l'écran : un `findMany` sans `take`,
 * un compteur calculé en mémoire sur la totalité d'une table, une liste sans
 * pagination — rien de tout cela ne se voit. Les défauts de charge ne sont pas
 * hypothétiques pour autant : ils sont **invisibles**, ce qui n'est pas la même
 * chose. Un chiffre mesuré sur 3 sessions ne dit rien de 1 200.
 *
 * Cette fixture crée le volume cible, de façon **reproductible** : même graine →
 * exactement la même base. Sans reproductibilité, deux mesures ne se comparent
 * pas, et une « amélioration » peut n'être qu'un jeu de données plus favorable.
 *
 * ## Le volume, et pourquoi celui-là
 *
 * Il vient de `_PLANS/2026-08-15_PLAN-TENUE-A-LA-CHARGE.md` § T0. Le point le
 * moins évident est le dernier : **un tiers des sessions en inter-entreprises
 * avec PLUSIEURS financeurs par session**. Sans lui, le mécanisme multi-payeurs
 * (T4a) n'est jamais exercé : chaque dossier n'a qu'une créance, la ventilation
 * ne ventile rien, et le calcul du reste à charge reste une addition à un terme.
 * Un jeu de données qui ne contient que le cas simple prouve que le cas simple
 * marche.
 *
 * ## Deux verrous avant d'écrire
 *
 * 1. `cibleAutorisee()` — liste BLANCHE d'hôtes, refus par défaut (cf.
 *    `garde-cible.ts`).
 * 2. `baseVierge()` — la base ne doit contenir aucune donnée métier hors
 *    fixture. C'est ce verrou-ci qui attrape le cas que le premier ne peut pas
 *    voir : un tunnel SSH exposant la production sur `localhost`.
 *
 * Usage : `pnpm volumetrie:seed` — puis `pnpm volumetrie:mesure`.
 */

import type { Prisma, PrismaClient } from "../../generated/client";
import { cibleAutorisee } from "./garde-cible";

// ─────────────────────────────────────────────────────────────────────────────
// Le volume cible — SSOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Ces chiffres sont la référence de TOUTE mesure de performance du dépôt.
 * Les changer invalide la baseline committée : le gate de volumétrie compare
 * `VOLUMES` à ceux inscrits dans `_AUDIT/BASELINE-VOLUMETRIQUE.json` et rougit
 * s'ils divergent. C'est voulu — une baseline mesurée à un autre volume n'est
 * pas une baseline, c'est un chiffre qui ressemble à une baseline.
 */
export const VOLUMES = {
  formateurs: 100,
  clients: 300,
  formations: 40,
  sessions: 1200,
  stagiaires: 3000,
  inscriptions: 8000,
  documents: 6000,
  alertesOuvertes: 400,
  /** Un tiers des sessions, avec 2 à 4 financeurs chacune. */
  sessionsInterEntreprises: 400,
  moisCouverts: 12,
} as const;

/** Préfixe porté par TOUTE ligne de la fixture. C'est lui qui la rend annulable. */
export const PREFIXE_FIXTURE = "AXI-VOL";

/** Domaine réservé RFC 6761 : aucun e-mail de la fixture ne peut partir. */
const DOMAINE_FIXTURE = "volumetrie.axion-ia.invalid";

// ─────────────────────────────────────────────────────────────────────────────
// Générateur pseudo-aléatoire déterministe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `Math.random()` rendrait chaque exécution différente, donc chaque mesure
 * incomparable à la précédente. Mulberry32 : même graine, même suite, sur toute
 * machine et toute version de Node.
 */
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entier(r: () => number, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

function choisir<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les données — construites SANS base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Les lignes sont typées sur les entrées Prisma RÉELLES, pas sur
 * `Record<string, unknown>`.
 *
 * Ce n'est pas un raffinement : un champ mal nommé dans un `Record` ne se voit
 * qu'à l'écriture, c'est-à-dire dans le job CI qui a besoin d'un Postgres — donc
 * quinze minutes plus tard, et seulement si quelqu'un lit le journal. Une
 * erreur de ce type a été faite en écrivant ce fichier
 * (`trainingSessionId` au lieu de `sessionId` sur `DocumentGenere`) : avec le
 * typage ci-dessous, le compilateur la refuse au commit.
 */
export interface FixtureVolumetrique {
  offreSite: Prisma.OffreSiteCreateManyInput;
  formations: Prisma.FormationCreateManyInput[];
  formateurs: Prisma.TrainerCreateManyInput[];
  clients: Prisma.ClientCreateManyInput[];
  stagiaires: Prisma.TraineeCreateManyInput[];
  sessions: Prisma.TrainingSessionCreateManyInput[];
  inscriptions: Prisma.EnrollmentCreateManyInput[];
  documents: Prisma.DocumentGenereCreateManyInput[];
  alertes: Prisma.AlerteSystemeCreateManyInput[];
  dossiers: {
    dossier: Prisma.DossierFinancementCreateManyInput;
    payeurs: Prisma.DossierPayeurCreateManyInput[];
  }[];
}

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;
const STATUTS_SESSION = ["planifiee", "en_cours", "realisee", "annulee", "reportee"] as const;
const FINANCEMENTS = ["direct", "opco", "cpf", "france_travail", "mixte"] as const;
const STATUTS_OPCO = [
  "non_demande",
  "demande_en_cours",
  "accord_recu",
  "refuse",
  "paiement_recu",
] as const;
const OPCOS = ["Atlas", "OPCO EP", "AKTO", "OPCO 2i", "Uniformation", "Afdas"] as const;
const TYPES_DOCUMENT = [
  "convention",
  "convocation",
  "emargement",
  "attestation",
  "facture",
  "devis",
  "programme",
] as const;
const NIVEAUX_ALERTE = ["info", "important", "critique"] as const;

/** `id` déterministes : un UUID v4 valide dérivé du compteur, sans horloge. */
function identifiant(famille: number, index: number): string {
  const h = (famille * 1_000_003 + index * 7919).toString(16).padStart(12, "0").slice(-12);
  const b = (index * 2654435761).toString(16).padStart(8, "0").slice(-8);
  return `${b}-${h.slice(0, 4)}-4${h.slice(4, 7)}-8${h.slice(7, 10)}-${h}`;
}

function jourDecale(reference: Date, jours: number): Date {
  return new Date(reference.getTime() + jours * 86_400_000);
}

/**
 * Construit la fixture entière **sans toucher à la base**. C'est ce qui permet
 * au spec de vérifier les volumes et les invariants sans Postgres — et donc de
 * les vérifier à chaque commit, pas seulement le jour où quelqu'un lance le seed.
 */
export function construireFixture(opts: { graine: number; maintenant: Date }): FixtureVolumetrique {
  const r = alea(opts.graine);
  const now = opts.maintenant;

  const offreSiteId = identifiant(1, 0);
  const offreSite: Prisma.OffreSiteCreateManyInput = {
    id: offreSiteId,
    code: `${PREFIXE_FIXTURE}-OFFRE-1`,
    titreFr: "Offre volumétrique",
    slug: `${PREFIXE_FIXTURE.toLowerCase()}-offre-1`,
    formatPedagogique: "collectif_1jour",
    publicViseFr: "Jeu de données de charge — aucune valeur métier.",
    dureeHeuresMin: 7,
    dureeHeuresMax: 35,
    tarifType: "sur_devis",
    promessePrincipaleFr: "Fixture volumétrique.",
    anglePedagogiqueFr: "Fixture volumétrique.",
  };

  const formations: Prisma.FormationCreateManyInput[] = Array.from(
    { length: VOLUMES.formations },
    (_, i) => ({
      id: identifiant(2, i),
      numero: `${PREFIXE_FIXTURE}-FORM-${String(i + 1).padStart(4, "0")}`,
      titre: `Formation de charge n°${i + 1}`,
      slug: `${PREFIXE_FIXTURE.toLowerCase()}-formation-${i + 1}`,
      offreSiteId,
      dureeHeures: choisir(r, [7, 14, 21, 35]),
      modalite: choisir(r, MODALITES),
    }),
  );

  const formateurs: Prisma.TrainerCreateManyInput[] = Array.from(
    { length: VOLUMES.formateurs },
    (_, i) => ({
      id: identifiant(3, i),
      nom: `Formateur${String(i + 1).padStart(3, "0")}`,
      prenom: "Charge",
      email: `formateur${i + 1}@${DOMAINE_FIXTURE}`,
      statut: choisir(r, ["salarie", "sous_traitant", "dirigeant"] as const),
      actif: true,
    }),
  );

  const clients: Prisma.ClientCreateManyInput[] = Array.from(
    { length: VOLUMES.clients },
    (_, i) => ({
      id: identifiant(4, i),
      numero: `${PREFIXE_FIXTURE}-CLI-${String(i + 1).padStart(4, "0")}`,
      raisonSociale: `Société de charge ${i + 1}`,
      type: "entreprise",
      statut: choisir(r, ["prospect", "devis_envoye", "client_actif", "client_inactif"] as const),
      opcoIdentifie: choisir(r, OPCOS).toLowerCase().replace(/\s+/g, "_"),
    }),
  );

  const stagiaires: Prisma.TraineeCreateManyInput[] = Array.from(
    { length: VOLUMES.stagiaires },
    (_, i) => ({
      id: identifiant(5, i),
      nom: `Stagiaire${String(i + 1).padStart(4, "0")}`,
      prenom: "Charge",
      email: `stagiaire${i + 1}@${DOMAINE_FIXTURE}`,
      entreprise: `Société de charge ${entier(r, 1, VOLUMES.clients)}`,
    }),
  );

  // ── Les sessions, étalées sur 12 mois : 6 mois passés, 6 mois à venir ──────
  //
  // L'étalement n'est pas cosmétique. Une liste triée par date qui ne couvre
  // qu'un mois ne teste ni la pagination par période, ni les index sur
  // `date_debut`, ni la fenêtre glissante de 12 mois de la liste des sessions.
  const jourMin = -Math.floor((VOLUMES.moisCouverts * 30) / 2);
  const sessions: Prisma.TrainingSessionCreateManyInput[] = Array.from(
    { length: VOLUMES.sessions },
    (_, i) => {
      const debutJour = jourMin + Math.floor((i / VOLUMES.sessions) * VOLUMES.moisCouverts * 30);
      const dateDebut = jourDecale(now, debutJour);
      const dureeJours = entier(r, 1, 5);
      const inter = i % 3 === 0;
      const financement = inter ? choisir(r, ["opco", "mixte"] as const) : choisir(r, FINANCEMENTS);
      const statut: (typeof STATUTS_SESSION)[number] =
        debutJour < -7 ? choisir(r, ["realisee", "annulee"] as const) : choisir(r, STATUTS_SESSION);
      return {
        id: identifiant(6, i),
        numero: `${PREFIXE_FIXTURE}-SESS-${String(i + 1).padStart(5, "0")}`,
        titreSession: `Formation de charge n°${(i % VOLUMES.formations) + 1} — session ${i + 1}`,
        formationId: identifiant(2, i % VOLUMES.formations),
        clientId: identifiant(4, i % VOLUMES.clients),
        formateurPrincipalId: identifiant(3, i % VOLUMES.formateurs),
        dateDebut,
        dateFin: jourDecale(dateDebut, dureeJours),
        dureeReelleHeures: choisir(r, [7, 14, 21, 35]),
        modalite: choisir(r, MODALITES),
        statut,
        financementType: financement,
        opcoStatut: financement === "direct" ? "non_demande" : choisir(r, STATUTS_OPCO),
        opcoSubrogation: financement !== "direct" && r() < 0.5,
        montantHtCents: entier(r, 80_000, 900_000),
        nbParticipantsPrevus: entier(r, 3, 14),
        nbParticipantsReels: statut === "realisee" ? entier(r, 2, 12) : null,
        interEntreprises: inter,
      };
    },
  );

  // ── Les inscriptions : plusieurs par stagiaire, plusieurs par session ──────
  const inscriptions: Prisma.EnrollmentCreateManyInput[] = Array.from(
    { length: VOLUMES.inscriptions },
    (_, i) => ({
      id: identifiant(7, i),
      sessionId: identifiant(6, i % VOLUMES.sessions),
      traineeId: identifiant(5, (i * 7) % VOLUMES.stagiaires),
      statut: choisir(r, ["planifiee", "presente", "abandon", "exclu"] as const),
    }),
  );

  const documents: Prisma.DocumentGenereCreateManyInput[] = Array.from(
    { length: VOLUMES.documents },
    (_, i) => ({
      id: identifiant(8, i),
      type: choisir(r, TYPES_DOCUMENT),
      numero: `${PREFIXE_FIXTURE}-DOC-${String(i + 1).padStart(5, "0")}`,
      hashSha256: (i * 2654435761).toString(16).padStart(64, "0").slice(-64),
      sizeBytes: entier(r, 20_000, 900_000),
      suppressionPrevueAt: jourDecale(now, entier(r, 400, 1200)),
      sessionId: identifiant(6, i % VOLUMES.sessions),
    }),
  );

  // ── 400 alertes OUVERTES — non résolues, c'est le seul état qui coûte ──────
  const alertes: Prisma.AlerteSystemeCreateManyInput[] = Array.from(
    { length: VOLUMES.alertesOuvertes },
    (_, i) => ({
      id: identifiant(9, i),
      code: `${PREFIXE_FIXTURE}_ALERTE_${i % 20}`,
      niveau: choisir(r, NIVEAUX_ALERTE),
      titre: `Alerte de charge n°${i + 1}`,
      message: "Jeu de données de charge — aucune action réelle attendue.",
      lu: false,
      resolue: false,
    }),
  );

  // ── 🔴 Le point qui rend V5 visible : PLUSIEURS financeurs par session ─────
  const sessionsInter = sessions.filter((s) => s.interEntreprises === true);
  const dossiers = sessionsInter.map((s, i) => {
    // 🔴 On refuse plutôt que de retomber sur `null`. Un dossier sans session ni
    // client passerait l'écriture sans erreur et fausserait ensuite TOUTES les
    // mesures du pipeline, qui joint sur ces deux clés — un jeu de données
    // silencieusement amputé est pire qu'un seed qui plante.
    const { id: sessionId, clientId } = s;
    if (sessionId == null || clientId == null) {
      throw new Error(
        `Session de fixture n°${i} sans identifiant ou sans client : construction incohérente.`,
      );
    }
    const montantTotal = s.montantHtCents;
    const nbPayeurs = entier(r, 2, 4);
    const subrogation = r() < 0.6;
    const dossierId = identifiant(10, i);

    // Répartition qui SOMME au total : le dernier payeur absorbe le reliquat.
    // Une répartition qui ne somme pas au total fabriquerait un reste à charge
    // faux, et la fixture prouverait un bug qu'elle a elle-même créé.
    const parts: number[] = [];
    let reste = montantTotal;
    for (let p = 0; p < nbPayeurs - 1; p++) {
      const part = Math.floor(reste / (nbPayeurs - p));
      parts.push(part);
      reste -= part;
    }
    parts.push(reste);

    const payeurs = parts.map((montant, p): Prisma.DossierPayeurCreateManyInput => ({
      id: identifiant(11, i * 4 + p),
      dossierId,
      payeurType: p === 0 && subrogation ? "opco_subroge" : "entreprise",
      payeurNom: p === 0 && subrogation ? choisir(r, OPCOS) : `Société de charge ${(i % 300) + 1}`,
      montantAttenduCents: montant,
    }));

    return {
      dossier: {
        id: dossierId,
        type: s.financementType === "mixte" ? ("mixte" as const) : ("opco" as const),
        statut: choisir(r, [
          "a_monter",
          "envoye",
          "accord_recu",
          "refuse",
          "facture",
          "paiement_recu",
        ] as const),
        subrogation,
        financeurNom: choisir(r, OPCOS),
        numeroDossierExterne: `${PREFIXE_FIXTURE}-DOS-${String(i + 1).padStart(5, "0")}`,
        montantDemandeCents: montantTotal,
        clientId,
        trainingSessionId: sessionId,
      },
      payeurs,
    };
  });

  return {
    offreSite,
    formations,
    formateurs,
    clients,
    stagiaires,
    sessions,
    inscriptions,
    documents,
    alertes,
    dossiers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'écrivain — et son second verrou
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Second verrou : la base contient-elle des données métier qui ne viennent PAS
 * de la fixture ?
 *
 * 🔴 C'est ce test qui attrape le cas que la liste blanche d'hôtes ne peut pas
 * voir : un tunnel SSH qui expose la production sur `localhost:5432`. L'hôte
 * paraît local ; le contenu, lui, ne ment pas.
 */
export async function baseVierge(prisma: PrismaClient): Promise<{
  ok: boolean;
  sessionsEtrangeres: number;
  clientsEtrangers: number;
}> {
  const [sessionsEtrangeres, clientsEtrangers] = await Promise.all([
    prisma.trainingSession.count({ where: { numero: { not: { startsWith: PREFIXE_FIXTURE } } } }),
    prisma.client.count({ where: { numero: { not: { startsWith: PREFIXE_FIXTURE } } } }),
  ]);
  return {
    ok: sessionsEtrangeres === 0 && clientsEtrangers === 0,
    sessionsEtrangeres,
    clientsEtrangers,
  };
}

/** Retire tout ce que la fixture a écrit — et rien d'autre. */
export async function purgerFixture(prisma: PrismaClient): Promise<void> {
  const prefixe = { startsWith: PREFIXE_FIXTURE };
  // Ordre : les enfants d'abord. Les cascades couvrent le reste.
  await prisma.dossierFinancement.deleteMany({ where: { numeroDossierExterne: prefixe } });
  await prisma.documentGenere.deleteMany({ where: { numero: prefixe } });
  await prisma.alerteSysteme.deleteMany({ where: { code: prefixe } });
  await prisma.trainingSession.deleteMany({ where: { numero: prefixe } });
  await prisma.trainee.deleteMany({ where: { email: { endsWith: DOMAINE_FIXTURE } } });
  await prisma.trainer.deleteMany({ where: { email: { endsWith: DOMAINE_FIXTURE } } });
  await prisma.formation.deleteMany({ where: { numero: prefixe } });
  await prisma.client.deleteMany({ where: { numero: prefixe } });
  await prisma.offreSite.deleteMany({ where: { code: prefixe } });
}

/** Écrit la fixture. Suppose les deux verrous déjà franchis par l'appelant. */
export async function ecrireFixture(
  prisma: PrismaClient,
  f: FixtureVolumetrique,
): Promise<Record<string, number>> {
  const lot = 500;
  /**
   * Découpe en lots et délègue l'écriture à une fermeture.
   *
   * 🔴 On passe une FERMETURE, pas le delegate Prisma. Un paramètre typé
   * « quelque chose qui a un createMany » oblige à élargir `data` à `unknown[]`,
   * et un `unknown[]` accepte n'importe quelle ligne — c'est-à-dire qu'il rend
   * au typage exactement ce que le typage devait empêcher. Ici, chaque appel
   * ci-dessous est vérifié par Prisma lui-même, champ par champ.
   */
  async function creer<T>(ecrire: (data: T[]) => Promise<unknown>, lignes: T[]): Promise<number> {
    for (let i = 0; i < lignes.length; i += lot) {
      await ecrire(lignes.slice(i, i + lot));
    }
    return lignes.length;
  }

  const compte: Record<string, number> = {};
  await prisma.offreSite.createMany({ data: [f.offreSite], skipDuplicates: true });
  compte["offreSite"] = 1;
  compte["formations"] = await creer(
    (d) => prisma.formation.createMany({ data: d, skipDuplicates: true }),
    f.formations,
  );
  compte["formateurs"] = await creer(
    (d) => prisma.trainer.createMany({ data: d, skipDuplicates: true }),
    f.formateurs,
  );
  compte["clients"] = await creer(
    (d) => prisma.client.createMany({ data: d, skipDuplicates: true }),
    f.clients,
  );
  compte["stagiaires"] = await creer(
    (d) => prisma.trainee.createMany({ data: d, skipDuplicates: true }),
    f.stagiaires,
  );
  compte["sessions"] = await creer(
    (d) => prisma.trainingSession.createMany({ data: d, skipDuplicates: true }),
    f.sessions,
  );
  compte["inscriptions"] = await creer(
    (d) => prisma.enrollment.createMany({ data: d, skipDuplicates: true }),
    f.inscriptions,
  );
  compte["documents"] = await creer(
    (d) => prisma.documentGenere.createMany({ data: d, skipDuplicates: true }),
    f.documents,
  );
  compte["alertes"] = await creer(
    (d) => prisma.alerteSysteme.createMany({ data: d, skipDuplicates: true }),
    f.alertes,
  );
  // Les dossiers AVANT leurs créances : `DossierPayeur.dossierId` est une clé
  // étrangère, l'ordre inverse échouerait ligne à ligne.
  compte["dossiers"] = await creer(
    (d) => prisma.dossierFinancement.createMany({ data: d, skipDuplicates: true }),
    f.dossiers.map((d) => d.dossier),
  );
  compte["payeurs"] = await creer(
    (d) => prisma.dossierPayeur.createMany({ data: d, skipDuplicates: true }),
    f.dossiers.flatMap((d) => d.payeurs),
  );
  return compte;
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
    console.error(`\n⛔ Fixture volumétrique REFUSÉE — ${verdict.raison}\n   ${verdict.message}\n`);
    process.exit(1);
  }

  const { PrismaClient } = await import("../../generated/client");
  const prisma = new PrismaClient() as unknown as PrismaClient;

  const vierge = await baseVierge(prisma);
  if (!vierge.ok) {
    console.error(
      `\n⛔ Fixture volumétrique REFUSÉE — la base ${verdict.base} contient déjà des données` +
        ` métier hors fixture (${vierge.sessionsEtrangeres} sessions, ${vierge.clientsEtrangers}` +
        ` clients).\n   L'hôte « ${verdict.hote} » paraît local, mais le contenu dit autre chose` +
        ` — un tunnel vers la production ?\n   Aucune écriture n'a eu lieu.\n`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const graine = Number(process.env["VOLUMETRIE_GRAINE"] ?? 20260816);
  const maintenant = new Date(process.env["VOLUMETRIE_DATE"] ?? "2026-08-16T00:00:00.000Z");

  console.log(`→ Construction (graine ${graine}, référence ${maintenant.toISOString()})…`);
  const f = construireFixture({ graine, maintenant });

  console.log(`→ Purge de toute fixture antérieure…`);
  await purgerFixture(prisma);

  console.log(`→ Écriture sur ${verdict.hote}/${verdict.base}…`);
  const compte = await ecrireFixture(prisma, f);

  console.log(`\n✓ Fixture volumétrique écrite :`);
  for (const [k, v] of Object.entries(compte)) console.log(`   ${k.padEnd(14)} ${v}`);
  await prisma.$disconnect();
}

// `require.main` n'existe pas en ESM ; on compare l'URL du module au fichier lancé.
if (process.argv[1] != null && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
