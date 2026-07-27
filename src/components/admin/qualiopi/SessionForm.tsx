"use client";
// use-client: formulaire de création de session (état local, selects, inputs, toggle récurrence) + useTransition pour createSessionAction / createRecurringSessionsAction.

/**
 * SessionForm — Formulaire de création d&apos;une session de formation.
 *
 * Mode simple : appelle createSessionAction.
 * Mode récurrent (toggle) : appelle createRecurringSessionsAction.
 *
 * Props de base : liste de formations publiées pour le select (chargée côté Server).
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionAction } from "@/server/actions/qualiopi/sessions";
import { createRecurringSessionsAction } from "@/server/actions/qualiopi/sessions-recurrentes";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface FormationOption {
  id: string;
  titre: string;
  numero: string;
}

export interface ClientOption {
  id: string;
  raisonSociale: string;
  numero: string;
}

export interface DevisOption {
  id: string;
  numero: string;
  clientId: string;
  clientNom: string;
  montantHtCents: number;
}

export interface SessionFormProps {
  /** Formations publiées disponibles pour la session. */
  formations: FormationOption[];
  /** Clients disponibles pour rattachement optionnel. */
  clients?: ClientOption[];
  /**
   * Devis ACCEPTÉS, rattachables à la session (F8).
   * `clientId` sert au filtrage : un devis n'est pertinent que pour son client.
   */
  devis?: DevisOption[];
  /** Callback après création réussie — reçoit l&apos;id de la session créée. */
  onSuccess?: (sessionId: string) => void;
  /** URL de redirection après création (alternative à onSuccess). */
  redirectAfterCreate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

const MODALITE_OPTIONS = [
  { value: "presentiel", label: "Présentiel" },
  { value: "distanciel", label: "Distanciel" },
  { value: "hybride", label: "Hybride" },
] as const;

const FINANCEMENT_OPTIONS = [
  { value: "", label: "— Non défini —" },
  { value: "direct", label: "Direct (entreprise)" },
  { value: "opco", label: "OPCO" },
  // CPF retiré (2026-07-04) — Axion-IA non habilité CPF (sélection interdite).
  { value: "france_travail", label: "France Travail" },
  { value: "mixte", label: "Mixte" },
] as const;

