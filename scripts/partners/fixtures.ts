/**
 * scripts/partners/fixtures.ts — les fixtures de contrat, GÉNÉRÉES depuis le producteur
 * réel (INT-T01b, RM-03, REQ-QA-007, REQ-GOV-020).
 *
 *     pnpm partners:fixtures              # écrit le fichier
 *     pnpm partners:fixtures --verifier   # rougit si le disque diffère (garde CI)
 *     pnpm partners:fixtures --sortie <chemin>
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE SCRIPT PASSE PAR UNE BASE, ALORS QU'UN JSON TAPÉ AURAIT « MARCHÉ »
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * REQ-QA-007 : « les fixtures de contrat sont générées par le producteur réel d'axionia
 * (FactureFormation, Payment, Devis, Client) et non écrites à la main ». Ce n'est pas une
 * exigence de style. Une fixture tapée décrit ce que son auteur CROIT que le producteur
 * émet ; elle reste lisible, cohérente et fausse indéfiniment. Ce chantier en a la preuve
 * datée : quatre documents ont bâti le contrat sur `Invoice` et `Refund`, deux modèles
 * supprimés le 2026-08-26, et rien n'a rougi pendant un mois — parce que rien, dans un
 * document, ne touche au schéma.
 *
 * Ici, chaque ligne du scénario traverse `prisma.<modèle>.create()` sur la vraie base :
 * une colonne disparue, un enum renommé, une contrainte NOT NULL ajoutée, une clé
 * étrangère cassée FONT ÉCHOUER CE SCRIPT. C'est ça, « depuis le producteur réel » — pas
 * la provenance des valeurs, mais le fait que le SCHÉMA ait son mot à dire.
 *
 * 🔑 ET LA TRANSACTION EST TOUJOURS ANNULÉE. Le scénario est écrit puis relu dans une
 * `$transaction` qui se termine par un rollback délibéré : la base de développement
 * ressort intacte, et deux exécutions successives rendent le même fichier. Un script de
 * génération qui laisse des lignes derrière lui finit par générer depuis ses propres
 * déchets.
 *
 * ⚠️ AUCUNE FONCTION DE CE FICHIER NE COMPLÈTE UN CHAMP MANQUANT. Les payloads sont
 * construits par `src/server/partners/payloads.ts`, qui lève sur toute donnée absente. Si
 * une fixture ne peut pas être produite, ce script s'arrête bruyamment — il n'écrit pas
 * un fichier partiel, et il n'invente pas la valeur qui manque.
 *
 * ⛔ CE SCRIPT NE TOURNE QUE CONTRE UNE BASE LOCALE. Cf. `verifieLaCible()` : une URL qui
 * ne pointe pas vers `localhost` / `127.0.0.1` est refusée avant toute connexion. Écrire
 * un scénario dans une base distante, même en rollback, n'est pas un risque qu'on prend
 * pour fabriquer un fichier de test.
 */
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "../../prisma/generated/client";
import {
  SCHEMA_VERSION,
  TYPES_EVENEMENT,
  HORS_CONTRAT_V1,
  type TypeEvenement,
  type TypeHorsContrat,
} from "../../src/server/partners/contrat";
import { empreinteContratPublie } from "../../src/server/partners/contrat/empreinte";
import { enveloppe, type Fait } from "../../src/server/partners/enveloppe";
import {
  champsInterditsDuSujet,
  champsInterditsSelonFrontiere,
} from "../../src/server/partners/frontiere";
import {
  payloadAvoirEmis,
  payloadCandidatureRecue,
  payloadClientCree,
  payloadClientFusionne,
  payloadClientMisAJour,
  payloadDevisSigne,
  payloadFactureAnnulee,
  payloadFactureEmise,
  payloadFinancementMisAJour,
  payloadPaiementRecu,
  payloadPaiementRembourse,
} from "../../src/server/partners/payloads";

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fous
// ─────────────────────────────────────────────────────────────────────────────

const SORTIE_PAR_DEFAUT = path.join("src", "server", "partners", "contrat", "fixtures.v1.json");

/**
 * ⛔ La cible. Refuse tout ce qui n'est pas une base locale.
 *
 * Deux refus distincts, parce que les deux pannes n'ont rien à voir :
 *   - `stub.invalid` : on tourne sous le contrat de build GH Actions (AGENTS.md). Le
 *     client Prisma est alors un Proxy qui rend `[]` / `null` sur toute lecture et LÈVE
 *     sur toute mutation. Sans ce refus, le message d'erreur parlerait d'une mutation
 *     interdite et personne ne comprendrait qu'il n'y a simplement pas de base.
 *   - hôte distant : ce script ÉCRIT (avant d'annuler). Une variable d'environnement mal
 *     chargée ne doit pas suffire à ouvrir une transaction sur la production.
 */
