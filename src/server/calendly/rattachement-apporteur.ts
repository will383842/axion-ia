// Rattachement automatique d'un échange apporteur à son dossier (2026-09-19).
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// Mesuré en production le 19/09 (mesure R5) : 37 rendez-vous, 37 rattachés à
// RIEN. Le lien `calendly_events.linked_submission_id` n'était posé qu'à la
// main, en recopiant un UUID dans la fiche — geste que personne ne fait. Un
// candidat apporteur qui réservait l'échange de 15 minutes restait donc
// invisible depuis son dossier.
//
// ── La règle ──────────────────────────────────────────────────────────────
// Juste après l'enrichissement Calendly (le moment où l'adresse de l'invité
// devient connue), SI :
//   · le type d'événement est un échange apporteur (`estRendezVousApporteur`) ;
//   · la ligne n'est rattachée à RIEN — ni demande (`linked_submission_id`), ni
//     candidature emploi (`linked_job_application_id`) ;
// ALORS on cherche, par l'empreinte de l'adresse, la demande NON SUPPRIMÉE la
// plus récente qui est un dossier apporteur, et on la rattache.
//
// 🔴 ON N'ÉCRASE JAMAIS UN RATTACHEMENT. Un lien posé à la main — ou vers une
// candidature emploi — est une décision humaine ; le déplacer en silence ferait
// disparaître une ligne de l'historique d'un dossier sans que personne ne l'ait
// demandé. La condition « les deux colonnes sont vides » est posée DANS la
// requête d'écriture (`updateMany … where … null`), pas seulement lue avant :
// une saisie manuelle arrivée entre la lecture et l'écriture gagne toujours.
//
// Aucune dépendance Next (ni `server-only`, ni `next/*`) : l'enrichissement
// tourne aussi dans le worker (sondage `refresh.ts`).

import { prisma } from "@/lib/prisma";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { decryptPii } from "@/lib/pii-crypto";
import { motsDuNom, nomCorrespond } from "@/lib/calendly/nom-fiche";
import { estRendezVousApporteur } from "./appel-apporteur";
import {
  rattacherEchange,
  type AdaptateurRattachement,
  type LigneEchange,
} from "./rattachement-echange";

/** Combien de dossiers apporteur on relit pour chercher un nom (repli). */
const PLAFOND_LECTURE_NOMS = 600;

/** La ligne à rattacher (la forme commune, `LigneEchange`). */
export interface LigneARattacher extends LigneEchange {
  id: string;
  eventTypeName: string | null | undefined;
  /**
   * Le type classé (2026-10-04), quand l'appelant le connaît. Double verrou :
   * classé « apporteur » OU nommé apporteur (`estRendezVousApporteur`).
   */
  typeRendezVous?: string | null | undefined;
  inviteeEmail: string | null | undefined;
  /**
   * Le nom CONFIRMÉ par l'API Calendly — jamais celui de la capture publique.
   * Sert au repli « même nom, autre adresse » (adresse relais Indeed).
   */
  inviteeName?: string | null | undefined;
  linkedSubmissionId: string | null | undefined;
  linkedJobApplicationId: string | null | undefined;
}

/**
 * Les fiches apporteur (non supprimées) dont le NOM correspond à celui confirmé par
 * Calendly — repli « même nom, autre adresse » (adresse relais Indeed). Lecture seule.
 */
export async function fichesApporteurAuNom(nom: string | null | undefined): Promise<string[]> {
  if (motsDuNom(nom).length === 0) return [];
  return fichesAuNomDans(await chargerFichesPourNoms(), nom);
}

export interface FichePourNom {
  id: string;
  nom: string | null;
  email: string | null;
}

/**
 * Les fiches apporteur lues UNE fois (bornées à `PLAFOND_LECTURE_NOMS`), déchiffrées : un
 * passage qui compare plusieurs noms (le rattrapage) ne relit pas la table à chaque ligne.
 */
export async function chargerFichesPourNoms(): Promise<FichePourNom[]> {
  const lignes = await prisma.submission.findMany({
    where: { deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
    orderBy: { submittedAt: "desc" },
    take: PLAFOND_LECTURE_NOMS,
    select: { id: true, details: true, contactName: true, contactEmail: true },
  });
  const clair = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return decryptPii(v);
    } catch {
      return null;
    }
  };
  return lignes
    .filter((l) => estApporteur(l.details))
    .map((l) => ({ id: l.id, nom: clair(l.contactName), email: clair(l.contactEmail) }));
}

/** Les fiches de `liste` dont le nom correspond (vide si le nom ne suffit pas à chercher). */
export function fichesAuNomDans(
  liste: readonly FichePourNom[],
  nom: string | null | undefined,
): string[] {
  const mots = motsDuNom(nom);
  if (mots.length === 0) return [];
  return liste.filter((f) => nomCorrespond(mots, f.nom, f.email)).map((f) => f.id);
}

export type IssueRattachement =
  | { rattache: true; submissionId: string; parNom?: true }
  | {
      rattache: false;
      motif:
        | "pas_un_echange_apporteur"
        | "deja_rattache"
        | "sans_adresse"
        | "aucun_dossier_apporteur"
        | "rattache_entre_temps";
    };

/**
 * La famille `apporteur` du moteur commun (FAC-7) : un échange apporteur, et la demande
 * (`Submission`) apporteur la plus récente de la personne.
 */
export const ADAPTATEUR_APPORTEUR: AdaptateurRattachement = {
  estEchange: (ligne) => estRendezVousApporteur(ligne),
  async ficheParEmpreinte(empreinte) {
    const dossier = await prisma.submission.findFirst({
      where: { contactEmailHash: empreinte, deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
      orderBy: { submittedAt: "desc" },
      select: { id: true, details: true },
    });
    // Double contrôle EN MÉMOIRE : la clause JSON fait le tri en base, le
    // prédicat pur fait foi. Si les deux divergeaient un jour, on préfère ne rien
    // rattacher plutôt que rattacher un client à un échange apporteur.
    return dossier && estApporteur(dossier.details) ? dossier.id : null;
  },
  fichesParNom: (nom) => fichesApporteurAuNom(nom),
  colonne: "linkedSubmissionId",
};

/**
 * Rattache un échange apporteur au dossier apporteur le plus récent de la même
 * personne. Idempotent ; n'écrit que sur une ligne qui n'est rattachée à rien.
 *
 * Peut lever (base injoignable, clé d'empreinte absente en production) :
 * l'appelant l'enveloppe, un rattachement raté ne doit jamais faire échouer
 * l'enrichissement.
 */
export async function rattacherEchangeApporteur(
  ligne: LigneARattacher,
): Promise<IssueRattachement> {
  const r = await rattacherEchange(ADAPTATEUR_APPORTEUR, ligne);
  if (r.rattache) {
    return r.parNom
      ? { rattache: true, submissionId: r.ficheId, parNom: true }
      : { rattache: true, submissionId: r.ficheId };
  }
  const motif =
    r.motif === "pas_un_echange_de_la_famille"
      ? "pas_un_echange_apporteur"
      : r.motif === "aucune_fiche"
        ? "aucun_dossier_apporteur"
        : r.motif;
  return { rattache: false, motif };
}
