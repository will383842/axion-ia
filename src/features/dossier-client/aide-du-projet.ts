/**
 * Le CHARGEUR de l'aide « Ce que le client a dit » pour un devis ou une vente
 * ouverts depuis un PROJET (`?clientId=…&projetId=…`) — chantier visio, PR 7.
 *
 * Un seul endroit pour les deux pages (`qualiopi/devis/new`,
 * `qualiopi/vente/new`) : la validation de l'identifiant, la garde A2, la
 * recherche du projet chez CE client, la consolidation et le filtre des
 * citations.
 *
 *   · rôle NON habilité (`peutVoirLesEchanges`) : rien n'est lu du dossier ;
 *     le lien au projet est gardé (l'action de devis le revérifie : même
 *     client, non fusionné) ;
 *   · rôle habilité : le projet doit exister chez ce client, sinon aucun lien ;
 *     l'aide est calculée, en lecture seule — le devis, lui, s'ouvre VIDE
 *     (décision de Will du 29/09).
 *
 * Garde : `l-aide-du-projet-ne-lit-rien-pour-un-role-non-habilite.spec.ts`.
 */

import { isUuid } from "@/lib/is-uuid";
import { peutVoirLesEchanges } from "./acces";
import { aideAuDevis, type AideAuDevis } from "./aide-au-devis";
import { consoliderFaits } from "./consolider-faits";
import { lireCitationsDesFaits, lireFaitsDuClient, lireProjetsDuClient } from "./queries";

export interface AideDuProjet {
  /** Le projet transmis au formulaire (lien), ou `null`. */
  readonly projetId: string | null;
  /**
   * L'aide et le titre du projet — rôles habilités seulement. `titre: null` :
   * devis sans projet, la partie entreprise seule (m-8).
   */
  readonly aide: { readonly aide: AideAuDevis; readonly titre: string | null } | null;
}

/** Les lectures (injectées par les tests). */
export interface LecteursAide {
  readonly projets: typeof lireProjetsDuClient;
  readonly faits: typeof lireFaitsDuClient;
  readonly citations: typeof lireCitationsDesFaits;
}

const LECTEURS: LecteursAide = {
  projets: lireProjetsDuClient,
  faits: lireFaitsDuClient,
  citations: lireCitationsDesFaits,
};

export async function chargerAideDuProjet(
  a: {
    readonly role: string | null | undefined;
    /** Le client déjà reconnu par la page (client CRM réel), ou `undefined`. */
    readonly clientId: string | undefined;
    /** Le `projetId` brut de l'adresse. */
    readonly projetId: string | undefined;
    readonly maintenant?: Date;
  },
  lire: LecteursAide = LECTEURS,
): Promise<AideDuProjet> {
  if (a.clientId === undefined) return { projetId: null, aide: null };
  // m-8 : sans projet (« Aucun projet » dans « Après l'appel »), la partie entreprise.
  if (a.projetId === undefined || a.projetId === "") {
    return { projetId: null, aide: await aideSansProjet(a.clientId, a, lire) };
  }
  if (!isUuid(a.projetId)) return { projetId: null, aide: null };
  // ⛔ Garde A2 AVANT toute lecture du dossier.
  if (!peutVoirLesEchanges(a.role)) return { projetId: a.projetId, aide: null };
  const projets = await lire.projets(a.clientId);
  const projet = projets.find((p) => p.id === a.projetId);
  if (projet === undefined) return { projetId: null, aide: null };
  const faits = await lire.faits(a.clientId);
  const maintenant = a.maintenant ?? new Date();
  const idsValides = faits.filter((f) => f.statut === "valide").map((f) => f.id);
  return {
    projetId: projet.id,
    aide: {
      titre: projet.titre,
      aide: aideAuDevis({
        consolidation: consoliderFaits(faits, projets, maintenant),
        projetId: projet.id,
        citations: await lire.citations(idsValides),
        role: a.role,
        maintenant,
      }),
    },
  };
}

/** La partie ENTREPRISE de l'aide, pour un devis sans projet ; `null` si rien n'est validé. */
async function aideSansProjet(
  clientId: string,
  a: { readonly role: string | null | undefined; readonly maintenant?: Date },
  lire: LecteursAide,
): Promise<{ readonly aide: AideAuDevis; readonly titre: null } | null> {
  // ⛔ Garde A2 AVANT toute lecture du dossier.
  if (!peutVoirLesEchanges(a.role)) return null;
  const [projets, faits] = await Promise.all([lire.projets(clientId), lire.faits(clientId)]);
  const maintenant = a.maintenant ?? new Date();
  const idsValides = faits.filter((f) => f.statut === "valide").map((f) => f.id);
  const aide = aideAuDevis({
    consolidation: consoliderFaits(faits, projets, maintenant),
    projetId: null,
    citations: await lire.citations(idsValides),
    role: a.role,
    maintenant,
  });
  return aide.vide ? null : { aide, titre: null };
}
