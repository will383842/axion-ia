/**
 * Emplacement du lot B3 : seul ce lot modifie ce fichier.
 * Tâches de la fiche, en haut du Résumé. Rien n'est lu hors `ctx.voitEchanges` ; une lecture en
 * panne se dit « Lecture impossible », jamais « aucune tâche ».
 */

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { lirePersonnesCourtes } from "@/features/dossier-client/queries-rencontres";
import {
  jourDeParis,
  lirePrestationsCourtes,
  lireTachesDeLaFiche,
} from "@/features/dossier-client/fiche/taches";
import { prisma } from "@/lib/prisma";
import { CarteTaches } from "./CarteTaches";
import type { ContexteFiche } from "./contexte";

export async function resumeTaches(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  try {
    const [{ ouvertes, faites }, personnes, prestations] = await Promise.all([
      lireTachesDeLaFiche(prisma, ctx.clientId),
      lirePersonnesCourtes(ctx.clientId),
      lirePrestationsCourtes(prisma, ctx.clientId),
    ]);
    return (
      <CarteTaches
        clientId={ctx.clientId}
        ficheHref={ctx.ficheHref}
        jour={jourDeParis(ctx.maintenant)}
        peutEcrire={ctx.peutEcrire}
        ouvertes={ouvertes}
        faites={faites}
        personnes={personnes}
        prestations={prestations}
      />
    );
  } catch {
    return (
      <AdminBloc teinte="gris" niveau={2} titre="Ce que je dois faire">
        <p role="status" className="text-[length:var(--text-admin-sm)]">
          Tâches : {TEXTE_LECTURE_IMPOSSIBLE}. Rechargez la page.
        </p>
      </AdminBloc>
    );
  }
}