function verifieLaCible(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error(
      "[partners:fixtures] DATABASE_URL est absent. Attendu la base de DÉVELOPPEMENT :\n" +
        "  DATABASE_URL='postgresql://axion_ia:axion_ia_dev@localhost:5434/axion_ia_dev?schema=public'\n" +
        "  (conteneur `axion-ia-postgres`, cf. .env.dev.example et `pnpm db:up`)",
    );
  }
  if (url.includes("stub.invalid")) {
    throw new Error(
      "[partners:fixtures] DATABASE_URL pointe vers le stub de build (`stub.invalid`). Ce script " +
        "a besoin d'une VRAIE base : le client Prisma est ici un Proxy qui court-circuite toutes " +
        "les requêtes. Les fixtures se génèrent en local, jamais dans le build GH Actions.",
    );
  }
  const hote = /@([^:/?]+)/.exec(url)?.[1] ?? "";
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(
      `[partners:fixtures] DATABASE_URL vise « ${hote} », qui n'est pas une base locale. Ce script ` +
        "ouvre une transaction d'écriture (annulée ensuite) : il ne s'exécute que contre localhost.",
    );
  }
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pseudonymisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La pseudonymisation est DÉTERMINISTE et sans secret d'environnement : ces fixtures sont
 * commitées, elles doivent être identiques d'une machine à l'autre, sinon la garde
 * `--verifier` rougit chez tout le monde sauf son auteur. Une clé constante suffit ici :
 * elle ne protège rien qu'un secret protégerait — les valeurs d'entrée sont un scénario.
 *
 * ⚠️ Le jour où ce script lira des lignes de PRODUCTION, cette clé devra devenir un
 * secret d'environnement ET la sortie cesser d'être commitée : une pseudonymisation à clé
 * publique et déterministe est réidentifiable par force brute sur un espace de valeurs
 * étroit (un SIREN, c'est neuf chiffres). C'est écrit ici pour que le glissement ne se
 * fasse pas sans que quelqu'un l'ait lu.
 */
const CLE_PSEUDONYME = "axionia/partners/fixtures/v1";

/**
 * Les clés en `…Id` qui NE SONT PAS des identifiants de personne, et que pseudonymiser
 * détruirait.
 *
 * 🔴 DÉFAUT RÉEL, TROUVÉ EN RELISANT LA FIXTURE PRODUITE (2026-09-05). La règle de
 * pseudonymisation attrape toute clé finissant par `Id`. Elle avait donc remplacé
 * `commissionId: "com-formation-2j"` par un UUID — et avec lui, TOUT ce que la fixture
 * servait à prouver : REQ-INT-006 exige que `commissionId` appartienne aux identifiants
 * de `COMMERCIAL_COMMISSIONS`, et Partners ne peut plus le vérifier sur une valeur
 * anonymisée. La fixture restait parfaitement valide au regard du JSON Schema, et
 * parfaitement inutile.
 *
 * 🔑 La leçon est générale : une règle de pseudonymisation qui vise une FORME de nom
 * (« ça finit par Id ») ne sait pas distinguer un identifiant de PERSONNE d'un
 * identifiant de RÉFÉRENTIEL. Le second est justement ce qu'on veut lire.
 */
const CLES_NON_PSEUDONYMISEES: readonly string[] = [
  // Un identifiant de LIGNE DE GRILLE (`com-formation-2j`), pas de personne. REQ-INT-006.
  "commissionId",
];

function pseudo(portee: string, valeur: string, longueur = 12): string {
  return createHmac("sha256", CLE_PSEUDONYME)
    .update(`${portee}:${valeur}`)
    .digest("hex")
    .slice(0, longueur);
}

/** Un UUID pseudonyme de FORME v4 — le contrat contrôle le chiffre de version. */
function uuidPseudo(portee: string, valeur: string): string {
  const h = createHmac("sha256", CLE_PSEUDONYME).update(`${portee}:${valeur}`).digest("hex");
  const u = h.slice(0, 32).split("");
  u[12] = "4";
  u[16] = "89ab"[parseInt(h[32] ?? "0", 16) % 4] ?? "8";
  const s = u.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/**
 * Remplace, dans un payload déjà construit, les valeurs identifiantes par leur pseudonyme.
 *
 * 🔑 CETTE FONCTION NE COMPLÈTE RIEN ET N'INVENTE RIEN : elle ne touche qu'aux clés
 * qu'elle trouve, et une clé absente reste absente. Elle ne « normalise » pas non plus un
 * champ nul en chaîne vide — un `null` dans une fixture est une information sur le
 * producteur, pas un trou à boucher.
 */
function pseudonymiser(valeur: unknown, cle = ""): unknown {
  if (Array.isArray(valeur)) return valeur.map((v) => pseudonymiser(v, cle));
  if (valeur !== null && typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>))
      sortie[k] = pseudonymiser(v, k);
    return sortie;
  }
  if (typeof valeur !== "string" || valeur.length === 0) return valeur;

  if (CLES_NON_PSEUDONYMISEES.includes(cle)) return valeur;
  if (/(^|[a-z])Id$|^id$/.test(cle) || cle.endsWith("FactureId")) return uuidPseudo(cle, valeur);
  if (cle === "siren") return pseudo("siren", valeur, 9).replace(/[a-f]/g, "7");
  if (cle === "numero") return `AXI-${pseudo("numero", valeur, 8).toUpperCase()}`;
  if (cle === "raisonSociale") return `Société ${pseudo("rs", valeur, 6).toUpperCase()}`;
  return valeur;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le scénario — écrit, relu, puis ANNULÉ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un fait de CE script porte aussi les quatre types HORS contrat v1.
 *
 * `Fait.type` est volontairement resserré sur `TypeEvenement` dans `enveloppe.ts` : c'est
 * ce qui empêche d'emballer par distraction un type que le récepteur refuserait en 422.
 * Ce script, lui, doit PRODUIRE les quatre autres sans les emballer — il élargit donc le
 * type ici, en un seul endroit nommé, plutôt qu'en semant des `as never` sur chaque fait.
 * Le resserrement se fait à l'appel d'`enveloppe()`, qui vérifie de son côté.
 */
type FaitTous = Omit<Fait, "type"> & { readonly type: TypeEvenement | TypeHorsContrat };

/** Erreur sentinelle : elle force le rollback et n'est pas une panne. */
class RollbackVoulu extends Error {
  constructor(readonly faits: FaitTous[]) {
    super("rollback voulu");
  }
}

const T = (iso: string): Date => new Date(iso);

/**
 * Les identifiants du scénario sont FIXÉS, et ce n'est pas un détail de confort.
 *
 * Les clés primaires de ce schéma sont `@default(uuid())` : laissées à la base, elles
 * changent à chaque exécution, la pseudonymisation — déterministe mais fonction de son
 * entrée — rend alors un pseudonyme différent, et le fichier diffère de lui-même. La
 * garde `--verifier` rougirait à chaque lancement sans qu'aucun code ait bougé, donc on
 * la débrancherait, donc elle ne garderait rien.
 *
 * 🔑 Constaté ici en le VOYANT : deux générations consécutives, `diff`, 14 identifiants
 * différents. Une garde de dérivation ne vaut que si son entrée est stable — c'est la
 * même règle que `emitted_at` et `updatedAt` deux paragraphes plus haut, et je l'ai
 * manquée deux fois avant de la voir. Fixer les identifiants du scénario est la seule
 * façon d'obtenir une entrée stable sans figer la SORTIE, qui, elle, doit continuer de
 * bouger quand le producteur bouge.
 */
const ID = {
  client: "0a1b2c3d-0001-4000-8000-000000000001",
  devis: "0a1b2c3d-0002-4000-8000-000000000002",
  dossier: "0a1b2c3d-0003-4000-8000-000000000003",
  facture: "0a1b2c3d-0004-4000-8000-000000000004",
  avoir: "0a1b2c3d-0005-4000-8000-000000000005",
  candidature: "0a1b2c3d-0006-4000-8000-000000000006",
  remboursement: "0a1b2c3d-0007-4000-8000-000000000007",
  rejet: "0a1b2c3d-0008-4000-8000-000000000008",
  encaissement: (i: number): string => `0a1b2c3d-0009-4000-8000-00000000001${i}`,
} as const;

type Prisma = PrismaClient;

/**
 * Le scénario métier — choisi pour EXERCER les cas que les exigences décrivent, pas pour
 * être joli :
 *
 *   • une facture SUBROGÉE à un OPCO (REQ-ARG-005 : le bénéficiaire n'est pas le
 *     destinataire — c'est le piège que la résolution doit éviter) ;
 *   • deux payeurs sur le dossier, OPCO + entreprise (K-18 `payers[]`, REQ-DM-039) ;
 *   • TROIS encaissements dont le dernier SOLDE, sur une facture 100 000 HT / 120 000 TTC
 *     qui ne se divise pas en trois (REQ-INT-005 : Σ HT dérivés = factureMontantHtCents,
 *     et c'est le troisième qui absorbe le reliquat) ;
 *   • un devis de formation à DEUX journées (REQ-DM-015 A-2 : le forfait est dû UNE fois,
 *     `jours` n'est pas un multiplicateur) ;
 *   • un avoir, un remboursement de chaque FORME (REQ-INT-032).
 */
async function construireLesFaits(tx: Prisma): Promise<FaitTous[]> {
  const client = await tx.client.create({
    data: {
      id: ID.client,
      numero: "AXI-CLI-FIXT-001",
      type: "entreprise",
      raisonSociale: "Fournitures Girard SAS",
      siren: "111222333",
      nafCode: "6201Z",
      secteur: "Informatique",
      taille: "PME",
      createdAt: T("2026-01-02T10:00:00.000Z"),
      updatedAt: T("2026-01-02T10:00:00.000Z"),
    },
  });

  const devis = await tx.devis.create({
    data: {
      id: ID.devis,
      numero: "AXI-DEV-FIXT-001",
      activite: "formation",
      clientId: client.id,
      lignes: [
        {
          designation: "Formation IA 2 jours",
          quantite: 2,
          prixUnitaireHtCents: 250_000,
          offreCode: "AXI-OFF-004",
        },
      ],
      montantTotalHtCents: 500_000,
      mentionTva: "TVA 20 % — régime assujetti",
      dateValidite: T("2026-03-16T00:00:00.000Z"),
      statut: "accepte",
      acceptedAt: T("2026-02-14T15:00:00.000Z"),
      createdAt: T("2026-02-01T15:00:00.000Z"),
      updatedAt: T("2026-02-14T15:00:00.000Z"),
    },
  });

  const dossier = await tx.dossierFinancement.create({
    data: {
      id: ID.dossier,
      type: "opco",
      clientId: client.id,
      subrogation: true,
      echeanceFinanceurAt: T("2026-05-15T00:00:00.000Z"),
      updatedAt: T("2026-02-20T09:00:00.000Z"),
    },
  });

  const facture = await tx.factureFormation.create({
    data: {
      id: ID.facture,
      numero: "AXI-FACT-FIXT-001",
      activite: "formation",
      clientId: client.id,
      devisId: devis.id,
      dossierFinancementId: dossier.id,
      // 🔴 Le destinataire est l'OPCO, le bénéficiaire est l'entreprise formée. C'est
      // TOUT le cas de REQ-ARG-005, et il ne se voit que sur une facture subrogée.
      destinataire: "opco",
      destinataireNom: "OPCO Atlas",
      destinataireSiret: "99988877700011",
      montantHtCents: 100_000,
      montantTvaCents: 20_000,
      montantTtcCents: 120_000,
      regimeTva: "assujetti",
      subrogation: true,
      statut: "emise",
      emiseAt: T("2026-03-01T09:00:00.000Z"),
      echeanceAt: T("2026-03-31T09:00:00.000Z"),
      updatedAt: T("2026-03-01T09:00:00.000Z"),
    },
  });

  await tx.dossierPayeur.createMany({
    data: [
      {
        dossierId: dossier.id,
        payeurType: "opco_subroge",
        payeurNom: "OPCO Atlas",
        montantAttenduCents: 90_000,
        factureFormationId: facture.id,
      },
      {
        dossierId: dossier.id,
        payeurType: "entreprise",
        payeurNom: "Fournitures Girard SAS",
        montantAttenduCents: 30_000,
        factureFormationId: facture.id,
      },
    ],
  });

  // Trois encaissements d'un TIERS chacun : 40 000 + 40 000 + 40 000 = 120 000. Le
  // prorata plancher rend 33 333 deux fois ; le troisième doit rendre 33 334 pour que la
  // somme fasse 100 000. Sans le reliquat, un centime de commission disparaîtrait sur
  // CHAQUE facture payée en plusieurs fois — indéfiniment, et sans alerte.
  const encaissements = [
    { paidAt: "2026-03-10T12:00:00.000Z", type: "deposit" as const },
    { paidAt: "2026-04-10T12:00:00.000Z", type: "installment_2" as const },
    { paidAt: "2026-05-10T12:00:00.000Z", type: "balance" as const },
  ];
  for (const [i, e] of encaissements.entries()) {
    await tx.payment.create({
      data: {
        id: ID.encaissement(i),
        factureFormationId: facture.id,
        provider: "stripe",
        providerEventId: `evt_fixt_${i}`,
        amountCents: 40_000,
        currency: "EUR",
        type: e.type,
        status: "succeeded",
        paidAt: T(e.paidAt),
      },
    });
  }

  const avoir = await tx.factureFormation.create({
    data: {
      id: ID.avoir,
      numero: "AXI-AV-FIXT-001",
      activite: "formation",
      clientId: client.id,
      destinataire: "opco",
      destinataireNom: "OPCO Atlas",
      montantHtCents: -40_000,
      montantTvaCents: -8_000,
      montantTtcCents: -48_000,
      regimeTva: "assujetti",
      avoirDeId: facture.id,
      statut: "emise",
      emiseAt: T("2026-06-01T09:00:00.000Z"),
      updatedAt: T("2026-06-01T09:00:00.000Z"),
    },
  });

  const remboursementNeuf = await tx.payment.create({
    data: {
      id: ID.remboursement,
      factureFormationId: facture.id,
      provider: "stripe",
      providerEventId: "evt_fixt_refund",
      amountCents: 12_000,
      currency: "EUR",
      type: "refund",
      status: "succeeded",
      paidAt: T("2026-06-02T09:00:00.000Z"),
    },
  });

  const encaissementRejete = await tx.payment.create({
    data: {
      id: ID.rejet,
      factureFormationId: facture.id,
      provider: "manual_wire",
      providerEventId: "evt_fixt_rejet",
      amountCents: 12_000,
      currency: "EUR",
      type: "installment_3",
      status: "refunded",
      paidAt: T("2026-06-03T09:00:00.000Z"),
    },
  });

  const candidature = await tx.submission.create({
    data: {
      id: ID.candidature,
      type: "contact",
      companyName: "—",
      // Les colonnes PII reçoivent ici des valeurs de scénario. Elles ne traversent PAS :
      // `payloadCandidatureRecue` ne lit que `details`, et la frontière le vérifie.
      contactName: "enc:v1:fixture",
      contactEmail: "fixture@exemple.invalid",
      contactPhone: "enc:v1:fixture",
      details: {
        unifiedType: "recrutement",
        subType: "candidature-commerciale",
        score: 72,
        scorePriorite: "haute",
        scoreParts: {
          carnet: 25,
          b2bAnnees: 25,
          statut: 12,
          typesClients: 10,
          deplacement: 0,
          ia: 0,
          informatique: 0,
          zone: 0,
        },
        source: "/devenir-commercial-ia/candidature",
        funnel: { utm: { utm_source: "linkedin", utm_campaign: "apporteurs-q1" } },
        candidature: {
          version: 1,
          ville: "Grenoble",
          codePostal: "38000",
          b2b: { dejaVendu: true, annees: 8 },
          ia: { utilise: true, outils: ["chatgpt"] },
          informatique: { utilise: true, usages: ["crm"] },
          zone: { mobile: true, zones: ["auvergne-rhone-alpes"] },
          disponibilite: "immediate",
          permisVehicule: true,
          statut: "auto_entrepreneur",
          pitch: "Je vends du logiciel aux PME industrielles depuis huit ans.",
        },
      },
      submittedAt: T("2026-08-20T08:30:00.000Z"),
      updatedAt: T("2026-08-20T08:30:00.000Z"),
    },
  });

  // ── RELECTURE : tout ce qui suit part de la BASE, pas des objets créés ci-dessus.
  // Relire est le geste qui fait entrer les défauts (colonnes à valeur par défaut,
  // troncatures, coercitions de type) dans la fixture. Construire depuis l'objet passé à
  // `create()` reviendrait à fabriquer la fixture à la main avec des étapes en plus.
  const clientRelu = await tx.client.findUniqueOrThrow({ where: { id: client.id } });
  const devisRelu = await tx.devis.findUniqueOrThrow({ where: { id: devis.id } });
  const factureRelue = await tx.factureFormation.findUniqueOrThrow({
    where: { id: facture.id },
    include: { client: true },
  });
  const avoirRelu = await tx.factureFormation.findUniqueOrThrow({
    where: { id: avoir.id },
    include: { client: true },
  });
  const paiements = await tx.payment.findMany({
    where: { factureFormationId: facture.id, status: "succeeded", type: { not: "refund" } },
    orderBy: { paidAt: "asc" },
  });
  const payeurs = await tx.dossierPayeur.findMany({
    where: { factureFormationId: facture.id },
    orderBy: { montantAttenduCents: "desc" },
  });
  const dossierRelu = await tx.dossierFinancement.findUniqueOrThrow({ where: { id: dossier.id } });
  const candidatureRelue = await tx.submission.findUniqueOrThrow({ where: { id: candidature.id } });
  const rembourseRelu = await tx.payment.findUniqueOrThrow({ where: { id: remboursementNeuf.id } });
  const rejeteRelu = await tx.payment.findUniqueOrThrow({ where: { id: encaissementRejete.id } });

  const faits: FaitTous[] = [
    {
      type: "client.cree",
      cleDeFait: `client.cree:${clientRelu.id}`,
      occurredAt: clientRelu.createdAt,
      sujet: { client_id: clientRelu.id },
      payload: { ...payloadClientCree({ client: clientRelu }) },
      sequence: 1,
    },
    {
      type: "client.mis_a_jour",
      cleDeFait: `client.mis_a_jour:${clientRelu.id}:${clientRelu.updatedAt.toISOString()}`,
      occurredAt: clientRelu.updatedAt,
      sujet: { client_id: clientRelu.id },
      payload: { ...payloadClientMisAJour({ client: clientRelu }) },
      sequence: 2,
    },
    {
      type: "devis.signe",
      cleDeFait: `devis.signe:${devisRelu.id}`,
      occurredAt: devisRelu.acceptedAt ?? devisRelu.updatedAt,
      sujet: { devis_id: devisRelu.id },
      payload: { ...payloadDevisSigne({ devis: devisRelu, client: clientRelu }) },
      sequence: 3,
    },
    {
      type: "facture.emise",
      cleDeFait: `facture.emise:${factureRelue.id}`,
      occurredAt: factureRelue.emiseAt ?? factureRelue.createdAt,
      sujet: { facture_id: factureRelue.id },
      payload: {
        ...payloadFactureEmise({
          facture: factureRelue,
          payeurs,
          echeanceFinanceurAt: dossierRelu.echeanceFinanceurAt,
        }),
      },
      sequence: 4,
    },
    {
      type: "avoir.emis",
      cleDeFait: `avoir.emis:${avoirRelu.id}`,
      occurredAt: avoirRelu.emiseAt ?? avoirRelu.createdAt,
      sujet: { facture_id: avoirRelu.id },
      payload: { ...payloadAvoirEmis({ avoir: avoirRelu }) },
      sequence: 5,
    },
  ];

  // Les trois encaissements, avec le CUMUL qui grandit — c'est lui qui fait basculer le
  // dernier en « soldant » et lui fait absorber le reliquat.
  let cumul = 0;
  for (const [i, p] of paiements.entries()) {
    cumul += p.amountCents;
    faits.push({
      type: "paiement.recu",
      cleDeFait: `paiement.recu:${p.id}`,
      occurredAt: p.paidAt ?? p.createdAt,
      sujet: { payment_id: p.id },
      payload: {
        ...payloadPaiementRecu({
          paiement: p,
          facture: factureRelue,
          totalEncaisseTtcCents: cumul,
        }),
      },
      sequence: 6 + i,
    });
  }

  faits.push(
    {
      type: "paiement.rembourse",
      cleDeFait: `paiement.rembourse:${rembourseRelu.id}`,
      occurredAt: rembourseRelu.paidAt ?? rembourseRelu.createdAt,
      sujet: { payment_id: rembourseRelu.id },
      payload: {
        ...payloadPaiementRembourse({
          paiement: rembourseRelu,
          facture: factureRelue,
          totalEncaisseTtcCents: rembourseRelu.amountCents,
          motif: "remboursement",
        }),
      },
      sequence: 9,
    },
    {
      type: "paiement.rembourse",
      cleDeFait: `paiement.rembourse:${rejeteRelu.id}`,
      occurredAt: rejeteRelu.paidAt ?? rejeteRelu.createdAt,
      sujet: { payment_id: rejeteRelu.id },
      payload: {
        ...payloadPaiementRembourse({
          paiement: rejeteRelu,
          facture: factureRelue,
          totalEncaisseTtcCents: rejeteRelu.amountCents,
          // 🔴 Un prélèvement rejeté EST une annulation d'encaissement au sens de
          // REQ-INT-032 : « pas seulement un remboursement volontaire ».
          motif: "rejet_prelevement",
        }),
      },
      sequence: 10,
    },
    // ── Les quatre types HORS CONTRAT v1. Ils sont construits et vérifiés ici, mais
    // `enveloppe()` refuse de les emballer tant que Partners n'a pas republié : ils
    // sortent donc dans une section à part du fichier. Les produire sans les émettre
    // n'est pas une contradiction, c'est le seul ordre possible d'un lockstep.
    {
      type: "facture.annulee",
      cleDeFait: `facture.annulee:${factureRelue.id}`,
      occurredAt: factureRelue.updatedAt,
      sujet: { facture_id: factureRelue.id },
      payload: { ...payloadFactureAnnulee({ facture: factureRelue, motif: "doublon" }) },
      sequence: 11,
    },
    {
      type: "financement.mis_a_jour",
      cleDeFait: `financement.mis_a_jour:${factureRelue.id}:${dossierRelu.updatedAt.toISOString()}`,
      occurredAt: dossierRelu.updatedAt,
      sujet: { facture_id: factureRelue.id },
      payload: {
        ...payloadFinancementMisAJour({
          factureId: factureRelue.id,
          payeurs,
          echeanceFinanceurAt: dossierRelu.echeanceFinanceurAt,
        }),
      },
      sequence: 12,
    },
    {
      type: "candidature.recue",
      cleDeFait: `candidature.recue:${candidatureRelue.id}`,
      occurredAt: candidatureRelue.submittedAt,
      sujet: { submission_id: candidatureRelue.id },
      payload: { ...payloadCandidatureRecue({ submission: candidatureRelue }) },
      sequence: 13,
    },
    {
      type: "client.fusionne",
      cleDeFait: `client.fusionne:${clientRelu.id}`,
      occurredAt: clientRelu.updatedAt,
      sujet: { client_id: clientRelu.id },
      payload: {
        ...payloadClientFusionne({
          survivorId: clientRelu.id,
          absorbedId: uuidPseudo("absorbe", clientRelu.id),
        }),
      },
      sequence: 14,
    },
  );

  return faits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'entête `Source:` que RM-03 et REQ-GOV-020 exigent.
 *
 * ⚠️ IL NE PORTE AUCUNE DATE NI AUCUN HORODATAGE DE GÉNÉRATION, et c'est délibéré : une
 * date change à chaque exécution, donc `--verifier` rougirait à chaque fois, donc la
 * garde serait désactivée dans la semaine. Ce qui doit dater la fixture, c'est
 * l'EMPREINTE du contrat sur lequel elle a été produite — elle, elle ne bouge que quand
 * le contrat bouge, et c'est exactement ce qu'on veut voir bouger.
 */
function entete(): string {
  return [
    "GÉNÉRÉE — ne pas éditer à la main.",
    "Producteur : axionia, scripts/partners/fixtures.ts (INT-T01b).",
    "Méthode : scénario écrit puis RELU dans la base de développement (localhost:5434) via les",
    "modèles Prisma réels, payloads construits par src/server/partners/payloads.ts, transaction",
    "ANNULÉE, sortie pseudonymisée. Aucune valeur n'est complétée : un champ absent fait échouer",
    "la génération (RM-03, REQ-QA-007).",
    `Contrat : contracts.v1.json, empreinte ${empreinteContratPublie()}, schema_version ${SCHEMA_VERSION}.`,
    "Régénérer : pnpm partners:fixtures — vérifier : pnpm partners:fixtures --verifier",
  ].join(" ");
}

function rendu(faits: FaitTous[]): string {
  const dansLeContrat = faits.filter((f) =>
    (TYPES_EVENEMENT as readonly string[]).includes(f.type),
  );
  const horsContrat = faits.filter((f) => (HORS_CONTRAT_V1 as readonly string[]).includes(f.type));

  const inconnus = faits.filter((f) => !dansLeContrat.includes(f) && !horsContrat.includes(f));
  if (inconnus.length > 0) {
    throw new Error(
      `[partners:fixtures] type(s) ni au contrat v1 ni recensé(s) hors contrat : ` +
        `${inconnus.map((f) => f.type).join(", ")}.`,
    );
  }

  // Chaque type du contrat DOIT avoir au moins une fixture. Un jeu incomplet laisserait
  // un type sans aucun exemple valide, et personne ne le remarquerait — l'absence est
  // silencieuse par nature.
  const couverts = new Set(dansLeContrat.map((f) => f.type));
  const manquants = TYPES_EVENEMENT.filter((t) => !couverts.has(t));
  if (manquants.length > 0) {
    throw new Error(`[partners:fixtures] aucun exemple pour : ${manquants.join(", ")}.`);
  }
  const manquantsHors = HORS_CONTRAT_V1.filter(
    (t) => !horsContrat.some((f) => (f.type as string) === t),
  );
  if (manquantsHors.length > 0) {
    throw new Error(
      `[partners:fixtures] aucun exemple hors contrat pour : ${manquantsHors.join(", ")}.`,
    );
  }

  // ⚠️ `emitted_at` est retiré des fixtures : c'est le seul champ de l'enveloppe qui
  // dépende de l'HORLOGE et non du fait. Le garder rendrait le fichier différent à chaque
  // exécution, et `--verifier` deviendrait un bruit permanent qu'on finit par ignorer.
  const enveloppes = dansLeContrat.map((f) => {
    const e = enveloppe(f as Fait) as unknown as Record<string, unknown>;
    delete e["emitted_at"];
    return pseudonymiser(e) as Record<string, unknown>;
  });

  // LA DERNIÈRE VÉRIFICATION, et elle porte sur le fichier RENDU. Les payloads ont déjà
  // été contrôlés un par un à la construction ; ce balayage-ci attrape ce que la
  // pseudonymisation ou l'emballage auraient pu introduire APRÈS.
  for (const [i, e] of enveloppes.entries()) {
    const type = String(e["event_type"]);
    const fautes = [
      ...champsInterditsSelonFrontiere(type, e["payload"]),
      ...champsInterditsDuSujet(type, e["subject_ref"]),
    ];
    if (fautes.length > 0) {
      throw new Error(
        `[partners:fixtures] fixture ${i} (${type}) : ${fautes.map((c) => c.chemin).join(", ")} ` +
          "franchissent la frontière de REQ-INT-029.",
      );
    }
  }

  const horsEnveloppe = horsContrat.map((f) => ({
    event_type: f.type,
    occurred_at: f.occurredAt.toISOString(),
    subject_ref: pseudonymiser(f.sujet),
    payload: pseudonymiser(f.payload),
  }));

  const document = {
    Source: entete(),
    schemaVersion: SCHEMA_VERSION,
    evenements: enveloppes,
    // Séparé, et NOMMÉ : ces quatre types ne sont pas émissibles en v1. Les mélanger aux
    // autres ferait échouer la validation JSON Schema d'un consommateur qui prendrait le
    // tableau entier — et l'échec aurait l'air d'un défaut de contrat.
    horsContratV1: horsEnveloppe,
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrée
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verifier = args.includes("--verifier");
  const iSortie = args.indexOf("--sortie");
  const sortie = iSortie >= 0 ? args[iSortie + 1] : undefined;
  const chemin = path.resolve(sortie ?? SORTIE_PAR_DEFAUT);

  verifieLaCible();
  const prisma = new PrismaClient();

  let faits: FaitTous[];
  try {
    await prisma.$transaction(async (tx) => {
      throw new RollbackVoulu(await construireLesFaits(tx as unknown as Prisma));
    });
    throw new Error("[partners:fixtures] la transaction n'a pas été annulée — anomalie.");
  } catch (e) {
    if (!(e instanceof RollbackVoulu)) throw e;
    faits = e.faits;
  } finally {
    await prisma.$disconnect();
  }

  const contenu = rendu(faits);

  if (verifier) {
    let surLeDisque: string;
    try {
      surLeDisque = readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
    } catch {
      console.error(`❌ ${chemin} est absent. Lancer : pnpm partners:fixtures`);
      process.exitCode = 1;
      return;
    }
    if (surLeDisque !== contenu) {
      console.error(
        `❌ ${chemin} diffère de ce que le producteur rend aujourd'hui.\n` +
          "   Le contrat, le schéma Prisma ou un constructeur de payload a bougé sans que la\n" +
          "   fixture soit régénérée. Lancer : pnpm partners:fixtures",
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `✅ ${chemin} est à jour (${faits.length} faits, schema_version ${SCHEMA_VERSION}).`,
    );
    return;
  }

  mkdirSync(path.dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, "utf8");
  console.log(`✅ ${chemin} écrit — ${faits.length} faits, schema_version ${SCHEMA_VERSION}.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
