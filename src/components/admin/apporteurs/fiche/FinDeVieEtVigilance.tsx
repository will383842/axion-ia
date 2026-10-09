// Fiche apporteur : cumul vers le seuil de vigilance (5 000 €), résiliation du contrat et
// enregistrement d'une reprise. RENDU SERVEUR, aucun JavaScript client : des formulaires qui
// appellent des actions serveur, la confirmation est une case à cocher obligatoire.

import { AdminCard } from "@/components/admin/ui";
import {
  annulerResiliationAction,
  enregistrerRepriseAction,
  resilierApporteurAction,
  resilierPourManquementAction,
} from "@/features/apporteurs-reseau/actions-commissions";
import { euros } from "@/features/apporteurs-reseau/regles";
import type { SoldeNegatif } from "@/features/apporteurs-reseau/solde-negatif";

export interface VigilanceFiche {
  cumulCents: number;
  seuilCents: number;
  piecesConformes: boolean;
  piecesEnAttente: number;
}

/** Contrat 2.7, art. 11.1 : résiliation notifiée en cours de préavis (dates déjà formatées). */
export interface PreavisFiche {
  par: string;
  notifieeLe: string;
  finLe: string;
  preavisJours: number;
  /** La date de fin est atteinte : la fin s'applique au prochain passage quotidien. */
  echu: boolean;
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
  preavis,
  preavisSociete,
  versees,
  retour,
  erreur,
}: {
  apporteurId: string;
  signe: boolean;
  /** Résiliation notifiée, en cours de préavis ; `null` sinon. */
  preavis?: PreavisFiche | null;
  /** Préavis qu'aurait une résiliation par la Société notifiée aujourd'hui (art. 11.1). */
  preavisSociete?: number;
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

      {signe && preavis ? (
        <div id="resiliation" className="flex flex-col gap-[var(--space-admin-2)]">
          <p className="font-semibold" style={{ color: "var(--color-admin-warning)" }}>
            Résiliation notifiée le {preavis.notifieeLe}, fin du contrat le {preavis.finLe}.
          </p>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {preavis.par === "apporteur" ? "Résiliée par l'apporteur" : "Résiliée par Axion-IA"},
            préavis de {preavis.preavisJours} jours (art. 11.1). D&apos;ici là, le contrat continue
            : déclarations et commissions normales.
            {preavis.echu
              ? " La date de fin est atteinte : la fin s'applique au prochain passage quotidien."
              : ""}
          </p>
          {preavis.echu ? null : (
            <form
              action={annulerResiliationAction}
              className="flex flex-col gap-[var(--space-admin-2)]"
            >
              <input type="hidden" name="apporteurId" value={apporteurId} />
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input type="checkbox" name="confirmer" value="oui" required />
                Je confirme : le contrat continue, l&apos;apporteur en est averti.
              </label>
              <div>
                <button type="submit" className="admin-button-secondary">
                  Annuler la résiliation
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {signe && !preavis ? (
        <details id="resiliation">
          <summary className="cursor-pointer font-medium">
            Résilier le contrat (avec préavis)
          </summary>
          <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Le contrat ne s&apos;arrête pas le jour du clic : il prend fin à l&apos;issue du préavis
            (art. 11.1)
            {preavisSociete ? `, soit ${preavisSociete} jours si Axion-IA résilie aujourd'hui` : ""}
            , 30 jours si l&apos;apporteur résilie. D&apos;ici là il continue normalement ; à la
            date, les attributions en cours prennent fin (les commandes déjà signées restent
            couvertes), le lien personnel est révoqué et les rappels s&apos;arrêtent. Les
            commissions acquises restent dues. L&apos;apporteur reçoit un e-mail avec la date de
            fin.
          </p>
          <form
            action={resilierApporteurAction}
            className="flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <fieldset className="flex flex-col gap-1">
              <legend>Qui résilie ?</legend>
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input type="radio" name="par" value="societe" required />
                Axion-IA
              </label>
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input type="radio" name="par" value="apporteur" required />
                L&apos;apporteur (résiliation reçue par écrit aujourd&apos;hui)
              </label>
            </fieldset>
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

      {signe ? (
        <details id="resiliation-manquement" className="mt-[var(--space-admin-3)]">
          <summary className="cursor-pointer font-medium">
            Résilier sans préavis pour manquement (art. 11.2)
          </summary>
          <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Fin IMMÉDIATE, réservée à un manquement de l&apos;apporteur (articles listés à
            l&apos;art. 11.2), après mise en demeure restée sans effet quinze jours (sauf manquement
            irrémédiable). Le motif est envoyé à l&apos;apporteur.
          </p>
          <form
            action={resilierPourManquementAction}
            className="flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <label className="flex flex-col gap-1">
              Motif (envoyé à l&apos;apporteur)
              <textarea
                name="motif"
                required
                minLength={10}
                maxLength={1000}
                rows={3}
                className="admin-input"
              />
            </label>
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input type="checkbox" name="confirmer" value="oui" required />
              Je confirme : la mise en demeure est restée sans effet, ou le manquement est
              irrémédiable.
            </label>
            <div>
              <button type="submit" className="admin-button-secondary">
                Résilier sans préavis
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