const FREQUENCE_OPTIONS = [
  { value: "hebdomadaire", label: "Hebdomadaire (toutes les 7 jours)" },
  { value: "mensuelle", label: "Mensuelle (tous les 30 jours)" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function SessionForm({
  formations,
  clients = [],
  devis = [],
  onSuccess,
  redirectAfterCreate,
}: SessionFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Champs communs
  const [formationId, setFormationId] = useState("");
  const [titreSession, setTitreSession] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [modalite, setModalite] = useState<"presentiel" | "distanciel" | "hybride">("presentiel");
  const [nbParticipants, setNbParticipants] = useState("1");
  const [montantHt, setMontantHt] = useState("0");
  const [clientId, setClientId] = useState("");
  const [devisId, setDevisId] = useState("");

  // Un devis n'appartient qu'à un client. Changer de client doit donc relâcher
  // le devis retenu, sinon on enverrait à l'action un couple incohérent que
  // seule une lecture attentive de la base révélerait plus tard.
  const devisDuClient = devis.filter((d) => d.clientId === clientId);
  const devisRetenuValide = devisId === "" || devisDuClient.some((d) => d.id === devisId);
  if (!devisRetenuValide) setDevisId("");
  const [financementType, setFinancementType] = useState("");

  // Récurrence
  const [modeRecurrent, setModeRecurrent] = useState(false);
  const [frequence, setFrequence] = useState<"hebdomadaire" | "mensuelle">("hebdomadaire");
  const [occurrences, setOccurrences] = useState("2");
  const [dureeHeures, setDureeHeures] = useState("7");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formationId) {
      setError("Veuillez sélectionner une formation.");
      return;
    }
    if (!dateDebut || !dateFin) {
      setError("Veuillez renseigner les dates de début et de fin.");
      return;
    }

    const montantCents = Math.round(parseFloat(montantHt || "0") * 100);
    if (isNaN(montantCents) || montantCents < 0) {
      setError("Montant HT invalide.");
      return;
    }

    const nbPart = parseInt(nbParticipants, 10);
    if (isNaN(nbPart) || nbPart < 1) {
      setError("Le nombre de participants doit être au moins 1.");
      return;
    }

    if (modeRecurrent) {
      const occ = parseInt(occurrences, 10);
      const duree = parseInt(dureeHeures, 10);
      if (isNaN(occ) || occ < 2 || occ > 52) {
        setError("Le nombre d'occurrences doit être compris entre 2 et 52.");
        return;
      }
      if (isNaN(duree) || duree < 1) {
        setError("La durée en heures doit être au moins 1.");
        return;
      }

      startTransition(async () => {
        const result = await createRecurringSessionsAction({
          formationId,
          premiereDateDebut: new Date(dateDebut),
          dureeHeures: duree,
          frequence,
          occurrences: occ,
          modalite,
          montantHtCents: montantCents,
          nbParticipantsPrevus: nbPart,
          ...(titreSession.trim() ? { titreSession: titreSession.trim() } : {}),
          ...(clientId ? { clientId } : {}),
          ...(devisId ? { devisId } : {}),
          ...(financementType
            ? {
                financementType: financementType as
                  | "direct"
                  | "opco"
                  | "cpf"
                  | "france_travail"
                  | "mixte",
              }
            : {}),
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        setSuccessMsg(
          `${result.data.count} sessions récurrentes créées. Session parent : ${result.data.parentNumero}.`,
        );
        if (onSuccess) {
          onSuccess(result.data.parentId);
        } else if (redirectAfterCreate) {
          router.push(redirectAfterCreate);
        } else {
          router.refresh();
        }
      });
    } else {
      startTransition(async () => {
        const result = await createSessionAction({
          formationId,
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          modalite,
          nbParticipantsPrevus: nbPart,
          montantHtCents: montantCents,
          ...(titreSession.trim() ? { titreSession: titreSession.trim() } : {}),
          ...(clientId ? { clientId } : {}),
          ...(devisId ? { devisId } : {}),
          ...(financementType
            ? {
                financementType: financementType as
                  | "direct"
                  | "opco"
                  | "cpf"
                  | "france_travail"
                  | "mixte",
              }
            : {}),
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        setSuccessMsg(`Session ${result.data.numero} créée avec succès.`);
        if (onSuccess) {
          onSuccess(result.data.id);
        } else if (redirectAfterCreate) {
          router.push(`${redirectAfterCreate}/${result.data.id}`);
        } else {
          router.refresh();
        }
      });
    }
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const selectCls = inputCls;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-6)]"
    >
      {/* ── Formation ──────────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="session-formation">
          Formation <span aria-hidden="true">*</span>
        </label>
        <select
          id="session-formation"
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
          disabled={isPending}
          required
          className={selectCls}
        >
          <option value="">— Choisir une formation —</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.numero} — {f.titre}
            </option>
          ))}
        </select>
        {formations.length === 0 && (
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
            Aucune formation publiée disponible. Publiez d&apos;abord une formation.
          </p>
        )}
      </div>

      {/* ── Titre de session (optionnel) ───────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="session-titre">
          Titre de la session{" "}
          <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
            (optionnel — par défaut le titre de la formation)
          </span>
        </label>
        <input
          id="session-titre"
          type="text"
          value={titreSession}
          onChange={(e) => setTitreSession(e.target.value)}
          disabled={isPending}
          maxLength={300}
          className={inputCls}
          placeholder="Ex. : IA générative — Groupe Lyon Novembre 2026"
        />
      </div>

      {/* ── Modalité ──────────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="session-modalite">
          Modalité <span aria-hidden="true">*</span>
        </label>
        <select
          id="session-modalite"
          value={modalite}
          onChange={(e) => setModalite(e.target.value as typeof modalite)}
          disabled={isPending}
          className={selectCls}
        >
          {MODALITE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Client (optionnel) ────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <>
          <div className="mb-[var(--space-admin-5)]">
            <label className={labelCls} htmlFor="session-client">
              Client{" "}
              <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
                (optionnel)
              </span>
            </label>
            <select
              id="session-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isPending}
              className={selectCls}
            >
              <option value="">— Aucun client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.raisonSociale}
                </option>
              ))}
            </select>
          </div>

          {/* 🔴 F8 — rattachement du devis.
            La colonne `devis_id` existait et l'action savait l'écrire, mais
            aucun écran ne permettait de choisir le devis : le lien était
            inatteignable. Et depuis F7, « Transformer en convention » EXIGE une
            session rattachée — sans ce champ, le bouton refusait toujours.

            Filtré sur le client choisi : un devis n'est pertinent que pour SON
            client. Proposer les autres fabriquerait des rattachements
            incohérents que rien ne rattraperait — la convention porterait alors
            le prix d'un devis appartenant à quelqu'un d'autre. */}
          <div className="mb-[var(--space-admin-5)]">
            <label className={labelCls} htmlFor="session-devis">
              Devis d&apos;origine{" "}
              <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
                (optionnel)
              </span>
            </label>
            <select
              id="session-devis"
              value={devisId}
              onChange={(e) => setDevisId(e.target.value)}
              disabled={isPending || clientId === ""}
              className={selectCls}
            >
              <option value="">— Aucun devis —</option>
              {devisDuClient.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.numero} — {(d.montantHtCents / 100).toLocaleString("fr-FR")} € HT
                </option>
              ))}
            </select>
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {clientId === ""
                ? "Choisissez d'abord un client pour voir ses devis acceptés."
                : devisDuClient.length === 0
                  ? "Aucun devis accepté pour ce client. « Transformer en convention » restera indisponible tant qu'aucune session n'est rattachée à un devis."
                  : "Rattacher le devis permet de générer la convention depuis la fiche du devis, et trace le lien commercial → pédagogique du dossier."}
            </p>
          </div>
        </>
      )}

      {/* ── Financement (optionnel) ───────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="session-financement">
          Type de financement{" "}
          <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
            (optionnel — modifiable ensuite dans la page Financement)
          </span>
        </label>
        <select
          id="session-financement"
          value={financementType}
          onChange={(e) => setFinancementType(e.target.value)}
          disabled={isPending}
          className={selectCls}
        >
          {FINANCEMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Participants & montant ─────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="session-participants">
            Nb participants prévus <span aria-hidden="true">*</span>
          </label>
          <input
            id="session-participants"
            type="number"
            min={1}
            value={nbParticipants}
            onChange={(e) => setNbParticipants(e.target.value)}
            disabled={isPending}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="session-montant">
            Montant HT (€) <span aria-hidden="true">*</span>
          </label>
          <input
            id="session-montant"
            type="number"
            min={0}
            step="0.01"
            value={montantHt}
            onChange={(e) => setMontantHt(e.target.value)}
            disabled={isPending}
            className={inputCls}
            required
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            TVA appliquée selon le régime configuré (Paramètres → Qualiopi → Régime de TVA).
          </p>
        </div>
      </div>

      {/* ── Mode récurrent toggle ─────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className="flex cursor-pointer items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <input
            type="checkbox"
            checked={modeRecurrent}
            onChange={(e) => setModeRecurrent(e.target.checked)}
            disabled={isPending}
            className="accent-[color:var(--color-admin-accent)]"
          />
          <span>Créer plusieurs occurrences (sessions récurrentes)</span>
        </label>
      </div>

      {/* ── Dates (simple) ────────────────────────────────────────────────── */}
      {!modeRecurrent && (
        <div className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="session-date-debut">
              Date de début <span aria-hidden="true">*</span>
            </label>
            <input
              id="session-date-debut"
              type="datetime-local"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              disabled={isPending}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="session-date-fin">
              Date de fin <span aria-hidden="true">*</span>
            </label>
            <input
              id="session-date-fin"
              type="datetime-local"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              disabled={isPending}
              className={inputCls}
              required
            />
          </div>
        </div>
      )}

      {/* ── Paramètres récurrence ─────────────────────────────────────────── */}
      {modeRecurrent && (
        <div className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]">
          <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Paramètres de récurrence
          </h3>

          <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="session-premiere-date">
                Date de la 1re occurrence <span aria-hidden="true">*</span>
              </label>
              <input
                id="session-premiere-date"
                type="datetime-local"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                disabled={isPending}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="session-duree-heures">
                Durée de chaque occurrence (heures) <span aria-hidden="true">*</span>
              </label>
              <input
                id="session-duree-heures"
                type="number"
                min={1}
                max={10000}
                value={dureeHeures}
                onChange={(e) => setDureeHeures(e.target.value)}
                disabled={isPending}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="session-frequence">
                Fréquence <span aria-hidden="true">*</span>
              </label>
              <select
                id="session-frequence"
                value={frequence}
                onChange={(e) => setFrequence(e.target.value as typeof frequence)}
                disabled={isPending}
                className={selectCls}
              >
                {FREQUENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="session-occurrences">
                Nombre d&apos;occurrences (2 à 52) <span aria-hidden="true">*</span>
              </label>
              <input
                id="session-occurrences"
                type="number"
                min={2}
                max={52}
                value={occurrences}
                onChange={(e) => setOccurrences(e.target.value)}
                disabled={isPending}
                className={inputCls}
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      {/* ── Bouton submit ─────────────────────────────────────────────────── */}
      <div className="flex gap-[var(--space-admin-3)]">
        <button
          type="submit"
          disabled={isPending || formations.length === 0}
          className="admin-button"
          aria-label={modeRecurrent ? "Créer les sessions récurrentes" : "Créer la session"}
        >
          {isPending
            ? "Création en cours…"
            : modeRecurrent
              ? "Créer les sessions récurrentes"
              : "Créer la session"}
        </button>
      </div>
    </form>
  );
}
