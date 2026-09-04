import "server-only";

/**
 * L'EXPORT CSV DES CANDIDATURES — le corps, sans session.
 *
 * ⚠️ **CE FICHIER N'EST PAS UN MODULE `"use server"`, ET C'EST VOLONTAIRE.**
 *    Même raison que `reads.ts` : dans un fichier de Server Actions, chaque
 *    export devient un point d'entrée réseau. La garde vit chez l'appelant —
 *    la route `/api/admin/candidatures/export`, qui tranche le rôle AVANT
 *    d'appeler et journalise APRÈS, exactement comme la route du CV.
 *
 * 🔴 CE QUI SORT D'ICI EST LE FICHIER LE PLUS SENSIBLE DU DOSSIER : nom,
 *    adresse, téléphone et prétentions, en clair, dans un fichier qui quittera
 *    la console. Trois choix en découlent :
 *
 *    1. `csvEscape` du dépôt, jamais un échappement local — un champ commençant
 *       par `=` est ÉVALUÉ par le tableur qui l'ouvre, et la cible est
 *       l'administrateur, pas le site ;
 *    2. un PLAFOND, et une ligne d'avertissement DANS le fichier quand il
 *       mord — un export tronqué en silence se lit comme un export complet, et
 *       c'est ainsi qu'on conclut « il n'y a que 500 candidats » ;
 *    3. lecture par CURSEUR et non par `skip`/`take` — une candidature déposée
 *       pendant l'export décalerait la fenêtre, rendrait une ligne deux fois et
 *       en sauterait une autre.
 */

import { prisma } from "@/lib/prisma";
import { csvEscape } from "@/lib/csv";
import { decryptPii } from "@/lib/pii-crypto";
import { LIBELLE_MOTIF_REFUS, LIBELLE_STATUT } from "@/content/recrutement/statuts";
import type { Prisma } from "../../../prisma/generated/client";
import {
  construireFiltreCandidatures,
  matchCandidatureSearch,
  normaliserRecherche,
  type ListApplicationsInput,
} from "./reads";

/** Lu par page, pour ne pas charger tout le stock en mémoire d'un coup. */
const TAILLE_PAGE = 200;

/**
 * Plafond de lignes. Large au regard du volume réel (quelques centaines), et
 * fini par principe — un export sans borne est une panne mémoire qui attend
 * son jour de gloire.
 */
export const PLAFOND_EXPORT = 5_000;

const COLONNES = [
  "id",
  "deposeeLe",
  "offre",
  "statut",
  "motifRefus",
  "decideeLe",
  "prenom",
  "nom",
  "email",
  "telephone",
  "ville",
  "posteActuel",
  "experience",
  "disponibilite",
  "pretentions",
  "linkedin",
  "cvJoint",
  "premiereReponseLe",
  "derniereActiviteLe",
  "aTraiter",
] as const;

const SELECTION = {
  id: true,
  submittedAt: true,
  offerTitleSnap: true,
  status: true,
  rejectionReason: true,
  decidedAt: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  city: true,
  currentRole: true,
  experienceBand: true,
  availability: true,
  salaryExpectation: true,
  linkedinUrl: true,
  cvStoragePath: true,
  firstResponseAt: true,
  lastActivityAt: true,
  needsAttention: true,
} as const;

type Ligne = Prisma.JobApplicationGetPayload<{ select: typeof SELECTION }>;

/** Une date, ou une case vide. Jamais « null » écrit en toutes lettres. */
function jour(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

/** Déchiffrement tolérant — un ciphertext corrompu ne doit pas vider l'export. */
function dechiffrer(v: string): string {
  try {
    return decryptPii(v);
  } catch {
    return "[déchiffrement échoué]";
  }
}

export interface ExportCandidatures {
  readonly filename: string;
  readonly csv: string;
  /** Nombre de candidatures réellement sorties — ce que le journal doit consigner. */
  readonly lignes: number;
  readonly tronque: boolean;
}

/**
 * Construit le fichier. **Ne journalise pas et ne vérifie aucun droit** : les
 * deux appartiennent à l'appelant, qui seul connaît la session.
 */
export async function construireExportCandidatures(
  input: Partial<ListApplicationsInput> = {},
): Promise<ExportCandidatures> {
  const { where, recherche } = construireFiltreCandidatures(input);
  const terme = normaliserRecherche(recherche);

  const lignes: string[] = [];
  let curseur: string | null = null;
  let tronque = false;

  for (;;) {
    const page: Ligne[] = await prisma.jobApplication.findMany({
      where,
      // (submittedAt, id) rend l'ordre TOTAL : sans `id`, deux candidatures
      // déposées à la même milliseconde rendraient le curseur ambigu.
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: TAILLE_PAGE,
      ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
      select: SELECTION,
    });
    if (page.length === 0) break;

    for (const l of page) {
      const prenom = dechiffrer(l.firstName);
      const nom = dechiffrer(l.lastName);
      const email = dechiffrer(l.email);
      // La recherche libre porte sur des champs CHIFFRÉS : aucune clause SQL ne
      // peut l'exprimer. Elle s'applique après déchiffrement, ligne à ligne —
      // donc sans le plafond de balayage du listing, qui lui pagine à l'écran.
      if (terme && !matchCandidatureSearch({ prenom, nom, email }, terme)) continue;

      const valeurs: Record<(typeof COLONNES)[number], unknown> = {
        id: l.id,
        deposeeLe: jour(l.submittedAt),
        offre: l.offerTitleSnap,
        statut: LIBELLE_STATUT[l.status],
        motifRefus: l.rejectionReason === null ? "" : LIBELLE_MOTIF_REFUS[l.rejectionReason],
        decideeLe: jour(l.decidedAt),
        prenom,
        nom,
        email,
        telephone: dechiffrer(l.phone),
        ville: l.city ?? "",
        posteActuel: l.currentRole ?? "",
        experience: l.experienceBand ?? "",
        disponibilite: l.availability ?? "",
        pretentions: l.salaryExpectation ?? "",
        linkedin: l.linkedinUrl ?? "",
        cvJoint: l.cvStoragePath ? "oui" : "non",
        premiereReponseLe: jour(l.firstResponseAt),
        derniereActiviteLe: jour(l.lastActivityAt),
        aTraiter: l.needsAttention ? "oui" : "non",
      };
      lignes.push(COLONNES.map((c) => csvEscape(valeurs[c])).join(";"));

      if (lignes.length >= PLAFOND_EXPORT) {
        tronque = true;
        break;
      }
    }

    if (tronque || page.length < TAILLE_PAGE) break;
    curseur = page[page.length - 1]!.id;
  }

  // Compté AVANT l'avertissement : le journal doit dire combien de candidatures
  // sont sorties, pas combien de lignes contient le fichier.
  const total = lignes.length;

  if (tronque) {
    lignes.push(
      csvEscape(
        `### EXPORT TRONQUÉ à ${PLAFOND_EXPORT} lignes — le fichier est INCOMPLET. ` +
          `Restreindre les filtres.`,
      ),
    );
  }

  // BOM UTF-8 + CRLF : sans le BOM, Excel lit « Ã© » là où il y a « é ».
  const csv = "﻿" + COLONNES.join(";") + "\r\n" + lignes.join("\r\n");
  const filename = `axion-ia-candidatures-${new Date().toISOString().slice(0, 10)}.csv`;

  return { filename, csv, lignes: total, tronque };
}
