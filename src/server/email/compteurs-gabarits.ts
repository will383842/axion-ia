// Compteurs d'envois par gabarit sur 30 jours (L6b).
//
// UNE seule requête : `groupBy` sur (`template`, `status`) du journal `EmailLog`,
// fenêtre `createdAt >= maintenant - 30 j` (index `template` et `createdAt` présents).
// Lecture seule, composant serveur : aucun envoi, aucune écriture.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";

export const FENETRE_COMPTEURS_JOURS = 30;
const JOUR_MS = 24 * 60 * 60 * 1000;

export interface CompteursGabarit {
  /** Toutes les lignes du journal sur la fenêtre, tous statuts confondus. */
  readonly total: number;
  readonly envoyes: number;
  readonly echecs: number;
  readonly rebonds: number;
  /** En attente ou annulés : ni partis, ni en échec. */
  readonly autres: number;
}

/** Ce qu'on affiche pour un gabarit sans aucune ligne dans la fenêtre : des zéros. */
export const COMPTEURS_VIDES: CompteursGabarit = {
  total: 0,
  envoyes: 0,
  echecs: 0,
  rebonds: 0,
  autres: 0,
};

export interface LigneRegroupee {
  readonly template: string;
  readonly status: string;
  readonly _count: { readonly _all: number };
}

/** Regroupe les lignes `groupBy` par gabarit. Fonction pure. */
export function agregerCompteurs(
  lignes: ReadonlyArray<LigneRegroupee>,
): ReadonlyMap<string, CompteursGabarit> {
  const sortie = new Map<string, CompteursGabarit>();
  for (const l of lignes) {
    const n = l._count._all;
    const avant = sortie.get(l.template) ?? COMPTEURS_VIDES;
    sortie.set(l.template, {
      total: avant.total + n,
      envoyes: avant.envoyes + (l.status === "sent" ? n : 0),
      echecs: avant.echecs + (l.status === "failed" ? n : 0),
      rebonds: avant.rebonds + (l.status === "bounced" ? n : 0),
      autres:
        avant.autres +
        (l.status === "sent" || l.status === "failed" || l.status === "bounced" ? 0 : n),
    });
  }
  return sortie;
}

/**
 * Compteurs de tous les gabarits sur les 30 derniers jours. Un gabarit absent de la
 * table rendue n'a rien envoyé : l'appelant lit `COMPTEURS_VIDES`.
 * Renvoie `null` si la lecture échoue : la liste des gabarits ne doit pas tomber
 * pour un chiffre.
 */
export async function lireCompteursGabarits(
  maintenant: Date = new Date(),
): Promise<ReadonlyMap<string, CompteursGabarit> | null> {
  try {
    const lignes = await prisma.emailLog.groupBy({
      by: ["template", "status"],
      where: {
        createdAt: { gte: new Date(maintenant.getTime() - FENETRE_COMPTEURS_JOURS * JOUR_MS) },
      },
      _count: { _all: true },
    });
    return agregerCompteurs(lignes);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "compteurs-gabarits" } });
    return null;
  }
}
