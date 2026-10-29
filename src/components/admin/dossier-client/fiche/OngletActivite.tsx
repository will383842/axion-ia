/**
 * Emplacement du lot B2 : seul ce lot modifie ce fichier.
 * Onglet Activité : UNE chronologie (le plus récent en haut, regroupée par jour), filtrée par
 * lien `?filtre=`. Lecture seule : rien n'est écrit, aucun e-mail n'est envoyé.
 */

import type { ContexteFiche } from "./contexte";
import { Chronologie } from "./Chronologie";
import { FiltresActivite } from "./FiltresActivite";
import { lireChronologie } from "@/features/dossier-client/fiche/lire-chronologie";
import {
  compterParFiltre,
  filtrer,
  grouperParJour,
  lireFiltre,
} from "@/features/dossier-client/fiche/chronologie";

export async function ongletActivite(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  const filtre = lireFiltre(ctx.sp["filtre"]);
  const { evenements, sourcesEnPanne } = await lireChronologie(
    ctx.clientId,
    ctx.adminPrefix,
    ctx.maintenant,
  );
  const jours = grouperParJour(filtrer(evenements, filtre), ctx.maintenant);
  return (
    <section aria-labelledby="activite-titre" className="admin-carte">
      <h2 id="activite-titre" className="admin-carte-titre mb-[var(--space-admin-3)]">
        Activité
      </h2>
      <FiltresActivite
        ficheHref={ctx.ficheHref}
        actif={filtre}
        compteurs={compterParFiltre(evenements)}
      />
      <Chronologie jours={jours} sourcesEnPanne={sourcesEnPanne} />
    </section>
  );
}

/** Vrai quand l'onglet Activité est prêt à être affiché. */
export const ONGLET_ACTIVITE_PRET = true;
