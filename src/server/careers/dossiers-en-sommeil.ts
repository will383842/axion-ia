import "server-only";

/**
 * LES DOSSIERS QUI DORMENT — la requête, l'écran et l'alerte.
 *
 * ## Le défaut fermé
 *
 * `lastActivityAt` et `firstResponseAt` sont alimentés depuis le lot 3, et
 * personne ne les lisait. Une colonne tenue à jour que rien ne consulte finit
 * par cesser d'être tenue à jour, sans que rien ne rougisse : ce module est ce
 * qui rend la porte unique d'écriture du journal *utile*, et donc surveillée.
 *
 * ## La règle n'est PAS ici
 *
 * Elle vit dans `content/recrutement/oubli.ts`, pure et sans base. Ici on ne
 * fait que deux choses :
 *
 *  1. **borner** en SQL un SUR-ENSEMBLE de candidats à examiner — jamais
 *     trancher. Une clause `WHERE` qui déciderait serait une seconde écriture
 *     de la règle, libre de diverger de la première sans qu'aucun test ne le
 *     voie ;
 *  2. **appeler** la règle sur chaque ligne.
 *
 * ⚠️ Le sur-ensemble est correct parce que les deux ancres de la règle
 * (`submittedAt` et `lastActivityAt`) sont toujours ≥ `submittedAt` : un
 * dossier déposé il y a moins que le plus court des deux seuils ne peut pas
 * être oublié, quelle que soit son activité.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import {
  ilYAJours,
  joursDepuis,
  motifDOubli,
  MOTIFS_OUBLI_PAR_GRAVITE,
  SEUIL_LE_PLUS_COURT_JOURS,
  SEUIL_SANS_ACTIVITE_JOURS,
  SEUIL_SANS_REPONSE_JOURS,
  type MotifOubli,
} from "@/content/recrutement/oubli";
import { STATUTS_OUVERTS } from "@/content/recrutement/statuts";
import type { JobApplicationStatus } from "../../../prisma/generated/client";

/**
 * Plafond d'examen par passage.
 *
 * Il ne protège pas d'un volume normal — un stock de recrutement ne fait pas
 * cinq cents dossiers ouverts. Il protège du cas où `lastActivityAt` cesserait
 * d'être alimenté : la requête ramènerait alors TOUT le stock ouvert à chaque
 * passage. `plafondAtteint` rend ce cas visible au lieu de le taire, et c'est
 * précisément le symptôme qu'on veut voir.
 */
export const PLAFOND_EXAMEN = 500;

export interface DossierEnSommeil {
  readonly id: string;
  readonly offerTitleSnap: string;
  readonly status: JobApplicationStatus;
  readonly submittedAt: Date;
  readonly motif: MotifOubli;
  /** Jours écoulés depuis l'ancre du motif — l'âge qu'on affiche. */
  readonly jours: number;
  /**
   * 🔴 `null` quand le rôle courant n'a pas le droit d'ouvrir le dossier.
   * Même contrat que `JobApplicationListItem` : le type dit le masquage, une
   * chaîne vide l'aurait caché.
   */
  readonly contactName: string | null;
}

export interface BilanSommeil {
  readonly dossiers: readonly DossierEnSommeil[];
  readonly parMotif: Readonly<Record<MotifOubli, number>>;
  /** Vrai quand l'examen a été tronqué — voir `PLAFOND_EXAMEN`. */
  readonly plafondAtteint: boolean;
}

function sansIdentite(): string | null {
  return null;
}

/**
 * Les dossiers ouverts que plus personne ne fait avancer, les plus vieux
 * d'abord.
 *
 * `role` — et non un booléen déjà tranché : c'est ce fichier qui appelle
 * `peutOuvrirDossierCandidat`, pour la même raison que `reads.ts`. Un `true`
 * calculé chez l'appelant ne peut pas se vérifier ici, et un `true` posé par
 * erreur ne se verrait nulle part.
 */
