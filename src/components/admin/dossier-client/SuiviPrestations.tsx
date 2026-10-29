// « Ce que le client a pris » : le suivi des prestations d'une fiche (étape 3, 2026-10-26).
// Composant SERVEUR sans JavaScript. L'enregistrement est un clic de Will ; rien n'est supprimé.

import Link from "next/link";

import { enregistrerSuiviPrestationAction } from "@/features/dossier-client/actions-prestations";
import {
  centimesEnEuros,
  ETAPES_PRESTATION,
  LIBELLE_ETAPE_PRESTATION,
  LIBELLE_TYPE_PRESTATION,
  TYPES_PRESTATION,
} from "@/features/dossier-client/prestations";
import type { PrestationSuivie } from "@/features/dossier-client/suivi-prestations";

const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]";

export function SuiviPrestations({
  clientId,
  prestations,
  ficheHref,
  message,
  erreur,
}: {
  clientId: string;
  prestations: ReadonlyArray<PrestationSuivie>;
  ficheHref: string;
  message: string | null;
  erreur: string | null;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="ce-que-le-client-a-pris"
      data-bloc="suivi-prestations"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="ce-que-le-client-a-pris"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Ce que le client a pris
      </h2>
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status" className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          {message}
        </p>
      ) : null}
      {prestations.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune prestation pour l&apos;instant. Créez-la plus bas, puis dites ici ce que le client
          a pris.
        </p>
      ) : (
        <ul className="space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
          {prestations.map((p) => (
            <li key={p.projetId}>
              <p className="mb-[var(--space-admin-2)]">
                <Link
                  href={`${ficheHref}/projets/${p.projetId}`}
                  className="font-medium text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  {p.titre}
                </Link>{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {p.numero} ·{" "}
                  {p.type === null ? "type à choisir" : LIBELLE_TYPE_PRESTATION[p.type]} ·{" "}
                  {LIBELLE_ETAPE_PRESTATION[p.etape]}
                  {p.etapeForcee ? " (posée à la main)" : " (calculée)"}
                </span>
              </p>
              <form
                action={enregistrerSuiviPrestationAction}
                className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
              >
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="projetId" value={p.projetId} />
                <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                  Type
                  <select name="type" defaultValue={p.type ?? ""} required className={inputCls}>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {TYPES_PRESTATION.map((t) => (
                      <option key={t} value={t}>
                        {LIBELLE_TYPE_PRESTATION[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                  Étape
                  <select
                    name="etape"
                    defaultValue={p.etapeForcee ? p.etape : ""}
                    className={inputCls}
                  >
                    <option value="">Calculée</option>
                    {ETAPES_PRESTATION.map((e) => (
                      <option key={e} value={e}>
                        {LIBELLE_ETAPE_PRESTATION[e]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                  Montant HT (€, reste dans la console)
                  <input
                    name="montant"
                    inputMode="decimal"
                    defaultValue={centimesEnEuros(p.montantCents)}
                    placeholder="Facultatif"
                    className={inputCls}
                  />
                </label>
                <button type="submit" className="admin-button-secondary">
                  Enregistrer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
