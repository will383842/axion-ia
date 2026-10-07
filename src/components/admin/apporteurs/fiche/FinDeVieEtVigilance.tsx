// Fiche apporteur : cumul vers le seuil de vigilance (5 000 €), résiliation du contrat et
// enregistrement d'une reprise. RENDU SERVEUR, aucun JavaScript client : des formulaires qui
// appellent des actions serveur, la confirmation est une case à cocher obligatoire.

import { AdminCard } from "@/components/admin/ui";
import {
  enregistrerRepriseAction,
  resilierApporteurAction,
} from "@/features/apporteurs-reseau/actions-commissions";
import { euros } from "@/features/apporteurs-reseau/regles";

export interface VigilanceFiche {
  cumulCents: number;
  seuilCents: number;
  piecesConformes: boolean;
  piecesEnAttente: number;
}

export interface CommissionVerseeFiche {
  id: string;
  libelle: string;
  montantCents: number;
}

export function CumulVigilance({ v }: { v: VigilanceFiche }) {
  const pct = Math.min(100, Math.round((v.cumulCents / v.seuilCents) * 100));
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-2)] font-semibold">Cumul vers {euros(v.seuilCents)}</h2>
      <p className="mb-[var(--space-admin-2)]">
        <strong>{euros(v.cumulCents)}</strong> sur {euros(v.seuilCents)} ({pct} %)
      </p>
      <progress
        value={v.cumulCents}
        max={v.seuilCents}
        aria-label={`Cumul des commissions : ${pct} % du seuil de vigilance`}
        className="mb-[var(--space-admin-2)] h-2 w-full"
      />
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {v.piecesConformes
          ? "Attestation URSSAF et extrait d'immatriculation conformes : aucun blocage."
          : v.cumulCents >= v.seuilCents
            ? "Seuil atteint : les commissions attendent l'attestation URSSAF et l'extrait d'immatriculation."
            : "Au-delà du seuil, l'attestation URSSAF et l'extrait d'immatriculation sont exigés."}
        {v.piecesEnAttente > 0
          ? ` ${v.piecesEnAttente} pièce(s) déposée(s), à vérifier ci-dessus.`
          : ""}
      </p>
    </AdminCard>
  );
}

export function FinDeVie({
  apporteurId,
  signe,
  versees,
  retour,
  erreur,
}: {
  apporteurId: string;
  signe: boolean;
  versees: readonly CommissionVerseeFiche[];
  retour?: string | undefined;
  erreur?: string | undefined;
}) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">Fin de contrat et reprise</h2>
      {retour ? (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-success)]"
        >
          {retour}
        </p>
      ) : null}
      {erreur ? (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-destructive)]"
        >
          {erreur}
        </p>
      ) : null}

      {versees.length > 0 ? (
        <details className="mb-[var(--space-admin-3)]">
          <summary className="cursor-pointer font-medium">Enregistrer une reprise</summary>
          <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Après un avoir ou un remboursement qui suit un versement (art. 4.5) : une ligne
            négative, déduite de la prochaine autofacture. La ligne d&apos;origine est conservée.
          </p>
          <form
            action={enregistrerRepriseAction}
            className="flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <label className="flex flex-col gap-1">
              Commission versée concernée
              <select name="commissionId" required className="admin-input" defaultValue="">
                <option value="" disabled>
                  Choisir…
                </option>
                {versees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle} : {euros(c.montantCents)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Montant à reprendre (en euros)
              <input
                name="montant"
                required
                inputMode="decimal"
                placeholder="150,50"
                className="admin-input"
              />
            </label>
            <label className="flex flex-col gap-1">
              Motif
              <input name="motif" required maxLength={500} className="admin-input" />
            </label>
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input type="checkbox" name="confirmer" value="oui" required />
              Je confirme : l&apos;encaissement a été restitué au client.
            </label>
            <div>
              <button type="submit" className="admin-button-secondary">
                Enregistrer la reprise
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {signe ? (
        <details>
          <summary className="cursor-pointer font-medium">Résilier le contrat</summary>
          <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Les attributions en cours prennent fin (les commandes déjà signées restent couvertes),
            le lien personnel est révoqué et les rappels s&apos;arrêtent. Les commissions déjà
            acquises restent dues : elles sont facturées et virées comme les autres.
          </p>
          <form
            action={resilierApporteurAction}
            className="flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input type="checkbox" name="confirmer" value="oui" required />
              Je confirme la résiliation de ce contrat.
            </label>
            <div>
              <button type="submit" className="admin-button-secondary">
                Résilier
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </AdminCard>
  );
}
