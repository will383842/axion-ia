"use client";
// use-client: boutons d'action Envoyer/Ignorer/Reporter + boîte de dialogue de
// double validation (<dialog> natif, useTransition + router.refresh).

/**
 * Hub facturation — relances PROPOSÉES à traiter (Phase 4).
 *
 * Chaque relance s'envoie, s'ignore ou se reporte de 7 jours. RIEN ne part sans
 * clic : c'est l'écran qui matérialise la règle « relances 100 % manuelles ».
 *
 * ## 🔴 Double validation avant tout envoi
 *
 * Exigence du propriétaire : « avant l'envoi de la relance il faut un popup qui
 * apparaît, attention as-tu bien vérifié les relevés bancaires que le paiement
 * du client n'a pas été reçu ? ».
 *
 * La crainte est fondée et le système ne peut pas y répondre seul : un règlement
 * reçu en banque mais non saisi dans la console est indiscernable d'un impayé.
 * La base dit « rien reçu » dans les deux cas. Seul un humain qui a ouvert son
 * relevé peut trancher — d'où une case à cocher OBLIGATOIRE, et un bouton
 * d'envoi inerte tant qu'elle ne l'est pas.
 *
 * La boîte de dialogue montre ce qui rend la décision juste ou fautive : le
 * reste dû NET (pas le TTC total), l'échéance, le palier, l'historique des
 * relances déjà envoyées, et la FRAÎCHEUR du pointage bancaire.
 *
 * Cette confirmation est la SECONDE VALIDATION : une fois donnée, l'e-mail part
 * directement au client sans repasser par la corbeille de validation (voir
 * `outbox-policy.ts`). Elle est re-vérifiée côté serveur — une case cochée qui
 * ne vivrait que dans ce composant serait contournable.
 *
 * ## Coût JS
 *
 * `<dialog>` natif : ni bibliothèque de modale, ni portail, ni piège de focus
 * maison — le navigateur fait les trois. Le contenu n'est monté que lorsqu'une
 * relance est sélectionnée.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  envoyerRelanceAction,
  traiterRelanceAction,
} from "@/server/actions/qualiopi/facturation-hub";

/** Une relance déjà envoyée (historique affiché dans la boîte de dialogue). */
export interface RelanceHistoriqueItem {
  palierLibelle: string;
  /** Date d'envoi au format ISO — le formatage FR est fait ici. */
  envoyeeAtIso: string | null;
}

/** Détail de décision d'une relance, préparé côté serveur. */
export interface RelanceDetail {
  factureNumero: string;
  clientNom: string;
  /** Reste dû NET, déjà formaté en euros par le serveur. */
  resteDuLabel: string;
  /** Échéance au format FR, ou null si absente. */
  echeanceLabel: string | null;
  joursRetard: number;
  palierLibelle: string;
  destinataire: string | null;
  penalitesActives: boolean;
  historique: RelanceHistoriqueItem[];
}

export interface RelanceItem {
  id: string;
  libelle: string;
  palier: string;
  suggestion: string | null;
  /** true = facture CRM (envoi direct possible) ; false = document booking. */
  envoiDirect: boolean;
  /** Détail de décision. Absent = relance booking, ou facture introuvable. */
  detail?: RelanceDetail;
}

/** Fraîcheur du pointage bancaire, calculée côté serveur. */
export interface PointageBancaire {
  /** Date du dernier encaissement enregistré, au format FR. Null = aucun. */
  dernierEncaissementLabel: string | null;
  joursDepuis: number | null;
  avertissement: boolean;
}

const LIEN_RAPPROCHEMENT = "rapprochement";

