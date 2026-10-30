/**
 * Emplacement du lot B4 : seul ce lot modifie ce fichier.
 * Notes datées et chiffrées dans l'onglet Résumé. Rien n'est lu hors `voitEchanges`.
 */

import { prisma } from "@/lib/prisma";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { lireNotes, type BaseNotes } from "@/features/dossier-client/fiche/notes";
import { CarteNotes, type PrestationChoisissable } from "./CarteNotes";
import type { ContexteFiche } from "./contexte";

export async function resumeNotes(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  const lecture = await lireNotes(prisma as unknown as BaseNotes, ctx.clientId);
  if (!lecture.ok) {
    return (
      <section data-notes-illisibles>
        <h2>Notes</h2>
        <p>{`Notes : ${TEXTE_LECTURE_IMPOSSIBLE}`}</p>
      </section>
    );
  }
  let prestations: PrestationChoisissable[] = [];
  if (ctx.peutEcrire) {
    try {
      prestations = await prisma.projet.findMany({
        where: { clientId: ctx.clientId, fusionneDansId: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, titre: true },
      });
    } catch {
      prestations = [];
    }
  }
  return (
    <CarteNotes
      clientId={ctx.clientId}
      notes={lecture.notes}
      total={lecture.total}
      prestations={prestations}
      peutEcrire={ctx.peutEcrire}
    />
  );
}
