"use client";
// use-client: formulaire de création d'un parcours coaching 1-to-1 (état local,
// selects, liste dynamique de séances) + useTransition pour createCoachingParcoursAction.

/**
 * CoachingParcoursForm — l'admin crée un parcours 1-to-1 et AFFECTE le formateur.
 *
 * Principe verrouillé par Will (2026-08-05) : « les formateurs ne construisent
 * RIEN — Axion-IA construit puis affecte ». L'action existait
 * (`createCoachingParcoursAction`) mais n'avait AUCUN point d'entrée UI : ce
 * formulaire est ce point d'entrée. Un parcours de N séances = N lignes
 * CoachingSession partageant prestation/bénéficiaire/rattachements.
 *
 * Zéro appel DB côté client : formateurs, prestations, clients et devis sont
 * chargés par la page serveur et passés en props (même pattern que SessionForm).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createCoachingParcoursAction } from "@/server/actions/qualiopi/coaching-parcours";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface TrainerOption {
  id: string;
  prenom: string;
  nom: string;
}

export interface InterventionOption {
  slug: string;
  label: string;
}

export interface ParcoursClientOption {
  id: string;
  raisonSociale: string;
}

export interface ParcoursDevisOption {
  id: string;
  numero: string;
  clientId: string;
}

export interface CoachingParcoursFormProps {
  /** Formateurs ACTIFS uniquement (l'action refuse un formateur inactif). */
  trainers: TrainerOption[];
  /** Prestations 1-to-1 proposables (les variantes retirées de la vente sont exclues). */
  interventions: InterventionOption[];
  /** Clients CRM pour rattachement optionnel. */
  clients: ParcoursClientOption[];
  /** Devis acceptés/transformés — filtrés côté client sur le client choisi. */
  devis: ParcoursDevisOption[];
  /** URL de la liste des séances, cible de la redirection après création. */
  redirectAfterCreate: string;
  /** Client pré-sélectionné (`?clientId=`, renvoi depuis le wizard de vente). */
  clientInitialId?: string;
}

