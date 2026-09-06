"use client";
// use-client: état local du fieldset + de la modalité, useTransition pour setSessionLieuAction. router.refresh() après succès.

/**
 * SessionLieuForm — Correction du lieu de déroulement depuis la fiche session.
 *
 * Raison d&apos;être : jusqu&apos;ici, une session ne pouvait plus être modifiée
 * après sa création — seul son STATUT bougeait. Un lieu mal saisi restait donc
 * faux définitivement, sur la convention comme sur la convocation.
 *
 * 🔴 N2 — la MODALITÉ voyage avec le lieu, et c&apos;est délibéré.
 *
 * Elle n&apos;était modifiable NULLE PART après la création (`createSessionAction`
 * était sa seule écriture), alors que ce formulaire-ci permettait déjà de passer
 * le lieu de « distanciel » à « nos locaux ». On pouvait donc obtenir une session
 * `modalite = distanciel` ET `lieuType = nos_locaux` — deux affirmations
 * contradictoires sur la même prestation, qu&apos;aucun écran ne signalait. C&apos;est
 * l&apos;état dans lequel AXI-SESS-2026-001 s&apos;est retrouvée.
 *
 * Ces deux champs décident ENSEMBLE de ce que la convention imprime et de ce que
 * la convocation promet : les séparer dans deux écrans, c&apos;est garantir qu&apos;on
 * en corrige un et qu&apos;on oublie l&apos;autre. Ils sont donc dans le même geste,
 * et `incoherenceModaliteLieu()` dit la contradiction tant qu&apos;elle reste.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setSessionLieuAction } from "@/server/actions/qualiopi/sessions";
import { LieuFieldset } from "@/components/admin/qualiopi/LieuFieldset";
import { lieuPayload, type LieuValues } from "@/components/admin/qualiopi/lieu-values";
import { incoherenceModaliteLieu, type ModaliteValue } from "@/server/qualiopi/lieu/libelles-acces";

export interface SessionLieuFormProps {
  sessionId: string;
  /** Valeurs actuelles, lues côté serveur sur la fiche. */
  initial: LieuValues;
  /**
   * Modalité ACTUELLE de la session. Valeur initiale du `<select>` ci-dessous —
   * plus seulement une donnée de lecture : elle s&apos;enregistre avec le lieu.
   */
  modalite?: ModaliteValue;
}

const MODALITE_OPTIONS: ReadonlyArray<{ value: ModaliteValue; label: string; aide: string }> = [
  {
    value: "presentiel",
    label: "Présentiel",
    aide: "Tout le monde est dans la même salle. La convention imprime une adresse.",
  },
  {
    value: "distanciel",
    label: "Distanciel (visioconférence)",
    aide: "Personne sur place. Ni adresse ni salle sur les documents — un lien de connexion.",
  },
  {
    value: "hybride",
    label: "Hybride (salle + visio)",
    aide: "Une salle À TENIR et des participants à distance à accueillir. Les deux blocs comptent.",
  },
];

export function SessionLieuForm({
  sessionId,
  initial,
  modalite: modaliteInitiale,
}: SessionLieuFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lieu, setLieu] = useState<LieuValues>(initial);
  const [modalite, setModalite] = useState<ModaliteValue | "">(modaliteInitiale ?? "");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const modaliteEffective = modalite === "" ? undefined : modalite;
  // Recalculée à CHAQUE frappe, pas à l'enregistrement : la contradiction se
  // voit pendant qu'on la fabrique, quand elle se corrige encore d'un clic.
  const contradiction = incoherenceModaliteLieu(lieu.lieuType, modaliteEffective);
  const aideModalite = MODALITE_OPTIONS.find((o) => o.value === modalite)?.aide ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await setSessionLieuAction({
        id: sessionId,
        ...lieuPayload(lieu),
        // Omise quand elle n'a jamais été renseignée : le schéma serveur la
        // traite alors comme « ne touche pas à cette colonne ». Une session
        // sans modalité ne doit pas en gagner une par le seul fait qu'on
        // corrige son adresse.
        ...(modaliteEffective !== undefined ? { modalite: modaliteEffective } : {}),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccessMsg(
        "Lieu et modalité enregistrés. Les documents déjà générés ne changent pas — réémettre la convention, la convocation ou la feuille d'émargement pour qu'ils le portent.",
      );
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      {/* 🔴 La modalité est AU-DESSUS du lieu, et pas à côté : c'est elle qui
          décide des champs que le fieldset affiche et des mots qu'il emploie.
          La placer après reviendrait à faire remplir une adresse pour une
          session qu'on déclare ensuite distancielle. */}
      <div className="mb-[var(--space-admin-5)]">
        <label className={labelCls} htmlFor="fiche-modalite">
          Modalité de la session
        </label>
        <select
          id="fiche-modalite"
          value={modalite}
          onChange={(e) => setModalite(e.target.value as ModaliteValue | "")}
          disabled={isPending}
          className={inputCls}
        >
          <option value="">— Non précisée —</option>
          {MODALITE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {aideModalite ??
            "Décide de ce que la convention imprime et de ce que la convocation promet."}
        </p>
      </div>

      {/* 🔴 La contradiction, dite AVANT d'enregistrer. Une convention qui
          annonce une salle pour une formation tenue en visio est une pièce
          fausse au sens du contrôle — pas un défaut d'esthétique.
          Elle AVERTIT sans BLOQUER : un état transitoire est normal pendant
          qu'on corrige les deux champs, et interdire l'enregistrement
          empêcherait de sortir d'une session déjà incohérente en base. */}
      {contradiction !== null && (
        <p
          role="alert"
          className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {contradiction}
        </p>
      )}

      <LieuFieldset
        value={lieu}
        onChange={(patch) => setLieu((prev) => ({ ...prev, ...patch }))}
        disabled={isPending}
        idPrefix="fiche-lieu"
        modalite={modaliteEffective}
      />

      {error !== null && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg !== null && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer le lieu et la modalité"}
      </button>
    </form>
  );
}