export async function listerDossiersEnSommeil(
  maintenant: Date,
  role: string | null,
): Promise<BilanSommeil> {
  const bornePlusLarge = ilYAJours(maintenant, SEUIL_LE_PLUS_COURT_JOURS);

  const lignes = await prisma.jobApplication.findMany({
    where: {
      status: { in: [...STATUTS_OUVERTS] },
      submittedAt: { lt: bornePlusLarge },
    },
    // Les plus anciens d'abord : si le plafond tronque, il tronque les moins
    // urgents. Trier par date décroissante aurait fait disparaître exactement
    // les dossiers que cet écran existe pour montrer.
    orderBy: [{ submittedAt: "asc" }],
    take: PLAFOND_EXAMEN,
    select: {
      id: true,
      offerTitleSnap: true,
      status: true,
      submittedAt: true,
      firstResponseAt: true,
      lastActivityAt: true,
      firstName: true,
      lastName: true,
    },
  });

  const ouvert = peutOuvrirDossierCandidat(role);
  const parMotif: Record<MotifOubli, number> = { jamais_repondu: 0, sans_activite: 0 };
  const dossiers: DossierEnSommeil[] = [];

  for (const l of lignes) {
    const motif = motifDOubli(l, maintenant);
    if (motif === null) continue;
    parMotif[motif] += 1;
    const ancre = motif === "jamais_repondu" ? l.submittedAt : (l.lastActivityAt ?? l.submittedAt);
    dossiers.push({
      id: l.id,
      offerTitleSnap: l.offerTitleSnap,
      status: l.status,
      submittedAt: l.submittedAt,
      motif,
      jours: joursDepuis(ancre, maintenant),
      // Le déchiffrement ne doit pas faire tomber l'écran : même repli tolérant
      // que `safeDecrypt` de `reads.ts`, écrit ici parce qu'importer une
      // fonction de la couche console dans la couche serveur inverserait la
      // dépendance.
      contactName: ouvert ? nomLisible(l.firstName, l.lastName) : sansIdentite(),
    });
  }

  // Tri final par gravité, puis par ancienneté. Le tri SQL ne pouvait pas le
  // faire : le motif n'existe qu'après avoir appliqué la règle.
  dossiers.sort((a, b) => {
    const g = MOTIFS_OUBLI_PAR_GRAVITE.indexOf(a.motif) - MOTIFS_OUBLI_PAR_GRAVITE.indexOf(b.motif);
    return g !== 0 ? g : b.jours - a.jours;
  });

  return { dossiers, parMotif, plafondAtteint: lignes.length === PLAFOND_EXAMEN };
}

function nomLisible(prenom: string, nom: string): string {
  const decrypte = (v: string): string => {
    try {
      return decryptPii(v);
    } catch {
      return "[déchiffrement échoué]";
    }
  };
  return `${decrypte(prenom)} ${decrypte(nom)}`.trim();
}

/**
 * Le passage de cron — une alerte par jour, jamais plus.
 *
 * 🔴 AUCUNE IDENTITÉ NE PART SUR TELEGRAM. Le message porte les compteurs, les
 * intitulés d'offre et les âges, puis un lien vers la console. C'est assez pour
 * décider d'agir, et le fil Telegram n'est pas un endroit où l'on maîtrise la
 * durée de conservation d'un nom de candidat. Le nom se lit dans la console,
 * derrière l'habilitation qui existe pour ça.
 *
 * `role: null` est donc DÉLIBÉRÉ et non un oubli : un cron n'a pas de rôle, et
 * `peutOuvrirDossierCandidat(null)` refuse — le masquage tombe tout seul.
 */
export async function signalerDossiersEnSommeil(maintenant: Date): Promise<BilanSommeil> {
  const bilan = await listerDossiersEnSommeil(maintenant, null);
  if (bilan.dossiers.length === 0) return bilan;

  const { notify } = await import("@/server/notifications");
  await notify({
    category: "JOB_APPLICATIONS_STALE",
    payload: {
      seuilSansReponseJours: SEUIL_SANS_REPONSE_JOURS,
      seuilSansActiviteJours: SEUIL_SANS_ACTIVITE_JOURS,
      jamaisRepondu: bilan.parMotif.jamais_repondu,
      sansActivite: bilan.parMotif.sans_activite,
      plafondAtteint: bilan.plafondAtteint,
      // Les cinq plus graves seulement : un message Telegram qui déroule
      // quarante lignes ne se lit pas, et l'écran est à un clic.
      pires: bilan.dossiers.slice(0, 5).map((d) => ({
        offre: d.offerTitleSnap,
        motif: d.motif,
        jours: d.jours,
      })),
    },
    // Un rappel par jour maximum, même si BullMQ rejoue le job.
    dedupKey: `job-applications-stale-${maintenant.toISOString().slice(0, 10)}`,
  });

  return bilan;
}
