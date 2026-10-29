/**
 * Emplacement du lot B1 : seul ce lot modifie ce fichier.
 * En-tête de la fiche : frise du parcours, carte « Prochaine action », 4 tuiles.
 */

import { lireEnTete } from "@/features/dossier-client/fiche/lire-en-tete";

import { CarteProchaineAction } from "./CarteProchaineAction";
import { lireClient360Cache, type ContexteFiche } from "./contexte";
import { Frise, type EtatEtape } from "./Frise";
import { ONGLET_ACTIVITE_PRET } from "./OngletActivite";
import { TuilesFiche } from "./TuilesFiche";

const PARCOURS = [
  ["prospect", "Prospect"],
  ["devis_envoye", "Devis envoyé"],
  ["client_actif", "Client actif"],
] as const;

const HORS_PARCOURS: Readonly<Record<string, string>> = {
  client_inactif: "Client inactif",
  perdu: "Perdu",
};

/** PUR : les étapes de la frise depuis `client.statut`. */
export function etapesDuParcours(
  statut: string,
): ReadonlyArray<{ libelle: string; etat: EtatEtape }> {
  const rang = PARCOURS.findIndex(([cle]) => cle === statut);
  const etapes = PARCOURS.map(([, libelle], i) => ({
    libelle,
    etat: (rang === -1
      ? "a_venir"
      : i < rang
        ? "fait"
        : i === rang
          ? "courant"
          : "a_venir") as EtatEtape,
  }));
  const hors = HORS_PARCOURS[statut];
  return hors === undefined ? etapes : [...etapes, { libelle: hors, etat: "hors_parcours" }];
}

export async function enTeteFiche(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  const enTete = await lireEnTete(ctx, lireClient360Cache);
  if (enTete === null) return null;
  return (
    <div className="mb-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-4)]">
      {enTete.statut !== "" ? (
        <Frise etiquette="Parcours du client" etapes={etapesDuParcours(enTete.statut)} />
      ) : null}
      <CarteProchaineAction
        tache={enTete.prochaineTache}
        nbEmailsAValider={enTete.nbEmailsAValider}
        qBase={ctx.qBase}
        ficheHref={ctx.ficheHref}
        activitePrete={ONGLET_ACTIVITE_PRET}
      />
      <TuilesFiche enTete={enTete} ficheHref={ctx.ficheHref} qBase={ctx.qBase} />
    </div>
  );
}

/** Vrai quand l'en-tête remplace le bandeau « Où en est ce client ». */
export const EN_TETE_REMPLACE_LE_BANDEAU = true;
