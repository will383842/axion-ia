// Console éditoriale — créer une publication (critère 12 du lot 1).
//
// > « Ajouter une publication : moins de 30 secondes, 5 champs. Le compte, la
// >   date, le format, un titre, le texte. Tout le reste est facultatif. »
// > « Si l'un de ces gestes s'alourdit, le lot est REFUSÉ — quelles que soient
// >   ses fonctionnalités par ailleurs. »
//
// Ce formulaire porte donc CINQ champs et pas un de plus. Pas de pilier, pas
// de série, pas de tags, pas de responsable, pas d'asset : tout cela existe
// dans le modèle et s'ajoute depuis la fiche, après. Toute pression pour
// ajouter un champ ici doit être renvoyée vers la fiche.
//
// Les valeurs par défaut font le reste du travail : le premier compte actif,
// demain, et l'heure la plus fréquente du dossier. Trois champs déjà remplis,
// deux à taper.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import { listerComptesActifs } from "@/server/editorial/publication-queries";
import { creerPublicationFormAction } from "@/server/actions/editorial/formulaires";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NouvellePublicationPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const retour = `${base}/publications/nouvelle`;

  const comptes = await listerComptesActifs();

  const demain = new Date();
  demain.setUTCDate(demain.getUTCDate() + 1);
  const demainIso = demain.toISOString().slice(0, 10);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouvelle publication"
        description="Cinq champs. Le reste s'ajoute depuis la fiche, après."
        actions={
          <AdminButton href={`${base}/publications`} variant="ghost" size="sm">
            Toutes les publications
          </AdminButton>
        }
      />

      {sp.erreur && (
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {sp.erreur}
        </div>
      )}

      <AdminCard>
        {comptes.length === 0 ? (
          <AdminEmptyState
            title="Aucun compte actif"
            description="Une publication se rattache à un compte. Lancez « pnpm editorial:seed » pour créer les onze comptes du plan, ou activez-en un depuis les réglages."
          />
        ) : (
          <form action={creerPublicationFormAction} className="space-y-4">
            <input type="hidden" name="retour" value={retour} />
            <input type="hidden" name="basePublications" value={`${base}/publications`} />

            {/* 1 — le compte */}
            <div>
              <label htmlFor="compteId" className="admin-label">
                Compte
              </label>
              <select id="compteId" name="compteId" required className="admin-input w-full">
                {comptes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* 2 — la date */}
              <div className="min-w-0 flex-1">
                <label htmlFor="datePrevue" className="admin-label">
                  Date
                </label>
                <input
                  id="datePrevue"
                  name="datePrevue"
                  type="date"
                  required
                  defaultValue={demainIso}
                  className="admin-input w-full"
                />
              </div>

              {/* 3 — l'heure */}
              <div className="min-w-0 flex-1">
                <label htmlFor="heurePrevue" className="admin-label">
                  Heure
                </label>
                <input
                  id="heurePrevue"
                  name="heurePrevue"
                  type="time"
                  required
                  // 07:45 est l'heure la plus fréquente du dossier importé :
                  // un défaut qui vient des données, pas d'une préférence.
                  defaultValue="07:45"
                  className="admin-input w-full"
                />
              </div>
            </div>

            {/* 4 — le titre interne */}
            <div>
              <label htmlFor="titreInterne" className="admin-label">
                Titre interne
              </label>
              <input
                id="titreInterne"
                name="titreInterne"
                type="text"
                required
                maxLength={200}
                autoFocus
                placeholder="Pour la retrouver dans une liste — pas le titre du post"
                className="admin-input w-full"
              />
            </div>

            {/* 5 — le corps, facultatif */}
            <div>
              <label htmlFor="corps" className="admin-label">
                Corps <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
              </label>
              <textarea
                id="corps"
                name="corps"
                rows={8}
                maxLength={20_000}
                placeholder="Le texte du post. Vous pourrez l'écrire plus tard."
                className="admin-input w-full"
              />
              <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Une publication qui naît avec un corps est déjà « rédigée ». Sans corps, elle naît «
                idée » — et rien n&apos;est perdu.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="admin-button">
                Créer
              </button>
              <Link href={`${base}/publications`} className="admin-button-ghost">
                Annuler
              </Link>
            </div>
          </form>
        )}
      </AdminCard>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Tags, pilier, série, assets et premier commentaire s&apos;ajoutent depuis la fiche. Les
        demander ici ferait passer ce formulaire de cinq champs à onze — et le critère 12 avec.
      </p>
    </AdminPageShell>
  );
}