interface SeanceDraft {
  /** Début de séance, valeur d'un <input type="datetime-local">. */
  debut: string;
  /** Heure de fin optionnelle (même jour), valeur d'un <input type="time">. */
  heureFin: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function CoachingParcoursForm({
  trainers,
  interventions,
  clients,
  devis,
  redirectAfterCreate,
  clientInitialId,
}: CoachingParcoursFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [trainerId, setTrainerId] = useState("");
  const [interventionSlug, setInterventionSlug] = useState("");
  const [beneficiaireNom, setBeneficiaireNom] = useState("");
  const [beneficiaireEmail, setBeneficiaireEmail] = useState("");
  const [beneficiaireEntreprise, setBeneficiaireEntreprise] = useState("");
  const [clientId, setClientId] = useState(clientInitialId ?? "");
  const [devisId, setDevisId] = useState("");
  const [seances, setSeances] = useState<SeanceDraft[]>([{ debut: "", heureFin: "" }]);

  // Un devis n'appartient qu'à un client : le select devis est filtré sur le
  // client choisi, et changer de client relâche le devis retenu (sinon on
  // enverrait à l'action un couple incohérent qu'elle rejetterait).
  const devisDuClient = devis.filter((d) => d.clientId === clientId);

  function updateSeance(index: number, patch: Partial<SeanceDraft>): void {
    setSeances((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSeance(): void {
    setSeances((prev) => [...prev, { debut: "", heureFin: "" }]);
  }

  function removeSeance(index: number): void {
    setSeances((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!trainerId) {
      setError("Veuillez choisir le formateur à affecter.");
      return;
    }
    if (!interventionSlug) {
      setError("Veuillez choisir la prestation 1-to-1.");
      return;
    }
    if (!beneficiaireNom.trim()) {
      setError("Veuillez renseigner le nom du bénéficiaire.");
      return;
    }

    const seancesPayload: Array<{ date: Date; dateFin?: Date }> = [];
    for (const [i, s] of seances.entries()) {
      if (!s.debut) {
        setError(`La séance ${i + 1} n'a pas de date et heure de début.`);
        return;
      }
      const date = new Date(s.debut);
      if (isNaN(date.getTime())) {
        setError(`La séance ${i + 1} a une date de début invalide.`);
        return;
      }
      if (s.heureFin) {
        // Fin le MÊME JOUR que le début : on recompose la date à partir du jour
        // du début + l'heure de fin saisie.
        const fin = new Date(`${s.debut.slice(0, 10)}T${s.heureFin}`);
        if (isNaN(fin.getTime()) || fin.getTime() <= date.getTime()) {
          setError(`La séance ${i + 1} a une heure de fin antérieure ou égale à son début.`);
          return;
        }
        seancesPayload.push({ date, dateFin: fin });
      } else {
        seancesPayload.push({ date });
      }
    }

    startTransition(async () => {
      const result = await createCoachingParcoursAction({
        trainerId,
        interventionSlug,
        beneficiaireNom: beneficiaireNom.trim(),
        ...(beneficiaireEmail.trim() ? { beneficiaireEmail: beneficiaireEmail.trim() } : {}),
        ...(beneficiaireEntreprise.trim()
          ? { beneficiaireEntreprise: beneficiaireEntreprise.trim() }
          : {}),
        ...(clientId ? { clientId } : {}),
        ...(devisId ? { devisId } : {}),
        seances: seancesPayload,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setSuccessMsg(
        result.data.count > 1
          ? `Parcours créé : ${result.data.count} séances planifiées.`
          : "Parcours créé : 1 séance planifiée.",
      );
      router.push(redirectAfterCreate);
    });
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
      {/* ── Formateur affecté ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="parcours-formateur">
          Formateur affecté <span aria-hidden="true">*</span>
        </label>
        <select
          id="parcours-formateur"
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
          disabled={isPending}
          required
          className={selectCls}
        >
          <option value="">— Choisir un formateur —</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.prenom} {t.nom}
            </option>
          ))}
        </select>
        {trainers.length === 0 && (
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
            Aucun formateur actif. Activez d&apos;abord un formateur.
          </p>
        )}
      </div>

      {/* ── Prestation 1-to-1 ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="parcours-prestation">
          Prestation <span aria-hidden="true">*</span>
        </label>
        <select
          id="parcours-prestation"
          value={interventionSlug}
          onChange={(e) => setInterventionSlug(e.target.value)}
          disabled={isPending}
          required
          className={selectCls}
        >
          <option value="">— Choisir une prestation —</option>
          {interventions.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Bénéficiaire ──────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="parcours-beneficiaire-nom">
          Bénéficiaire <span aria-hidden="true">*</span>
        </label>
        <input
          id="parcours-beneficiaire-nom"
          type="text"
          value={beneficiaireNom}
          onChange={(e) => setBeneficiaireNom(e.target.value)}
          disabled={isPending}
          maxLength={200}
          required
          className={inputCls}
          placeholder="Prénom Nom"
        />
      </div>

      <div className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="parcours-beneficiaire-email">
            E-mail du bénéficiaire{" "}
            <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
              (optionnel)
            </span>
          </label>
          <input
            id="parcours-beneficiaire-email"
            type="email"
            value={beneficiaireEmail}
            onChange={(e) => setBeneficiaireEmail(e.target.value)}
            disabled={isPending}
            maxLength={254}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="parcours-beneficiaire-entreprise">
            Entreprise{" "}
            <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
              (optionnel)
            </span>
          </label>
          <input
            id="parcours-beneficiaire-entreprise"
            type="text"
            value={beneficiaireEntreprise}
            onChange={(e) => setBeneficiaireEntreprise(e.target.value)}
            disabled={isPending}
            maxLength={250}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Rattachement CRM (client + devis) ─────────────────────────────── */}
      {clients.length > 0 && (
        <>
          <div className="mb-[var(--space-admin-5)]">
            <label className={labelCls} htmlFor="parcours-client">
              Client{" "}
              <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
                (optionnel)
              </span>
            </label>
            <select
              id="parcours-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setDevisId("");
              }}
              disabled={isPending}
              className={selectCls}
            >
              <option value="">— Aucun client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-[var(--space-admin-5)]">
            <label className={labelCls} htmlFor="parcours-devis">
              Devis d&apos;origine{" "}
              <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
                (optionnel)
              </span>
            </label>
            <select
              id="parcours-devis"
              value={devisId}
              onChange={(e) => setDevisId(e.target.value)}
              disabled={isPending || clientId === ""}
              className={selectCls}
            >
              <option value="">— Aucun devis —</option>
              {devisDuClient.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.numero}
                </option>
              ))}
            </select>
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {clientId === ""
                ? "Choisissez d'abord un client pour voir ses devis acceptés."
                : devisDuClient.length === 0
                  ? "Aucun devis accepté pour ce client."
                  : "Rattacher le devis trace le lien commercial → pédagogique du parcours."}
            </p>
          </div>
        </>
      )}

      {/* Checkbox « Parcours cadré en AFEST » RETIRÉE le 2026-08-10 : le
          1-to-1 est une prestation de conseil (décision Will 2026-07-17),
          plus aucun parcours ne se cadre en AFEST. */}
      {/* ── Séances du parcours ───────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]">
        <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Séances du parcours ({seances.length})
        </h3>

        <div className="space-y-[var(--space-admin-4)]">
          {seances.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-end gap-[var(--space-admin-3)] sm:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <label className={labelCls} htmlFor={`parcours-seance-${i}-debut`}>
                  Séance {i + 1} — début <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`parcours-seance-${i}-debut`}
                  type="datetime-local"
                  value={s.debut}
                  onChange={(e) => updateSeance(i, { debut: e.target.value })}
                  disabled={isPending}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`parcours-seance-${i}-fin`}>
                  Heure de fin{" "}
                  <span className="font-normal text-[color:var(--color-admin-fg-muted)] normal-case">
                    (optionnel)
                  </span>
                </label>
                <input
                  id={`parcours-seance-${i}-fin`}
                  type="time"
                  value={s.heureFin}
                  onChange={(e) => updateSeance(i, { heureFin: e.target.value })}
                  disabled={isPending}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => removeSeance(i)}
                disabled={isPending || seances.length === 1}
                className="inline-flex items-center gap-[var(--space-admin-1)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-error)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Retirer la séance ${i + 1}`}
              >
                <Trash2 size={14} aria-hidden="true" />
                Retirer
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSeance}
          disabled={isPending}
          className="mt-[var(--space-admin-4)] inline-flex items-center gap-[var(--space-admin-1)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-paper)]"
        >
          <Plus size={14} aria-hidden="true" />
          Ajouter une séance
        </button>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
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

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <div className="flex gap-[var(--space-admin-3)]">
        <button
          type="submit"
          disabled={isPending || trainers.length === 0}
          className="admin-button"
        >
          {isPending ? "Création en cours…" : "Créer le parcours"}
        </button>
      </div>
    </form>
  );
}
