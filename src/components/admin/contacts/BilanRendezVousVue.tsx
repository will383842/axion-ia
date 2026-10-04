// « Ce que rapporte chaque rendez-vous » — la vue (2026-10-04, lot L5b).
//
// Une carte par type (Diagnostic IA, Échange projet, Salon ; « Autre » s'il y
// en a), ses chiffres en tête, puis ses emplacements du plus au moins réservé.
// Les apporteurs dans une carte à part : ce ne sont pas des ventes.
// Composant SERVEUR, aucun JavaScript ajouté à la console.

import { PastilleTypeRdv } from "@/components/admin/contacts/PastilleTypeRdv";
import { LIBELLE_TYPE_RDV } from "@/features/admin-rendezvous/type-rdv";
import type {
  BilanRendezVous,
  CompteursBilan,
} from "@/features/admin-rendezvous/bilan-rendez-vous";

const carteCls =
  "rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const thCls =
  "px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-right text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]";
const tdCls = "px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-right tabular-nums";

/** Les colonnes, dans l'ordre. */
const COLONNES: ReadonlyArray<{ cle: keyof CompteursBilan; libelle: string }> = [
  { cle: "reserves", libelle: "Réservés" },
  { cle: "honores", libelle: "Honorés" },
  { cle: "absents", libelle: "Absents" },
  { cle: "annules", libelle: "Annulés" },
  { cle: "fiches", libelle: "Rangés sur une fiche" },
  { cle: "clients", libelle: "Clients" },
];

/** Les chiffres d'en-tête d'une carte. */
function Chiffres({
  c,
  colonnes,
}: {
  c: CompteursBilan;
  colonnes: ReadonlyArray<{ cle: keyof CompteursBilan; libelle: string }>;
}) {
  return (
    <dl className="grid grid-cols-3 gap-[var(--space-admin-3)] sm:grid-cols-6">
      {colonnes.map(({ cle, libelle }) => (
        <div key={cle}>
          <dt className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>{libelle}</dt>
          <dd className="text-[length:var(--text-admin-lg)] font-semibold tabular-nums">
            {c[cle]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BilanRendezVousVue({
  bilan,
  jours,
}: {
  bilan: BilanRendezVous;
  jours: number;
}): React.ReactElement {
  return (
    <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-4)]">
      {bilan.types.map((t) => (
        <section key={t.type} className={carteCls} aria-label={LIBELLE_TYPE_RDV[t.type]}>
          <div className="mb-[var(--space-admin-3)] flex items-center justify-between gap-2">
            <PastilleTypeRdv type={t.type} />
            <span className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>{jours} jours</span>
          </div>
          <Chiffres c={t.total} colonnes={COLONNES} />
          {t.emplacements.length > 0 ? (
            <div className="mt-[var(--space-admin-4)] overflow-x-auto">
              <table className="w-full min-w-[32rem] text-[length:var(--text-admin-sm)]">
                <thead>
                  <tr className="border-b border-[color:var(--color-admin-border)]">
                    <th className={`${thCls} text-left`}>Bouton</th>
                    {COLONNES.map((col) => (
                      <th key={col.cle} className={thCls}>
                        {col.libelle}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.emplacements.map((e) => (
                    <tr
                      key={e.cle ?? "-"}
                      className="border-b border-[color:var(--color-admin-border)] last:border-0"
                    >
                      <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                        <span title={e.cle ?? undefined}>{e.libelle}</span>
                      </td>
                      {COLONNES.map((col) => (
                        <td key={col.cle} className={tdCls}>
                          {e.compteurs[col.cle]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              className={`mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${mutedCls}`}
            >
              Aucune réservation sur la période.
            </p>
          )}
        </section>
      ))}

      <section className={carteCls} aria-label={LIBELLE_TYPE_RDV.apporteur}>
        <div className="mb-[var(--space-admin-3)]">
          <PastilleTypeRdv type="apporteur" />
        </div>
        <Chiffres c={bilan.apporteur} colonnes={COLONNES.slice(0, 4)} />
      </section>

      <p className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>
        Rangés sur une fiche et Clients : rendez-vous rangés depuis « Après l&apos;appel ».
      </p>
    </div>
  );
}
