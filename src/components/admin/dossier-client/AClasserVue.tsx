/**
 * « À classer » : les rendez-vous du dossier client rangés chez aucun client
 * (chantier visio, PR 4 ; plan V-06, V-07b) — un ONGLET de la page Rendez-vous
 * (`?vue=a-classer`), pas une page de plus (cliquet de poids, ADR 0058).
 *
 * Décision A4 : la machine PROPOSE une fiche, Will valide d'un clic, ou ouvre
 * « Après l'appel » pour en choisir une autre ou créer la fiche prospect.
 * Deux listes : les récents (ils font le compteur) et « Historique » — les
 * rendez-vous d'avant la mise en service, ni compteur ni rappel.
 *
 * La page appelante a DÉJÀ consulté le rôle (`peutVoirLesEchanges`, A2).
 */

import Link from "next/link";

import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { AdminEmptyState } from "@/components/admin/ui";
import { rangerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import { lireRencontresAClasser } from "@/features/dossier-client/queries-rencontres";
import { formatDateFrShort } from "@/lib/format-date-fr";

const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

export async function AClasserVue({
  rdvBase,
  historique,
  erreur,
}: {
  rdvBase: string;
  historique: boolean;
  erreur: string | null;
}) {
  const liste = await lireRencontresAClasser(historique);

  return (
    <>
      <AdminFilterTabs
        className="mb-[var(--space-admin-5)]"
        label="Liste"
        current={historique ? "historique" : "recents"}
        options={[
          { value: "recents", label: "Récents", href: `${rdvBase}?vue=a-classer` },
          {
            value: "historique",
            label: "Historique (avant la mise en service)",
            href: `${rdvBase}?vue=a-classer&filtre=historique`,
          },
        ]}
      />
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
          {erreur}
        </p>
      ) : null}
      {liste.length === 0 ? (
        <AdminEmptyState
          title="Rien à classer"
          description={
            historique
              ? "Aucun rendez-vous d'avant la mise en service n'attend."
              : "Tous les rendez-vous récents sont rangés chez un client."
          }
        />
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {liste.map((r) => (
            <li key={r.id} className="admin-card flex flex-col gap-[var(--space-admin-2)]">
              <p className="font-semibold">
                {r.titulaire ?? "Invité à compléter"}
                <span className={`font-normal ${mutedCls}`}>
                  {" "}
                  · {r.titre}
                  {r.debutPrevu ? ` · ${formatDateFrShort(r.debutPrevu)}` : ""}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                {r.clientPropose ? (
                  <form action={rangerRencontreAction}>
                    <input type="hidden" name="rencontreId" value={r.id} />
                    <input type="hidden" name="clientId" value={r.clientPropose.id} />
                    <input type="hidden" name="retour" value="a-classer" />
                    <button type="submit" className="admin-button">
                      Confirmer : {r.clientPropose.raisonSociale}
                    </button>
                  </form>
                ) : (
                  <span className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
                    Aucune fiche proposée
                  </span>
                )}
                <Link href={`${rdvBase}/rencontres/${r.id}?vue=apres-l-appel`} className={lienCls}>
                  Choisir ou créer la fiche →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
