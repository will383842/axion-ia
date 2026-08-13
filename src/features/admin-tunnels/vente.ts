/**
 * Jonction haut de tunnel → bas de tunnel.
 *
 * ── Ce que ce module fait, et surtout ce qu'il NE fait PAS ────────────────
 * Un entonnoir commercial complet existe déjà — `/planning/pipeline` : devis
 * envoyés, acceptés, à facturer, payés, avec les fuites et l'âge des affaires
 * bloquées. Ce module ne le refait pas. Il comble le seul trou réel : rien ne
 * reliait les demandes entrantes (dont les leads du simulateur) aux clients et
 * aux devis. On savait combien de leads arrivaient, et combien de devis
 * partaient, sans jamais savoir si c'étaient les mêmes gens.
 *
 * ── Pourquoi le rapprochement se fait en mémoire ──────────────────────────
 * 🔴 Il n'existe AUCUNE clé étrangère entre `Submission` et `Client`. Le seul
 * pont est l'adresse e-mail — et côté `Submission` elle est chiffrée en
 * AES-GCM à vecteur aléatoire, donc impossible à joindre en SQL. On déchiffre
 * donc en mémoire sur une fenêtre bornée, exactement comme le fait déjà
 * `src/server/qualiopi/crm/entrees.ts`.
 *
 * Conséquence assumée : le rapprochement est **indicatif**. Un prospect qui
 * signe avec une autre adresse que celle laissée sur le simulateur n'est pas
 * rattaché. Le chiffre est donc un PLANCHER de conversion, jamais un plafond —
 * c'est dit à l'écran, faute de quoi on lirait une sous-performance là où il
 * n'y a qu'un défaut de rapprochement.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { normalizeEmail } from "@/lib/security/email-hash";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";

/** Bornes de lecture : la jonction se fait en mémoire, elle doit rester finie. */
const PLAFOND_DEMANDES = 5_000;

export type LigneOrigine = {
  cle: string;
  demandes: number;
  clients: number;
  /** Part des demandes devenues client, en pourcentage. */
  partClient: number;
};

export type SyntheseVente = {
  demandes: number;
  demandesAvecEmail: number;
  devenusClients: number;
  devisEnvoyes: number;
  devisAcceptes: number;
  facturesPayees: number;
  caEncaisseCents: number;
  parOrigine: LigneOrigine[];
  tronquee: boolean;
};

const VIDE: SyntheseVente = {
  demandes: 0,
  demandesAvecEmail: 0,
  devenusClients: 0,
  devisEnvoyes: 0,
  devisAcceptes: 0,
  facturesPayees: 0,
  caEncaisseCents: 0,
  parOrigine: [],
  tronquee: false,
};

function part(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export async function chargerTunnelVente(jours: number): Promise<SyntheseVente> {
  const depuis = new Date();
  depuis.setUTCDate(depuis.getUTCDate() - jours);

  // Chaque lecture est isolée : au build (contrat ADR 0026, base stub) elles
  // rendent du vide, et la page doit s'afficher plutôt que d'échouer.
  try {
    const demandes = await prisma.submission.findMany({
      where: { submittedAt: { gte: depuis }, deletedAt: null },
      select: { id: true, type: true, details: true, contactEmail: true },
      orderBy: { submittedAt: "desc" },
      take: PLAFOND_DEMANDES,
    });

    if (demandes.length === 0) return VIDE;

    // Déchiffrement en mémoire — seule voie possible, cf. l'en-tête.
    const parEmail = new Map<string, { origine: string }[]>();
    for (const d of demandes) {
      const clair = decryptPii(d.contactEmail);
      if (!clair || !clair.includes("@")) continue;
      const cle = normalizeEmail(clair);
      const origine = resolveSubmissionLabel(
        d.type,
        (d.details as { unifiedType?: string } | null)?.unifiedType,
      );
      const liste = parEmail.get(cle) ?? [];
      liste.push({ origine });
      parEmail.set(cle, liste);
    }

    const emails = [...parEmail.keys()];
    // `Client.contactEmail` est une colonne citext : la comparaison est déjà
    // insensible à la casse côté Postgres.
    const clients =
      emails.length === 0
        ? []
        : await prisma.client.findMany({
            where: { contactEmail: { in: emails } },
            select: { id: true, contactEmail: true },
          });

    const emailsClients = new Set(
      clients.map((c) => normalizeEmail(c.contactEmail ?? "")).filter((e) => e.length > 0),
    );
    const idsClients = clients.map((c) => c.id);

    // Compte par origine : c'est la lecture qui dit quelle porte d'entrée
    // amène des clients, et laquelle amène du volume sans suite.
    const paniers = new Map<string, { demandes: number; clients: number }>();
    for (const [email, entrees] of parEmail) {
      const estClient = emailsClients.has(email);
      for (const e of entrees) {
        const p = paniers.get(e.origine) ?? { demandes: 0, clients: 0 };
        p.demandes += 1;
        if (estClient) p.clients += 1;
        paniers.set(e.origine, p);
      }
    }

    const [devisEnvoyes, devisAcceptes, factures] = await Promise.all([
      idsClients.length === 0
        ? 0
        : prisma.devis.count({
            where: { clientId: { in: idsClients }, sentAt: { not: null, gte: depuis } },
          }),
      idsClients.length === 0
        ? 0
        : prisma.devis.count({
            where: { clientId: { in: idsClients }, acceptedAt: { not: null, gte: depuis } },
          }),
      idsClients.length === 0
        ? { _count: { _all: 0 }, _sum: { montantHtCents: null } }
        : prisma.factureFormation.aggregate({
            where: { clientId: { in: idsClients }, statut: "payee", paidAt: { gte: depuis } },
            _count: { _all: true },
            _sum: { montantHtCents: true },
          }),
    ]);

    const demandesAvecEmail = [...parEmail.values()].reduce((n, l) => n + l.length, 0);
    const devenusClients = [...parEmail.entries()]
      .filter(([email]) => emailsClients.has(email))
      .reduce((n, [, l]) => n + l.length, 0);

    return {
      demandes: demandes.length,
      demandesAvecEmail,
      devenusClients,
      devisEnvoyes,
      devisAcceptes,
      facturesPayees: factures._count._all,
      caEncaisseCents: factures._sum.montantHtCents ?? 0,
      parOrigine: [...paniers.entries()]
        .map(([cle, p]) => ({ cle, ...p, partClient: part(p.clients, p.demandes) }))
        .sort((a, b) => b.demandes - a.demandes || a.cle.localeCompare(b.cle)),
      tronquee: demandes.length >= PLAFOND_DEMANDES,
    };
  } catch {
    return VIDE;
  }
}
