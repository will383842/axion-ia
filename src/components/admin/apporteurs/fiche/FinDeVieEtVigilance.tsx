// Fiche apporteur : cumul vers le seuil de vigilance (5 000 €), résiliation du contrat et
// enregistrement d'une reprise. RENDU SERVEUR, aucun JavaScript client : des formulaires qui
// appellent des actions serveur, la confirmation est une case à cocher obligatoire.

import { AdminCard } from "@/components/admin/ui";
import {
  enregistrerRepriseAction,
  resilierApporteurAction,
} from "@/features/apporteurs-reseau/actions-commissions";
import { euros } from "@/features/apporteurs-reseau/regles";
import type { SoldeNegatif } from "@/features/apporteurs-reseau/solde-negatif";

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
  resiliationNotifiee,
  versees,
  retour,
  erreur,
}: {
  apporteurId: string;
  signe: boolean;
  /** Résiliation déjà notifiée (dates formatées) : remplace le formulaire. */
  resiliationNotifiee?: { notifieeLe: string; effetLe: string } | null | undefined;
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
              Date de l&apos;annulation (remboursement ou avoir)
              <input name="annulationLe" type="date" required className="admin-input" />
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

      {signe && resiliationNotifiee ? (
        <p id="resiliation">
          Résiliation notifiée le {resiliationNotifiee.notifieeLe}, effet le{" "}
          {resiliationNotifiee.effetLe}. Jusqu&apos;à cette date, le contrat reste signé.
        </p>
      ) : signe ? (
        <details id="resiliation">
          <summary className="cursor-pointer font-medium">Résilier le contrat</summary>
          <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            La résiliation se fait en deux temps : on enregistre la notification écrite, puis le
            contrat prend fin à la date d&apos;effet (30 jours après la notification en 11.1, tout
            de suite en 11.2 et 12.5). L&apos;apporteur reçoit un e-mail à chaque temps. À la prise
            d&apos;effet, les attributions en cours prennent fin ; les commandes signées avant
            restent couvertes et les commissions acquises sont facturées et virées comme les autres.
          </p>
          <form
            action={resilierApporteurAction}
            className="flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <label className="flex flex-col gap-1">
              Qui résilie ?
              <select name="initiative" required defaultValue="societe">
                <option value="societe">Axion IA</option>
                <option value="apporteur">L&apos;apporteur, par écrit</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Fondement
              <select name="fondement" required defaultValue="11.1">
                <option value="11.1">
                  11.1 : résiliation avec préavis de 30 jours, sans motif
                </option>
                <option value="11.2">
                  11.2 : inexécution, après mise en demeure (effet immédiat, motif obligatoire)
                </option>
                <option value="12.5">
                  12.5 : fin de plein droit (radiation, décès…) (effet immédiat, motif obligatoire)
                </option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Date de la notification écrite
              <input type="date" name="notifieeLe" required />
            </label>
            <label className="flex flex-col gap-1">
              Date de la mise en demeure (11.2 seulement)
              <input type="date" name="miseEnDemeureLe" />
            </label>
            <label className="flex flex-col gap-1">
              Motif (11.2 et 12.5 seulement, laisser vide en 11.1)
              <textarea name="motif" rows={3} maxLength={1000} />
            </label>
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input type="checkbox" name="confirmer" value="oui" required />
              Je confirme la résiliation de ce contrat.
            </label>
            <div>
              <button type="submit" className="admin-button-secondary">
                Notifier la résiliation
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </AdminCard>
  );
}

/** Art. 12.4 : solde négatif de l'apporteur, et remboursement demandable après douze mois. */
export function SoldeNegatifFiche({ s }: { s: SoldeNegatif }) {
  const date = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-2)] font-semibold">Solde négatif (art. 12.4)</h2>
      <p className="mb-[var(--space-admin-2)]">
        <strong>{euros(s.soldeCents)}</strong> de reprises à imputer, depuis le {date(s.depuis)}. Il
        s&apos;impute de lui-même, par compensation, sur les prochaines commissions.
      </p>
      {s.remboursementDemandable ? (
        <p className="font-semibold" style={{ color: "var(--color-admin-warning)" }}>
          Plus de douze mois sans imputation : vous pouvez en demander le remboursement par écrit,
          avec l&apos;avoir et son décompte, dans la limite de {euros(s.demandableCents)} (plafond :{" "}
          {euros(s.plafondCents)} versés dans les 24 mois précédant la reprise). Rien n&apos;est
          envoyé automatiquement.
        </p>
      ) : (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Remboursement demandable à partir de douze mois sans imputation.
        </p>
      )}
    </AdminCard>
  );
}
