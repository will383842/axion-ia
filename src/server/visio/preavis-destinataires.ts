/**
 * Qui reçoit le PRÉAVIS de l'enregistrement des visios (chantier visio, PR 1).
 *
 * ## La règle B3
 *
 * Un client est **actif** s'il a au moins une pièce chez nous : un devis, une
 * facture de formation, une session de formation, une inscription financée, un
 * contrat de coaching, une mission d'audit ou un dossier de financement. Un
 * client actif a signé sous l'ancienne liste de sous-traitants : il est prévenu
 * 30 jours avant la date d'effet (ADR 0056).
 *
 * ## Ce que la fonction rend
 *
 * Les adresses à prévenir (une par adresse, même si deux fiches la partagent),
 * et des COMPTES. Jamais de journalisation d'adresse : le script qui l'appelle
 * n'imprime que des nombres.
 *
 * ## Pourquoi on lit toutes les fiches, et pas un `where` à sept `some`
 *
 * La table `clients` est petite (quelques fiches), et la règle vit ici dans une
 * fonction PURE (`estClientActif`) : elle se teste sans base, et le test qui
 * vérifie la règle vérifie la vraie règle, pas une maquette de requête.
 * `RELATIONS_B3` est, en plus, confronté au schéma Prisma réel par un test.
 *
 * Stub-aware : au build (`stub.invalid`), le proxy Prisma rend `[]`.
 */

import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";

/**
 * Les sept relations de `Client` qui rendent une fiche active (règle B3), avec
 * le modèle qu'elles visent. Confronté à `prisma/schema.prisma` par
 * `__tests__/la-liste-des-clients-actifs-suit-la-regle-b3.spec.ts`.
 */
export const RELATIONS_B3 = {
  devis: "Devis",
  facturesFormation: "FactureFormation",
  sessions: "TrainingSession",
  enrollmentsFinances: "Enrollment",
  coachingContracts: "CoachingContract",
  auditMissions: "AuditMission",
  dossiersFinancement: "DossierFinancement",
} as const;

export type RelationB3 = keyof typeof RELATIONS_B3;

export type ComptesB3 = Readonly<Record<RelationB3, number>>;

/** Règle B3 : au moins une pièce, quelle qu'elle soit. */
export function estClientActif(comptes: ComptesB3): boolean {
  return (Object.keys(RELATIONS_B3) as RelationB3[]).some((r) => (comptes[r] ?? 0) > 0);
}

export interface DestinatairePreavis {
  readonly clientId: string;
  /** Adresse en clair (déchiffrée si la fiche la stockait chiffrée). */
  readonly email: string;
}

export interface ListePreavis {
  /** Fiches actives (règle B3). */
  readonly actifs: number;
  /** Une entrée par adresse distincte. */
  readonly destinataires: readonly DestinatairePreavis[];
  /** Fiches actives sans adresse utilisable (vide, ou chiffrée sans clé). */
  readonly sansAdresse: number;
  /** Fiches actives dont l'adresse est déjà celle d'une autre fiche active. */
  readonly adressesEnDouble: number;
}

/** Ce que la fonction lit de Prisma — le strict nécessaire, pour les tests. */
export interface LecteurClients {
  client: {
    findMany(args: {
      select: {
        id: true;
        contactEmail: true;
        _count: { select: Record<RelationB3, true> };
      };
      orderBy: { createdAt: "asc" };
    }): Promise<
      Array<{
        id: string;
        contactEmail: string | null;
        _count: Partial<Record<RelationB3, number>>;
      }>
    >;
  };
}

const SELECT_COMPTES = Object.fromEntries(
  (Object.keys(RELATIONS_B3) as RelationB3[]).map((r) => [r, true]),
) as Record<RelationB3, true>;

export async function clientsActifsPourPreavis(prisma: LecteurClients): Promise<ListePreavis> {
  const fiches = await prisma.client.findMany({
    select: { id: true, contactEmail: true, _count: { select: SELECT_COMPTES } },
    orderBy: { createdAt: "asc" },
  });

  let actifs = 0;
  let sansAdresse = 0;
  let adressesEnDouble = 0;
  const vues = new Set<string>();
  const destinataires: DestinatairePreavis[] = [];

  for (const f of fiches) {
    const comptes = Object.fromEntries(
      (Object.keys(RELATIONS_B3) as RelationB3[]).map((r) => [r, f._count[r] ?? 0]),
    ) as ComptesB3;
    if (!estClientActif(comptes)) continue;
    actifs += 1;

    const email = f.contactEmail ? decryptPii(f.contactEmail).trim() : "";
    if (!isDecryptedEmailUsable(email)) {
      sansAdresse += 1;
      continue;
    }
    const cle = email.toLowerCase();
    if (vues.has(cle)) {
      adressesEnDouble += 1;
      continue;
    }
    vues.add(cle);
    destinataires.push({ clientId: f.id, email });
  }

  return { actifs, destinataires, sansAdresse, adressesEnDouble };
}
