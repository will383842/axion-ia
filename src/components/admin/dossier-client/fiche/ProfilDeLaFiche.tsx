/**
 * Emplacement du lot B6 : responsable du client, étiquettes, archivage. Posé sous le formulaire
 * « Modifier la fiche ». Étiquettes et responsable ne s'affichent PAS dans l'en-tête de la fiche.
 *
 * La page « Modifier » est ouverte à l'écriture ; ce bloc relit lui-même le rôle : sans l'accès
 * au dossier, rien n'est lu ; l'archivage n'est proposé qu'au super-administrateur.
 */

import { Archive, ArchiveRestore, Tag, UserRound, X } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";
import {
  ajouterEtiquetteAction,
  archiverAction,
  definirResponsableAction,
  desarchiverAction,
  retirerEtiquetteAction,
} from "@/features/dossier-client/fiche/actions-profil";
import { lireEtiquettes, ETIQUETTE_MAX } from "@/features/dossier-client/fiche/etiquettes";
import { lireProfil, MOTIF_MAX, RESPONSABLE_MAX } from "@/features/dossier-client/fiche/profil";
import { estSuperAdmin } from "@/server/auth/habilitations";
import { FormulaireProfil } from "./FormulaireProfil";

export async function profilDeLaFiche(clientId: string): Promise<React.ReactElement | null> {
  // Rôle revérifié AVANT toute lecture du dossier.
  const session = await auth();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  if (!peutVoirLesEchanges(role)) return null;
  const superAdmin = estSuperAdmin(role);

  const [profil, etiquettes] = await Promise.all([
    lireProfil(prisma, clientId).catch(() => null),
    lireEtiquettes(prisma, clientId).catch(() => null),
  ]);

  const cachee = <input type="hidden" name="clientId" value={clientId} />;
  const champCls = "admin-input";

  return (
    <div className="mt-[var(--space-admin-6)] space-y-[var(--space-admin-5)]">
      <AdminBloc teinte="gris" titre="Responsable du client">
        {profil === null ? (
          <p>{`Responsable : ${TEXTE_LECTURE_IMPOSSIBLE}`}</p>
        ) : (
          <FormulaireProfil
            action={definirResponsableAction}
            className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
          >
            {cachee}
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-[length:var(--text-admin-sm)]">
              <span className="inline-flex items-center gap-2">
                <UserRound aria-hidden className="h-4 w-4" />
                Responsable (texte court)
              </span>
              <input
                type="text"
                name="responsable"
                defaultValue={profil.responsable ?? ""}
                maxLength={RESPONSABLE_MAX}
                className={champCls}
              />
            </label>
            <AdminButton type="submit" variant="secondary">
              Enregistrer le responsable
            </AdminButton>
          </FormulaireProfil>
        )}
      </AdminBloc>

      <AdminBloc teinte="gris" titre="Étiquettes">
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Étiquettes propres à la console, non synchronisées.
        </p>
        {etiquettes === null ? (
          <p>{`Étiquettes : ${TEXTE_LECTURE_IMPOSSIBLE}`}</p>
        ) : (
          <>
            {etiquettes.length === 0 ? (
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
                Aucune étiquette pour le moment.
              </p>
            ) : (
              <ul className="mb-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
                {etiquettes.map((e) => (
                  <li key={e.id}>
                    <FormulaireProfil
                      action={retirerEtiquetteAction}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-admin-border)] px-3 text-[length:var(--text-admin-sm)]"
                    >
                      {cachee}
                      <input type="hidden" name="etiquetteId" value={e.id} />
                      <Tag aria-hidden className="h-4 w-4" />
                      <span>{e.libelle}</span>
                      <button
                        type="submit"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1"
                        aria-label={`Retirer l'étiquette ${e.libelle}`}
                      >
                        <X aria-hidden className="h-4 w-4" />
                        <span>Retirer</span>
                      </button>
                    </FormulaireProfil>
                  </li>
                ))}
              </ul>
            )}
            <FormulaireProfil
              action={ajouterEtiquetteAction}
              className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
            >
              {cachee}
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-[length:var(--text-admin-sm)]">
                <span>Nouvelle étiquette</span>
                <input
                  type="text"
                  name="libelle"
                  maxLength={ETIQUETTE_MAX}
                  required
                  className={champCls}
                />
              </label>
              <AdminButton type="submit" variant="secondary">
                {"Ajouter l'étiquette"}
              </AdminButton>
            </FormulaireProfil>
          </>
        )}
      </AdminBloc>

      {superAdmin ? (
        <AdminBloc teinte="gris" titre="Archiver ce client">
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            {
              "Rien n'est effacé : la fiche est seulement mise de côté. La suppression définitive n'est pas proposée ici."
            }
          </p>
          {profil === null ? (
            <p>{`Archivage : ${TEXTE_LECTURE_IMPOSSIBLE}`}</p>
          ) : profil.archiveLe !== null ? (
            <FormulaireProfil
              action={desarchiverAction}
              className="flex flex-wrap items-center gap-[var(--space-admin-3)]"
            >
              {cachee}
              <p className="inline-flex items-center gap-2 text-[length:var(--text-admin-sm)]">
                <Archive aria-hidden className="h-4 w-4" />
                {`Archivé le ${formatDateFrShort(profil.archiveLe)}`}
                {profil.archiveMotif ? ` (${profil.archiveMotif})` : ""}
              </p>
              <AdminButton type="submit" variant="secondary">
                <ArchiveRestore aria-hidden className="h-4 w-4" />
                Sortir des archives
              </AdminButton>
            </FormulaireProfil>
          ) : (
            <FormulaireProfil
              action={archiverAction}
              className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
            >
              {cachee}
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-[length:var(--text-admin-sm)]">
                <span>Motif (facultatif)</span>
                <input type="text" name="motif" maxLength={MOTIF_MAX} className={champCls} />
              </label>
              <AdminButton type="submit" variant="secondary">
                <Archive aria-hidden className="h-4 w-4" />
                Archiver ce client
              </AdminButton>
            </FormulaireProfil>
          )}
        </AdminBloc>
      ) : null}
    </div>
  );
}
