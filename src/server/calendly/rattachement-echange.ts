/**
 * Rattachement d'un ÉCHANGE à la fiche de la personne — moteur COMMUN, par famille (FAC-7),
 * extrait du rattachement apporteur (2026-09-19).
 *
 * Trois temps, dans cet ordre : (1) l'empreinte de l'adresse de l'invité ; (2) à défaut, un
 * NOM unique parmi les fiches de la famille (adresse relais) ; jamais d'écrasement : la
 * condition « rattachée à rien » est posée DANS la requête d'écriture. Ce qui change d'une
 * famille à l'autre (reconnaître l'échange, trouver la fiche, la colonne écrite) arrive par
 * l'ADAPTATEUR, jamais par une condition ici.
 *
 * Aucune dépendance Next (ni `server-only`, ni `next/*`) : l'enrichissement tourne aussi
 * dans le worker (sondage `refresh.ts`).
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/** La ligne `calendly_events` à rattacher, telle que l'enrichissement la connaît. */
export interface LigneEchange {
  id: string;
  eventTypeName: string | null | undefined;
  typeRendezVous?: string | null | undefined;
  inviteeEmail: string | null | undefined;
  /** Le nom CONFIRMÉ par l'API Calendly — jamais celui de la capture publique. */
  inviteeName?: string | null | undefined;
  linkedSubmissionId: string | null | undefined;
  linkedJobApplicationId: string | null | undefined;
}

export interface AdaptateurRattachement {
  /** L'échange relève-t-il de cette famille ? */
  readonly estEchange: (ligne: LigneEchange) => boolean;
  /** La fiche la plus récente à cette empreinte d'adresse, ou `null`. */
  readonly ficheParEmpreinte: (empreinte: string) => Promise<string | null>;
  /** Les fiches dont le nom correspond (repli « même nom, autre adresse »). */
  readonly fichesParNom: (nom: string | null | undefined) => Promise<string[]>;
  /** La colonne de `calendly_events` que la famille écrit. */
  readonly colonne: "linkedSubmissionId" | "linkedJobApplicationId";
}

export type IssueRattachementEchange =
  | { rattache: true; ficheId: string; parNom?: true }
  | {
      rattache: false;
      motif:
        | "pas_un_echange_de_la_famille"
        | "deja_rattache"
        | "sans_adresse"
        | "aucune_fiche"
        | "rattache_entre_temps";
    };

/**
 * Rattache un échange à la fiche la plus récente de la même personne, dans sa famille.
 * Idempotent ; n'écrit que sur une ligne qui n'est rattachée à rien. Peut lever (base
 * injoignable, clé d'empreinte absente en production) : l'appelant l'enveloppe.
 */
export async function rattacherEchange(
  adaptateur: AdaptateurRattachement,
  ligne: LigneEchange,
): Promise<IssueRattachementEchange> {
  if (!adaptateur.estEchange(ligne)) {
    return { rattache: false, motif: "pas_un_echange_de_la_famille" };
  }
  if (ligne.linkedSubmissionId || ligne.linkedJobApplicationId) {
    return { rattache: false, motif: "deja_rattache" };
  }
  const empreinte = hashEmailForLookup(ligne.inviteeEmail);
  if (!empreinte) return { rattache: false, motif: "sans_adresse" };

  const parAdresse = await adaptateur.ficheParEmpreinte(empreinte);
  let cible: { id: string; parNom: boolean } | null = parAdresse
    ? { id: parAdresse, parNom: false }
    : null;

  // Repli : aucune fiche à cette ADRESSE (adresse relais). On ne rattache que s'il y a
  // EXACTEMENT UNE fiche au nom correspondant : zéro ou plusieurs → rien, la console les
  // PROPOSE et un humain choisit.
  if (!cible) {
    const trouvees = await adaptateur.fichesParNom(ligne.inviteeName);
    const seule = trouvees.length === 1 ? trouvees[0] : undefined;
    if (seule) cible = { id: seule, parNom: true };
  }
  if (!cible) return { rattache: false, motif: "aucune_fiche" };

  const { count } = await prisma.calendlyEvent.updateMany({
    where: { id: ligne.id, linkedSubmissionId: null, linkedJobApplicationId: null },
    data:
      adaptateur.colonne === "linkedSubmissionId"
        ? { linkedSubmissionId: cible.id }
        : { linkedJobApplicationId: cible.id },
  });
  if (count === 0) return { rattache: false, motif: "rattache_entre_temps" };
  return cible.parNom
    ? { rattache: true, ficheId: cible.id, parNom: true }
    : { rattache: true, ficheId: cible.id };
}
