/**
 * Formateurs indépendants — lecture du contexte du virement d'un relevé de
 * mission (lot L12d). La règle vit dans `virement-mission.ts` (pure).
 *
 * 🔒 L'IBAN n'est déchiffré qu'ici, au clic, pour en garder les QUATRE derniers
 * caractères sur le relevé payé ; il ne sort jamais de cette fonction en clair
 * et n'est jamais journalisé.
 */

import { decryptPii } from "@/lib/pii-crypto";

import { ajouterJours, jourDeColonneDate, jourParis } from "../argent/dates";
import { PARAMETRES_ARGENT_FORMATEURS } from "../argent/parametres";
import { vigilanceExigible } from "../vigilance-seuil";
import { lireCumulHonorairesHtCents, type ClientCumulHonoraires } from "../vigilance-seuil-lecture";
import {
  attenteAttestationALaMission,
  gardeVirementMission,
  ibanFin4,
  type VerdictVirementMission,
} from "./virement-mission";

/** Le strict nécessaire d'un client Prisma. */
export interface ClientVirementMission {
  trainer: {
    findUnique(a: unknown): Promise<{ iban: string | null; ibanEmpreinte: string | null } | null>;
  };
  trainerDocument: {
    findMany(a: unknown): Promise<Array<{ dateExpiration: Date | null }>>;
  };
  demandeChangementFormateur: {
    count(a: unknown): Promise<number>;
    findFirst(a: unknown): Promise<{ createdAt: Date; traiteAt: Date | null } | null>;
  };
  /**
   * Lot G1 — le cumul des honoraires HT (seuil de vigilance). Absent ou illisible :
   * l'attestation reste exigée (garde d'avant le lot).
   */
  trainerStatement?: ClientCumulHonoraires["trainerStatement"];
}

export interface ReleveAPayer {
  readonly trainerId: string;
  readonly echeanceAt: Date;
  readonly totalTtcCents: number;
}

export async function contexteVirementMission(
  db: ClientVirementMission,
  releve: ReleveAPayer,
  ibanEmpreinteAffichee: string | null,
  maintenant: Date,
): Promise<{
  verdict: VerdictVirementMission;
  preuve: { ibanFin4: string; ibanEmpreinte: string } | null;
}> {
  const echeance = jourParis(releve.echeanceAt);
  const derniereJournee = ajouterJours(echeance, -PARAMETRES_ARGENT_FORMATEURS.delaiPaiementJours);
  const [trainer, attestations, enAttente, dernier, cumul] = await Promise.all([
    db.trainer.findUnique({
      where: { id: releve.trainerId },
      select: { iban: true, ibanEmpreinte: true },
    }),
    db.trainerDocument.findMany({
      where: {
        trainerId: releve.trainerId,
        type: "attestation_vigilance_urssaf",
        statutValidation: "valide",
        archiveAt: null,
      },
      select: { dateExpiration: true },
    }),
    db.demandeChangementFormateur.count({
      where: { trainerId: releve.trainerId, nature: "iban", statut: "en_attente" },
    }),
    db.demandeChangementFormateur.findFirst({
      where: { trainerId: releve.trainerId, nature: "iban", statut: "acceptee" },
      orderBy: { traiteAt: "desc" },
      select: { createdAt: true, traiteAt: true },
    }),
    // Ce relevé est « facture reçue » : il est DANS le cumul (la mission en cours de paiement).
    db.trainerStatement
      ? lireCumulHonorairesHtCents(releve.trainerId, { trainerStatement: db.trainerStatement })
      : Promise.resolve(null),
  ]);
  const verdict = gardeVirementMission({
    derniereJournee,
    echeance,
    aujourdhui: jourParis(maintenant),
    maintenant,
    totalTtcCents: releve.totalTtcCents,
    // Une attestation sans date de fin ne prouve rien à une date donnée : écartée.
    attestationsValidesJusquau: attestations.flatMap((a) =>
      a.dateExpiration ? [jourDeColonneDate(a.dateExpiration)] : [],
    ),
    // Lot G1 : sous le seuil de vigilance, l'attestation n'est pas exigée pour payer.
    vigilanceExigible: vigilanceExigible(cumul),
    demandeIbanEnAttente: enAttente > 0,
    dernierChangementIban:
      dernier?.traiteAt != null ? { demandeA: dernier.createdAt, valideA: dernier.traiteAt } : null,
    ibanEmpreinteActuelle: trainer?.ibanEmpreinte ?? null,
    ibanEmpreinteAffichee,
    // La fin de collaboration pour décès n'existe pas encore (motif à venir, L14).
    finPourDeces: false,
  });
  if (!verdict.autorise || !trainer?.iban || !trainer.ibanEmpreinte)
    return { verdict, preuve: null };
  const clair = decryptPii(trainer.iban, {
    aad: `trainer:${releve.trainerId}:iban`,
    cleExigee: true,
  });
  return { verdict, preuve: { ibanFin4: ibanFin4(clair), ibanEmpreinte: trainer.ibanEmpreinte } };
}

