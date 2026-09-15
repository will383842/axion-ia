#!/usr/bin/env tsx
/**
 * RATTRAPAGE RGPD art. 9 — chiffrer EN PLACE la précision de santé des anciens
 * positionnements.
 *
 * ## Le défaut rattrapé
 *
 * Du 2026-07-26 au 2026-08-20, le portail écrivait le détail du besoin
 * d'adaptation EN CLAIR dans `questionnaires.reponses` (clé `detailAdaptation`).
 * Ce script le chiffre dans le même JSON, sous la clé réservée au serveur
 * `detailAdaptationChiffre` (format `enc:v1:` de `encryptPii`), en UNE
 * instruction SQL par ligne. Rien n'est supprimé : la rétention de 5 ans est une
 * décision permanente.
 *
 * ⚠️ La date du 20/08 ne sert PAS de filtre : le seul critère fiable est la
 * présence de la clé dans le JSON.
 *
 * ## Usage — dans le conteneur WORKER (l'image web n'a ni `src/` ni `tsx`)
 *
 *   node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts
 *       → essai à blanc (DÉFAUT) : aucune écriture, compteurs seulement
 *   … --appliquer                → chiffre, une transaction par ligne
 *   … --appliquer --limite=1     → premier passage sur une seule ligne
 *   … --verifier                 → déchiffre en mémoire, compte ok / ko, n'écrit rien
 *
 * Déroulé complet et requêtes de contrôle : `docs/runbooks/R34-rattrapage-chiffrement-details-adaptation.md`.
 *
 * ## Contrat
 *
 * - REFUS au démarrage : `DATABASE_URL` absente ou stub de build ; clé
 *   `PII_ENCRYPTION_KEY` absente ou mal formée ; sonde chiffrer/déchiffrer qui
 *   échoue ; clé incapable de déchiffrer une valeur `trainees.handicap_details_chiffre`
 *   écrite par le site (même clé que le web).
 *   🔴 Sans clé, `encryptPii` rend le CLAIR sans lever : sans ces refus, le
 *   script rangerait du clair sous une clé nommée « Chiffre ».
 * - Une transaction par ligne : `SELECT … FOR UPDATE`, décision pure, chiffrement
 *   vérifié par aller-retour, `UPDATE` conditionnel qui doit toucher EXACTEMENT
 *   une ligne, journal `activity_logs` dans la MÊME transaction. Toute erreur
 *   annule la ligne et ARRÊTE la passe (relancer est idempotent).
 * - 🔴 Aucune sortie ne contient le texte, sa longueur ou un extrait : ni la
 *   console, ni le journal, ni un message d'erreur. `err.message` n'est JAMAIS
 *   affiché (Prisma peut y recopier des paramètres) : seuls l'identifiant de la
 *   ligne et le NOM de l'étape sortent.
 * - Aucun mode inverse : le script n'a aucun moyen de remettre du clair en base.
 *
 * ## Imports
 *
 * `@/lib/prisma`, `@/lib/pii-crypto` et des modules purs, RIEN d'autre. Ni
 * `"use server"`, ni `next/headers`, ni `server-only` (même transitivement) : le
 * worker tourne `tsx` hors de Next. Gardé par
 * `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.
 */

