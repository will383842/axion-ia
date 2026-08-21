/**
 * Registre des signatures d'ÉMARGEMENT — la lecture qui manquait.
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 `D3-3-05` (2026-08-21). Le mode auditeur portait un registre complet des
 * signatures de PIÈCES — qui a signé, quand, la chaîne tient-elle, et un
 * formulaire de révocation. Les signatures d'ÉMARGEMENT, elles, n'avaient
 * **aucune surface** : ni liste, ni verdict de chaîne, ni révocation.
 *
 * Conséquence directe, et c'est mon propre défaut : le 2026-08-20 j'ai écrit
 * `revoquerSignatureEmargementAction` — service, habilitation, tests, mutations
 * vérifiées — et elle n'était appelable de nulle part. Exactement le motif que
 * cet audit poursuit depuis trois jours : *l'outil est écrit, le raccordement
 * manque*. `signature-revocation.ts` porte d'ailleurs le même constat, pour les
 * pièces, corrigé une session plus tôt.
 *
 * ## Ce que ce registre montre, et ce qu'il refuse de faire
 *
 * Il ne RÉPARE rien. Une chaîne rompue est un RÉSULTAT à présenter — c'est déjà
 * la doctrine de `verifierChaine`, qui ne lève jamais.
 *
 * ⚠️ Il lit par INSCRIPTION, pas par session : la chaîne de hachage est chaînée
 * par inscription (`enrollmentId`, cf. le schéma), et une chaîne se vérifie
 * entière ou pas du tout. Regrouper par session mélangerait des chaînes
 * distinctes et produirait des ruptures fantômes.
 */

import { prisma } from "@/lib/prisma";
import { verifierChaine, type AnomalieChaine } from "./hash";
import { maillonDepuisLigne, verrouColonnes } from "./reconstruction";
import { lignesDeChaine } from "./lignes-de-chaine";

/** Une signature, telle que le registre l'affiche. */
export interface SignatureRegistre {
  readonly signatureId: string;
  readonly signataireNom: string;
  readonly signeAt: Date;
  /** ⚠️ DISTINCT de `signeAt` : l'écart révèle une insertion tardive. */
  readonly createdAt: Date;
  readonly date: Date;
  readonly demiJournee: string;
  readonly heureDebut: string;
  readonly heureFin: string;
  readonly selfHash: string;
  /**
   * La signature a-t-elle été recueillie par le formateur sur son poste ?
   *
   * 🔑 Ce n'est pas un détail d'affichage : dans ce cas c'est le formateur qui
   * porte l'identification du signataire — comme une feuille papier qu'il fait
   * circuler. Un auditeur doit pouvoir le distinguer d'une signature apposée
   * par le stagiaire depuis son propre appareil.
   */
  readonly recueilliParFormateur: boolean;
}

/** Une inscription et sa chaîne. */
export interface RapportInscription {
  readonly enrollmentId: string;
  readonly stagiaire: string;
  readonly sessionId: string;
  readonly sessionNumero: string;
  readonly sessionTitre: string;
  readonly chaineValide: boolean;
  readonly anomalies: ReadonlyArray<AnomalieChaine>;
  readonly signatures: ReadonlyArray<SignatureRegistre>;
}

export interface FiltreRegistre {
  /** Restreint à une session. Sans lui, la lecture porte sur tout l'historique. */
  readonly sessionId?: string;
  /** N'affiche que les inscriptions dont la chaîne est en anomalie. */
  readonly seulementAnomalies?: boolean;
  /** Plafond de lecture — un registre n'est pas un export. */
  readonly limite?: number;
}

/**
 * Plafond par défaut.
 *
 * ⚠️ Un plafond n'est pas une pagination : il est écrit à l'écran, et l'écran
 * invite à filtrer par session. Tronquer en silence ferait lire « tout est
 * régulier » là où l'on n'a montré que les cent premières lignes.
 */
export const PLAFOND_REGISTRE = 200;

export async function listerRegistreEmargement(
  filtre: FiltreRegistre = {},
): Promise<{ rapports: RapportInscription[]; tronque: boolean }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { rapports: [], tronque: false };
  }

  const limite = filtre.limite ?? PLAFOND_REGISTRE;
  const inscriptions = await prisma.enrollment.findMany({
    where: {
      // Une inscription sans aucune signature vivante n'a pas de chaîne à
      // montrer — l'absence d'émargement se constate ailleurs (les alertes),
      // pas dans un registre de preuve.
      emargementSignatures: { some: { revokedAt: null } },
      ...(filtre.sessionId !== undefined ? { sessionId: filtre.sessionId } : {}),
    },
    orderBy: [{ session: { dateDebut: "desc" } }, { id: "asc" }],
    take: limite + 1,
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { id: true, numero: true, titreSession: true } },
      emargementSignatures: lignesDeChaine(),
    },
  });

  const tronque = inscriptions.length > limite;
  const rapports: RapportInscription[] = [];

  for (const inscription of inscriptions.slice(0, limite)) {
    // ⚠️ `verrouColonnes` plutôt qu'un `as unknown as` : la conversion est
    // vérifiée à la compilation, donc retirer une colonne scellée casse le build
    // au lieu de produire ici, silencieusement, un verdict d'intégrité faux.
    const res = verifierChaine(
      inscription.emargementSignatures.map((s) => maillonDepuisLigne(verrouColonnes(s))),
    );
    if (filtre.seulementAnomalies === true && res.valide) continue;

    rapports.push({
      enrollmentId: inscription.id,
      stagiaire: `${inscription.trainee.prenom} ${inscription.trainee.nom}`,
      sessionId: inscription.session.id,
      sessionNumero: inscription.session.numero,
      sessionTitre: inscription.session.titreSession,
      chaineValide: res.valide,
      anomalies: res.anomalies,
      signatures: inscription.emargementSignatures.map((s) => ({
        signatureId: s.id,
        signataireNom: s.signataireNom,
        signeAt: s.signeAt,
        createdAt: s.createdAt,
        date: s.date,
        demiJournee: s.demiJournee,
        heureDebut: s.heureDebut,
        heureFin: s.heureFin,
        selfHash: s.selfHash,
        recueilliParFormateur: s.recueilliParTrainerId !== null,
      })),
    });
  }

  return { rapports, tronque };
}