export function RelancesATraiter({
  relances,
  canWrite = true,
  pointage,
  baseHref,
}: {
  relances: ReadonlyArray<RelanceItem>;
  /**
   * Le rôle courant peut-il écrire (admin/super_admin) ? Sinon les boutons
   * d'action sont masqués — les server actions (requireAdminWrite) rejetteraient
   * de toute façon, on évite l'échec silencieux côté reader. Défaut true pour
   * rétro-compatibilité des appelants existants.
   */
  canWrite?: boolean;
  /** Fraîcheur du pointage bancaire. Absent = bandeau masqué (jamais faussement rassurant). */
  pointage?: PointageBancaire;
  /** Base de l'écran facturation, pour le lien vers le rapprochement bancaire. */
  baseHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Relance dont la boîte de dialogue est ouverte. */
  const [aConfirmer, setAConfirmer] = useState<RelanceItem | null>(null);
  const [releveVerifie, setReleveVerifie] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const annulerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg === null) return;
    if (aConfirmer !== null && !dlg.open) {
      dlg.showModal();
      annulerRef.current?.focus();
    } else if (aConfirmer === null && dlg.open) {
      dlg.close();
    }
  }, [aConfirmer]);

  if (relances.length === 0) return null;

  const fermer = () => {
    setAConfirmer(null);
    setReleveVerifie(false);
  };

  const traiter = (relanceId: string, action: "ignorer" | "reporter") => {
    setErreur(null);
    setInfo(null);
    startTransition(async () => {
      const res = await traiterRelanceAction({ relanceId, action });
      if ("error" in res) setErreur(res.error);
      else router.refresh();
    });
  };

  const confirmerEnvoi = () => {
    const relance = aConfirmer;
    if (relance === null || !releveVerifie) return;
    setErreur(null);
    setInfo(null);
    startTransition(async () => {
      const res = await envoyerRelanceAction({
        relanceId: relance.id,
        confirmationReleveBancaire: true,
      });
      if ("error" in res) {
        setErreur(res.error);
        fermer();
        return;
      }
      if (res.data.garePourValidation) {
        // L'e-mail n'est PAS parti : un réglage d'automatisation par client l'a
        // retenu en corbeille. La relance reste donc à traiter — le dire, plutôt
        // que de la faire disparaître de l'écran sur un envoi qui n'a pas eu lieu.
        setInfo(
          `L'e-mail attend votre validation dans la corbeille d'envoi — rien n'est parti pour l'instant. La relance reste à traiter. Ouvrez « E-mails à valider » pour l'approuver.`,
        );
      } else {
        setInfo(`Relance envoyée à ${res.data.to}.`);
      }
      fermer();
      router.refresh();
    });
  };

  const detail = aConfirmer?.detail;
  const hrefRapprochement =
    baseHref !== undefined ? `${baseHref}/${LIEN_RAPPROCHEMENT}` : LIEN_RAPPROCHEMENT;

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Relances à traiter ({relances.length}) — rien ne part sans votre clic
      </p>

      {/* Bandeau de fraîcheur du pointage bancaire. Affiché en permanence quand
          le pointage est ancien : la vérification se fait AVANT d'ouvrir la
          boîte de dialogue, pas seulement dedans. */}
      {pointage !== undefined && pointage.avertissement && (
        <p className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
          {pointage.dernierEncaissementLabel !== null ? (
            <>
              Dernier encaissement enregistré : le {pointage.dernierEncaissementLabel} (il y a{" "}
              {pointage.joursDepuis} jours).{" "}
            </>
          ) : (
            <>Aucun encaissement n&apos;a encore été enregistré dans la console. </>
          )}
          Pointez votre relevé bancaire avant de relancer : un règlement reçu et non saisi
          produirait une relance injustifiée.{" "}
          <a href={hrefRapprochement} className="admin-link">
            Rapprochement bancaire
          </a>
        </p>
      )}
      {pointage !== undefined && !pointage.avertissement && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Dernier encaissement enregistré : le {pointage.dernierEncaissementLabel} (il y a{" "}
          {pointage.joursDepuis} jours).{" "}
          <a href={hrefRapprochement} className="admin-link">
            Rapprochement bancaire
          </a>
        </p>
      )}

      {erreur !== null && (
        <p role="alert" className="admin-alert admin-alert-error mb-[var(--space-admin-3)]">
          {erreur}
        </p>
      )}
      {info !== null && (
        <p role="status" className="admin-alert admin-alert-info mb-[var(--space-admin-3)]">
          {info}
        </p>
      )}

      <ul className="space-y-[var(--space-admin-3)]">
        {relances.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
          >
            <span className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] uppercase">
              {r.detail?.palierLibelle ?? r.palier}
            </span>
            <span className="flex-1">{r.suggestion ?? r.libelle}</span>
            {canWrite && r.envoiDirect ? (
              <button
                type="button"
                className="admin-button"
                disabled={isPending}
                onClick={() => {
                  setReleveVerifie(false);
                  setAConfirmer(r);
                }}
              >
                Relancer le client
              </button>
            ) : null}
            {canWrite && (
              <>
                <button
                  type="button"
                  className="admin-button-secondary"
                  disabled={isPending}
                  onClick={() => traiter(r.id, "reporter")}
                >
                  Reporter 7 j
                </button>
                <button
                  type="button"
                  className="admin-button-ghost"
                  disabled={isPending}
                  onClick={() => traiter(r.id, "ignorer")}
                >
                  Ignorer
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* ── Boîte de dialogue de double validation ─────────────────────────
          Montée seulement quand une relance est sélectionnée. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="relance-confirm-titre"
        onClose={fermer}
        className="w-[min(34rem,92vw)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] text-[color:var(--color-admin-fg)] shadow-[var(--shadow-admin-3)]"
      >
        {aConfirmer !== null && (
          <>
            <h2
              id="relance-confirm-titre"
              className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold"
            >
              Confirmer l&apos;envoi de la relance
            </h2>

            {detail !== undefined ? (
              <dl className="mb-[var(--space-admin-4)] grid grid-cols-[auto_1fr] gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                <dt className="text-[color:var(--color-admin-fg-muted)]">Client</dt>
                <dd>{detail.clientNom}</dd>
                <dt className="text-[color:var(--color-admin-fg-muted)]">Facture</dt>
                <dd>{detail.factureNumero}</dd>
                <dt className="text-[color:var(--color-admin-fg-muted)]">Reste dû</dt>
                <dd className="font-semibold">{detail.resteDuLabel}</dd>
                <dt className="text-[color:var(--color-admin-fg-muted)]">Échéance</dt>
                <dd>
                  {detail.echeanceLabel ?? "non renseignée"}
                  {detail.joursRetard > 0 ? ` (retard de ${detail.joursRetard} jours)` : ""}
                </dd>
                <dt className="text-[color:var(--color-admin-fg-muted)]">Palier</dt>
                <dd>{detail.palierLibelle}</dd>
                <dt className="text-[color:var(--color-admin-fg-muted)]">Destinataire</dt>
                <dd>{detail.destinataire ?? "aucun e-mail de contact"}</dd>
              </dl>
            ) : (
              <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
                {aConfirmer.suggestion ?? aConfirmer.libelle}
              </p>
            )}

            {detail !== undefined && detail.historique.length > 0 && (
              <div className="mb-[var(--space-admin-4)]">
                <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                  Relances déjà envoyées
                </p>
                <ul className="text-[length:var(--text-admin-sm)]">
                  {detail.historique.map((h, i) => (
                    <li key={`${h.palierLibelle}-${i}`}>
                      {h.palierLibelle}
                      {h.envoyeeAtIso !== null
                        ? ` — le ${new Date(h.envoyeeAtIso).toLocaleDateString("fr-FR")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail?.penalitesActives === true && (
              <p className="admin-alert admin-alert-info mb-[var(--space-admin-4)]">
                Les pénalités de retard sont activées pour ce client : leur montant sera chiffré
                dans le corps de l&apos;e-mail.
              </p>
            )}

            {/* Fraîcheur du pointage, rappelée AU MOMENT de la décision. */}
            {pointage !== undefined && (
              <p
                className={
                  pointage.avertissement
                    ? "admin-alert admin-alert-warning mb-[var(--space-admin-4)]"
                    : "mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                }
              >
                {pointage.dernierEncaissementLabel !== null ? (
                  <>
                    Dernier encaissement enregistré : le {pointage.dernierEncaissementLabel} (il y a{" "}
                    {pointage.joursDepuis} jours).
                  </>
                ) : (
                  <>Aucun encaissement n&apos;a encore été enregistré dans la console.</>
                )}
                {pointage.avertissement ? (
                  <>
                    {" "}
                    Pointez votre relevé bancaire avant de relancer : un règlement reçu et non saisi
                    produirait une relance injustifiée.{" "}
                    <a href={hrefRapprochement} className="admin-link">
                      Rapprochement bancaire
                    </a>
                  </>
                ) : null}
              </p>
            )}

            <label
              htmlFor="relance-confirm-releve"
              className="mb-[var(--space-admin-4)] flex items-start gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
            >
              <input
                id="relance-confirm-releve"
                type="checkbox"
                checked={releveVerifie}
                onChange={(e) => setReleveVerifie(e.target.checked)}
                disabled={isPending}
                className="mt-[var(--space-admin-1)]"
              />
              <span>
                J&apos;ai vérifié mon relevé bancaire : ce règlement n&apos;a pas été reçu.
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-[var(--space-admin-3)]">
              <button
                ref={annulerRef}
                type="button"
                className="admin-button-ghost"
                disabled={isPending}
                onClick={fermer}
              >
                Annuler
              </button>
              <button
                type="button"
                className="admin-button"
                disabled={isPending || !releveVerifie}
                onClick={confirmerEnvoi}
              >
                {isPending ? "Envoi…" : "Envoyer la relance au client"}
              </button>
            </div>
            <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Une fois confirmé, l&apos;e-mail part directement au client.
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