import { prisma as prismaParDefaut } from "@/lib/prisma";
import { decryptPii, encryptPii, isEncryptedPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { deciderRattrapage } from "@/server/qualiopi/positionnement/detail-adaptation-chiffre";

// ─────────────────────────────────────────────────────────────────────────────
// Dépendances injectables (les tests passent une base simulée)
// ─────────────────────────────────────────────────────────────────────────────

type RequeteLecture = <T = unknown>(
  requete: TemplateStringsArray,
  ...valeurs: unknown[]
) => Promise<T>;
type RequeteEcriture = (requete: TemplateStringsArray, ...valeurs: unknown[]) => Promise<number>;

export interface EntreeJournal {
  adminUserId: null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, string | number | boolean>;
}

export interface TransactionRattrapage {
  $queryRaw: RequeteLecture;
  $executeRaw: RequeteEcriture;
  activityLog: { create: (args: { data: EntreeJournal }) => Promise<unknown> };
}

export interface ClientRattrapage extends TransactionRattrapage {
  $transaction: <R>(
    traitement: (tx: TransactionRattrapage) => Promise<R>,
    options?: { timeout?: number },
  ) => Promise<R>;
  $disconnect: () => Promise<void>;
}

export interface CryptoRattrapage {
  encryptPii: (clair: string) => string;
  decryptPii: (valeur: string) => string;
  isEncryptedPii: (valeur: unknown) => boolean;
}

export interface Dependances {
  prisma: ClientRattrapage;
  crypto: CryptoRattrapage;
}

function dependancesParDefaut(): Dependances {
  return {
    // Le client généré porte des surcharges (`$transaction` en tableau ou en
    // fonction) que ce type minimal ne recopie pas : le script n'utilise que la
    // forme fonction, `$queryRaw`, `$executeRaw` et `activityLog.create`.
    prisma: prismaParDefaut as unknown as ClientRattrapage,
    crypto: { encryptPii, decryptPii, isEncryptedPii },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const PREFIXE = "[chiffrer-details-adaptation]";
export const ACTION_LIGNE = "qualiopi.questionnaire.detail_adaptation.chiffre";
export const ACTION_PASSE = "qualiopi.questionnaire.detail_adaptation.rattrapage";
export const POLITIQUE = "rattrapage-art9-2026-09";
const TAILLE_LOT = 50;
const CURSEUR_INITIAL = "00000000-0000-0000-0000-000000000000";
/** Même motif que `getKey()` de `pii-crypto`. */
const MOTIF_CLE = /^[0-9a-fA-F]{64}$/;
const SONDE = "sonde-rattrapage-art9";

/**
 * Échec nommé par son ÉTAPE. Son message ne contient que le nom de l'étape :
 * c'est la seule chose qu'on affiche d'une erreur.
 */
class EchecEtape extends Error {
  constructor(readonly etape: string) {
    super(`échec à l'étape ${etape}`);
    this.name = "EchecEtape";
  }
}

/** Ce qu'on peut dire d'une erreur sans jamais lire son message. */
function nommer(err: unknown): string {
  if (err instanceof EchecEtape) return err.etape;
  if (err instanceof Error) return err.name;
  return typeof err;
}

function entier(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Arguments
// ─────────────────────────────────────────────────────────────────────────────

export type Mode = "essai" | "appliquer" | "verifier";

export interface Options {
  mode: Mode;
  limite: number | null;
}

export function lireArguments(argv: readonly string[]): Options | { erreur: string } {
  let appliquer = false;
  let verifier = false;
  let limite: number | null = null;

  for (const arg of argv) {
    if (arg === "--appliquer") appliquer = true;
    else if (arg === "--verifier") verifier = true;
    else if (arg.startsWith("--limite=")) {
      const brut = arg.slice("--limite=".length);
      if (!/^\d+$/.test(brut) || Number(brut) < 1) {
        return { erreur: "--limite attend un entier supérieur ou égal à 1" };
      }
      limite = Number(brut);
    } else {
      // Y compris `--dechiffrer` ou `--annuler` : ce script n'a aucun mode inverse.
      return { erreur: `argument inconnu (${arg.slice(0, 40)})` };
    }
  }

  if (appliquer && verifier) return { erreur: "--appliquer et --verifier sont exclusifs" };
  return { mode: appliquer ? "appliquer" : verifier ? "verifier" : "essai", limite };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refus au démarrage
// ─────────────────────────────────────────────────────────────────────────────

export async function verifierPrealables(
  deps: Dependances,
): Promise<{ refus: string } | { refus: null; temoin: "ok" | "absent" }> {
  const url = process.env["DATABASE_URL"];
  if (!url) return { refus: "DATABASE_URL absente" };
  if (url.includes("stub.invalid")) return { refus: "DATABASE_URL désigne le stub de build" };

  const cle = process.env["PII_ENCRYPTION_KEY"];
  if (!cle || !MOTIF_CLE.test(cle)) {
    return { refus: "PII_ENCRYPTION_KEY absente ou mal formée (64 hexadécimaux attendus)" };
  }

  // Sonde : `encryptPii` sans clé utilisable rend le CLAIR sans lever.
  let sonde: string;
  try {
    sonde = deps.crypto.encryptPii(SONDE);
  } catch {
    return { refus: "sonde : chiffrement impossible" };
  }
  if (!deps.crypto.isEncryptedPii(sonde)) return { refus: "sonde : la valeur n'est pas chiffrée" };
  try {
    if (deps.crypto.decryptPii(sonde) !== SONDE) return { refus: "sonde : aller-retour faux" };
  } catch {
    return { refus: "sonde : déchiffrement impossible" };
  }

  // Même clé que le site : déchiffrer UNE valeur écrite par le web. Le résultat
  // est jeté, jamais affiché. Un tag GCM invalide lève : clé différente.
  let temoins: Array<{ valeur: string }>;
  try {
    temoins = await deps.prisma.$queryRaw<Array<{ valeur: string }>>`
      /* rattrapage:temoin */
      SELECT handicap_details_chiffre AS valeur
        FROM trainees
       WHERE handicap_details_chiffre LIKE 'enc:v1:%'
       LIMIT 1`;
  } catch {
    return { refus: "lecture de la valeur témoin impossible" };
  }
  if (temoins.length === 0) return { refus: null, temoin: "absent" };
  try {
    const lu = deps.crypto.decryptPii(temoins[0]!.valeur);
    if (lu === PII_DECRYPT_PLACEHOLDER || deps.crypto.isEncryptedPii(lu)) {
      return { refus: "témoin : la clé ne déchiffre pas une valeur écrite par le site" };
    }
  } catch {
    return { refus: "témoin : la clé ne déchiffre pas une valeur écrite par le site" };
  }
  return { refus: null, temoin: "ok" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Une ligne, une transaction
// ─────────────────────────────────────────────────────────────────────────────

type StatutLigne =
  | "chiffre"
  | "deja_chiffre"
  | "rien"
  | "anomalie_vide"
  | "anomalie_non_texte"
  | "anomalie_deux_cles";

export async function chiffrerUneLigne(
  tx: TransactionRattrapage,
  id: string,
  crypto: CryptoRattrapage,
): Promise<StatutLigne> {
  let lignes: Array<{ reponses: unknown }>;
  try {
    lignes = await tx.$queryRaw<Array<{ reponses: unknown }>>`
      /* rattrapage:verrouiller */
      SELECT reponses
        FROM questionnaires
       WHERE id = ${id}::uuid
         AND type = 'positionnement'
         FOR UPDATE`;
  } catch {
    throw new EchecEtape("verrouillage");
  }
  if (lignes.length === 0) return "rien";

  const decision = deciderRattrapage(lignes[0]!.reponses);
  if (decision.statut === "anomalie") return `anomalie_${decision.motif}`;
  if (decision.statut !== "a_chiffrer") return decision.statut;

  let chiffre: string;
  try {
    chiffre = crypto.encryptPii(decision.clair);
  } catch {
    throw new EchecEtape("chiffrement");
  }
  if (!crypto.isEncryptedPii(chiffre)) throw new EchecEtape("chiffrement");

  let retour: string;
  try {
    retour = crypto.decryptPii(chiffre);
  } catch {
    throw new EchecEtape("aller_retour");
  }
  if (retour !== decision.clair) throw new EchecEtape("aller_retour");

  // Conditions `->'k' IS NOT NULL` plutôt que l'opérateur `?` : aucune
  // ambiguïté avec les paramètres d'une requête brute. N'écrase JAMAIS un
  // chiffré existant. Ne touche pas `updated_at` : aucun lecteur ne doit
  // prendre ce rattrapage pour une modification de la réponse.
  let touchees: number;
  try {
    touchees = await tx.$executeRaw`
      /* rattrapage:chiffrer */
      UPDATE questionnaires
         SET reponses = (reponses - 'detailAdaptation')
                        || jsonb_build_object('detailAdaptationChiffre', ${chiffre}::text)
       WHERE id = ${id}::uuid
         AND type = 'positionnement'
         AND reponses->'detailAdaptation' IS NOT NULL
         AND reponses->'detailAdaptationChiffre' IS NULL`;
  } catch {
    throw new EchecEtape("mise_a_jour");
  }
  if (touchees !== 1) throw new EchecEtape("mise_a_jour");

  try {
    await tx.activityLog.create({
      data: {
        adminUserId: null,
        action: ACTION_LIGNE,
        targetType: "Questionnaire",
        targetId: id,
        changes: { chiffre: true, politique: POLITIQUE },
      },
    });
  } catch {
    throw new EchecEtape("journal");
  }
  return "chiffre";
}

// ─────────────────────────────────────────────────────────────────────────────
// Les trois modes
// ─────────────────────────────────────────────────────────────────────────────

interface Compteurs {
  aChiffrer: number;
  chiffres: number;
  dejaChiffres: number;
  vide: number;
  nonTexte: number;
  deuxCles: number;
  ignorees: number;
  echecs: number;
}

function compteursVides(): Compteurs {
  return {
    aChiffrer: 0,
    chiffres: 0,
    dejaChiffres: 0,
    vide: 0,
    nonTexte: 0,
    deuxCles: 0,
    ignorees: 0,
    echecs: 0,
  };
}

function anomalies(c: Compteurs): number {
  return c.vide + c.nonTexte + c.deuxCles;
}

function ligneAnomalies(c: Compteurs): string {
  return `anomalie_vide=${c.vide} anomalie_non_texte=${c.nonTexte} anomalie_deux_cles=${c.deuxCles}`;
}

/**
 * Parcourt les positionnements qui portent la clé en clair et applique la
 * MÊME décision pure que l'écriture. Lecture seule : aucun verrou.
 */
async function parcourirEnClair(deps: Dependances, limite: number | null): Promise<Compteurs> {
  const c = compteursVides();
  let curseur = CURSEUR_INITIAL;
  for (;;) {
    const lot = await deps.prisma.$queryRaw<Array<{ id: string; reponses: unknown }>>`
      /* rattrapage:lister-reponses */
      SELECT id, reponses
        FROM questionnaires
       WHERE type = 'positionnement'
         AND reponses->'detailAdaptation' IS NOT NULL
         AND id > ${curseur}::uuid
       ORDER BY id
       LIMIT ${TAILLE_LOT}`;
    for (const ligne of lot) {
      const d = deciderRattrapage(ligne.reponses);
      if (d.statut === "a_chiffrer") {
        if (limite !== null && c.aChiffrer >= limite) return c;
        c.aChiffrer += 1;
      } else if (d.statut === "anomalie") {
        if (d.motif === "vide") c.vide += 1;
        else if (d.motif === "non_texte") c.nonTexte += 1;
        else c.deuxCles += 1;
      } else c.ignorees += 1;
    }
    if (lot.length < TAILLE_LOT) return c;
    curseur = lot[lot.length - 1]!.id;
  }
}

async function essaiABlanc(deps: Dependances, limite: number | null): Promise<number> {
  console.log(`${PREFIXE} ESSAI À BLANC — aucune écriture. Ajouter --appliquer pour chiffrer.`);
  const c = await parcourirEnClair(deps, limite);

  const [etat] = await deps.prisma.$queryRaw<
    Array<{ deja_chiffres: unknown; hors_positionnement: unknown }>
  >`
    /* rattrapage:etat */
    SELECT count(*) FILTER (WHERE type = 'positionnement'
                              AND reponses->'detailAdaptationChiffre' IS NOT NULL) AS deja_chiffres,
           count(*) FILTER (WHERE type <> 'positionnement'
                              AND (reponses->'detailAdaptation' IS NOT NULL
                                   OR reponses->'detailAdaptationChiffre' IS NOT NULL)) AS hors_positionnement
      FROM questionnaires`;

  const [fiches] = await deps.prisma.$queryRaw<
    Array<{
      fiche_porte_deja_un_detail: unknown;
      fiche_vide: unknown;
      situation_handicap_non_posee: unknown;
      stagiaire_anonymise: unknown;
    }>
  >`
    /* rattrapage:fiches */
    SELECT count(*) FILTER (WHERE t.handicap_details_chiffre IS NOT NULL) AS fiche_porte_deja_un_detail,
           count(*) FILTER (WHERE t.handicap_details_chiffre IS NULL)     AS fiche_vide,
           count(*) FILTER (WHERE t.situation_handicap = false)           AS situation_handicap_non_posee,
           count(*) FILTER (WHERE t.deleted_at IS NOT NULL)               AS stagiaire_anonymise
      FROM questionnaires q
      JOIN enrollments e ON e.id = q.enrollment_id
      JOIN trainees    t ON t.id = e.trainee_id
     WHERE q.type = 'positionnement'
       AND q.reponses->'detailAdaptation' IS NOT NULL`;

  console.log(
    `${PREFIXE} a_chiffrer=${c.aChiffrer}${limite !== null ? ` (limite=${limite})` : ""} ` +
      `${ligneAnomalies(c)} deja_chiffres=${entier(etat?.deja_chiffres)} ` +
      `hors_positionnement=${entier(etat?.hors_positionnement)}`,
  );
  console.log(
    `${PREFIXE} fiches : porte_deja_un_detail=${entier(fiches?.fiche_porte_deja_un_detail)} ` +
      `vide=${entier(fiches?.fiche_vide)} ` +
      `situation_handicap_non_posee=${entier(fiches?.situation_handicap_non_posee)} ` +
      `stagiaire_anonymise=${entier(fiches?.stagiaire_anonymise)}`,
  );
  return 0;
}

async function appliquer(deps: Dependances, limite: number | null): Promise<number> {
  const c = compteursVides();
  let curseur = CURSEUR_INITIAL;
  let arret = false;

  while (!arret) {
    const lot = await deps.prisma.$queryRaw<Array<{ id: string }>>`
      /* rattrapage:lister-ids */
      SELECT id
        FROM questionnaires
       WHERE type = 'positionnement'
         AND reponses->'detailAdaptation' IS NOT NULL
         AND id > ${curseur}::uuid
       ORDER BY id
       LIMIT ${TAILLE_LOT}`;

    for (const { id } of lot) {
      if (limite !== null && c.chiffres >= limite) {
        arret = true;
        break;
      }
      try {
        const statut = await deps.prisma.$transaction(
          (tx) => chiffrerUneLigne(tx, id, deps.crypto),
          { timeout: 10_000 },
        );
        if (statut === "chiffre") c.chiffres += 1;
        else if (statut === "deja_chiffre") c.dejaChiffres += 1;
        else if (statut === "anomalie_vide") c.vide += 1;
        else if (statut === "anomalie_non_texte") c.nonTexte += 1;
        else if (statut === "anomalie_deux_cles") c.deuxCles += 1;
        else c.ignorees += 1;
      } catch (err) {
        c.echecs += 1;
        console.error(
          `${PREFIXE} ÉCHEC ligne=${id} etape=${nommer(err)} — transaction annulée, passe arrêtée. ` +
            "Corriger puis relancer : les lignes déjà chiffrées ne seront pas retouchées.",
        );
        arret = true;
        break;
      }
    }
    if (lot.length < TAILLE_LOT) break;
    curseur = lot[lot.length - 1]!.id;
  }

  // Trace de fin de passe — seulement si la passe a écrit ou échoué : une
  // relance sans rien à faire n'écrit rien (idempotence).
  if (c.chiffres > 0 || c.echecs > 0) {
    try {
      await deps.prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: ACTION_PASSE,
          targetType: "Questionnaire",
          targetId: null,
          changes: {
            chiffres: c.chiffres,
            anomalies: anomalies(c),
            dejaChiffres: c.dejaChiffres,
            echecs: c.echecs,
            politique: POLITIQUE,
          },
        },
      });
    } catch (err) {
      c.echecs += 1;
      console.error(`${PREFIXE} journal de fin de passe NON écrit (${nommer(err)})`);
    }
  }

  console.log(
    `${PREFIXE} APPLIQUÉ — chiffres=${c.chiffres} deja_chiffres=${c.dejaChiffres} ` +
      `${ligneAnomalies(c)} ignorees=${c.ignorees} echecs=${c.echecs}`,
  );
  return c.echecs > 0 ? 1 : 0;
}

async function verifier(deps: Dependances): Promise<number> {
  let ok = 0;
  let ko = 0;
  let curseur = CURSEUR_INITIAL;
  for (;;) {
    const lot = await deps.prisma.$queryRaw<Array<{ id: string; chiffre: string | null }>>`
      /* rattrapage:lister-chiffres */
      SELECT id, reponses->>'detailAdaptationChiffre' AS chiffre
        FROM questionnaires
       WHERE type = 'positionnement'
         AND reponses->'detailAdaptationChiffre' IS NOT NULL
         AND id > ${curseur}::uuid
       ORDER BY id
       LIMIT ${TAILLE_LOT}`;
    for (const { id, chiffre } of lot) {
      let valide = false;
      if (typeof chiffre === "string" && deps.crypto.isEncryptedPii(chiffre)) {
        try {
          const lu = deps.crypto.decryptPii(chiffre);
          valide = lu !== PII_DECRYPT_PLACEHOLDER && lu.trim() !== "";
        } catch {
          valide = false;
        }
      }
      if (valide) ok += 1;
      else {
        ko += 1;
        console.error(`${PREFIXE} ko ligne=${id}`);
      }
    }
    if (lot.length < TAILLE_LOT) break;
    curseur = lot[lot.length - 1]!.id;
  }

  const restant = await parcourirEnClair(deps, null);
  console.log(
    `${PREFIXE} VÉRIFICATION — ok=${ok} ko=${ko} en_clair_restant=${restant.aChiffrer} ${ligneAnomalies(restant)}`,
  );
  return ko > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

/** Code de sortie : 0 succès · 1 échec de passe ou `ko` · 2 refus (rien n'est écrit). */
export async function main(
  argv: readonly string[],
  deps: Dependances = dependancesParDefaut(),
): Promise<number> {
  const options = lireArguments(argv);
  if ("erreur" in options) {
    console.error(`${PREFIXE} REFUS : ${options.erreur}. Aucune écriture.`);
    return 2;
  }

  try {
    const prealables = await verifierPrealables(deps);
    if (prealables.refus !== null) {
      console.error(`${PREFIXE} REFUS au démarrage : ${prealables.refus}. Aucune écriture.`);
      return 2;
    }
    if (prealables.temoin === "absent") {
      console.warn(
        `${PREFIXE} aucune valeur témoin écrite par le site : comparer l'empreinte de la clé ` +
          "entre les conteneurs web et worker (runbook R34, étape 2) AVANT --appliquer.",
      );
    } else {
      console.log(`${PREFIXE} clé vérifiée sur une valeur écrite par le site.`);
    }

    if (options.mode === "appliquer") return await appliquer(deps, options.limite);
    if (options.mode === "verifier") return await verifier(deps);
    return await essaiABlanc(deps, options.limite);
  } catch (err) {
    console.error(`${PREFIXE} ARRÊT : erreur inattendue (${nommer(err)}).`);
    return 1;
  } finally {
    await deps.prisma.$disconnect().catch(() => undefined);
  }
}

const cheminLance = (process.argv[1] ?? "").replace(/\\/g, "/");
if (/\/chiffrer-details-adaptation-positionnement\.ts$/.test(cheminLance)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 1;
    },
  );
}