/**
 * Lot G1 — les relevés de MISSION non payés de ce formateur dont le virement attend
 * l'attestation URSSAF (seuil atteint, aucune attestation vérifiée valable à la date de
 * la mission). Même règle que « Virement fait » (`attenteAttestationALaMission`), sans
 * rien lire de l'IBAN. Lecture en échec : ensemble vide (l'écran n'affirme rien).
 */
export async function relevesMissionEnAttenteAttestation(
  db: Pick<ClientVirementMission, "trainerDocument"> & {
    trainerStatement: ClientCumulHonoraires["trainerStatement"] & {
      findMany(a: unknown): Promise<unknown>;
    };
  },
  trainerId: string,
): Promise<Set<string>> {
  try {
    const [lus, attestations, cumul] = await Promise.all([
      db.trainerStatement.findMany({
        where: {
          trainerId,
          origine: "passage_mission",
          // Les mêmes que « Virements à faire » (`aUnVirementMissionDu`).
          statut: "facture_recue",
          payeAt: null,
          avoirDeId: null,
        },
        select: { id: true, echeanceAt: true },
      }),
      db.trainerDocument.findMany({
        where: {
          trainerId,
          type: "attestation_vigilance_urssaf",
          statutValidation: "valide",
          archiveAt: null,
        },
        select: { dateExpiration: true },
      }),
      lireCumulHonorairesHtCents(trainerId, { trainerStatement: db.trainerStatement }),
    ]);
    const releves = lus as Array<{ id: string; echeanceAt: Date | null }>;
    const exigible = vigilanceExigible(cumul);
    const valables = attestations.flatMap((a) =>
      a.dateExpiration ? [jourDeColonneDate(a.dateExpiration)] : [],
    );
    const ids = new Set<string>();
    for (const r of releves) {
      if (r.echeanceAt === null) continue;
      const derniereJournee = ajouterJours(
        jourParis(r.echeanceAt),
        -PARAMETRES_ARGENT_FORMATEURS.delaiPaiementJours,
      );
      if (
        attenteAttestationALaMission({
          vigilanceExigible: exigible,
          attestationsValidesJusquau: valables,
          derniereJournee,
        })
      ) {
        ids.add(r.id);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}

/** Le strict nécessaire pour lire l'IBAN d'un formateur. */
export interface ClientIbanFormateur {
  trainer: {
    findUnique(a: unknown): Promise<{ iban: string | null; ibanEmpreinte: string | null } | null>;
  };
}

/**
 * L'IBAN en clair et son empreinte, au moment de la lecture. `null` : aucun
 * IBAN, aucune empreinte ou déchiffrement impossible. 🔒 Jamais journalisé :
 * l'appelant ne garde que l'empreinte, ou n'affiche que la fin.
 */
export async function ibanEnClairPourVirement(
  db: ClientIbanFormateur,
  trainerId: string,
): Promise<{ iban: string; empreinte: string } | null> {
  const t = await db.trainer.findUnique({
    where: { id: trainerId },
    select: { iban: true, ibanEmpreinte: true },
  });
  if (!t?.iban || !t.ibanEmpreinte) return null;
  try {
    const iban = decryptPii(t.iban, { aad: `trainer:${trainerId}:iban`, cleExigee: true });
    return { iban: iban.replace(/\s+/g, "").toUpperCase(), empreinte: t.ibanEmpreinte };
  } catch {
    return null;
  }
}

/**
 * Lot D (M6) — ce que l'écran de paiement AFFICHE : les quatre derniers
 * caractères de l'IBAN et l'empreinte que le formulaire renverra au clic.
 */
export async function ibanAffichePourVirement(
  db: ClientIbanFormateur,
  trainerId: string,
): Promise<{ fin4: string; empreinte: string } | null> {
  const lu = await ibanEnClairPourVirement(db, trainerId);
  if (lu === null || lu.iban.length < 4) return null;
  return { fin4: ibanFin4(lu.iban), empreinte: lu.empreinte };
}
