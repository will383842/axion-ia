/**
 * Emplacement du lot B6 : bandeau « Client archivé » sous la suppression manuelle.
 * Rend `null` si la fiche n'est pas archivée. Le lien « Sortir des archives » n'est montré qu'au
 * super-administrateur, et l'action revérifie le rôle elle-même.
 */

import { Archive, ArchiveRestore } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { sortirDesArchivesFormAction } from "@/features/dossier-client/fiche/actions-profil";
import { lireProfil } from "@/features/dossier-client/fiche/profil";
import { estSuperAdmin } from "@/server/auth/habilitations";
import type { ContexteFiche } from "./contexte";

export async function archivageFiche(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  let profil: Awaited<ReturnType<typeof lireProfil>>;
  try {
    profil = await lireProfil(prisma, ctx.clientId);
  } catch {
    return (
      <AdminBloc teinte="gris" titre="Archivage" niveau={3}>
        <p>{`Archivage : ${TEXTE_LECTURE_IMPOSSIBLE}`}</p>
      </AdminBloc>
    );
  }
  if (profil.archiveLe === null) return null;
  return (
    <AdminBloc teinte="gris" titre="Client archivé" niveau={3}>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <p className="inline-flex items-center gap-2">
          <Archive aria-hidden className="h-4 w-4" />
          {`Client archivé le ${formatDateFrShort(profil.archiveLe)}`}
          {profil.archiveMotif ? ` (${profil.archiveMotif})` : ""}
        </p>
        {estSuperAdmin(ctx.role) ? (
          <form action={sortirDesArchivesFormAction}>
            <input type="hidden" name="clientId" value={ctx.clientId} />
            <AdminButton type="submit" variant="secondary">
              <ArchiveRestore aria-hidden className="h-4 w-4" />
              Sortir des archives
            </AdminButton>
          </form>
        ) : null}
      </div>
    </AdminBloc>
  );
}
