"use client";
// use-client: formulaire de motif (useState, compteur) + appel de Server Action + router.refresh().

/**
 * 🔴 ADR 0060 — rouvrir un dossier clos (motif obligatoire), ou le clore à
 * nouveau.
 *
 * Rouvrir ouvre la porte à la modification d'une PREUVE : le motif est exigé
 * (10 caractères au moins, même seuil que le CHECK en base), tracé dans le
 * journal append-only `session_dossier_evenements` et lu par l'auditeur dans le
 * dossier d'audit. S'y ajoute le mot de passe de sécurité (décision du
 * dirigeant, 2026-09-30), vérifié côté serveur contre l'empreinte de
 * `QUALIOPI_REOUVERTURE_MDP` ; il n'est jamais conservé dans l'état après
 * l'envoi. Le bouton de validation reste désactivé tant que le motif est trop
 * court ou le mot de passe vide ; le serveur refuse de toute façon.
 *
 * « Clore à nouveau » n'a pas de motif obligatoire. Le serveur le refuse tant
 * que les conditions du verrou ne sont pas réunies, et son refus NOMME ce qui
 * manque : on l'affiche tel quel.
 *
 * Les deux gestes exigent l'habilitation `rouvrir_dossier` (direction). Le
 * bandeau ne rend ce composant qu'avec elle.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Même seuil que `rouvrirDossierSessionAction` et que le CHECK en base. */
export const MOTIF_REOUVERTURE_MIN = 10;

type Resultat = { data: { sessionId: string; depuis: string } } | { error: string };

export interface RouvrirDossierFormProps {
  sessionId: string;
  /** `rouvrir` sur un dossier clos, `clore` sur un dossier rouvert. */
  mode: "rouvrir" | "clore";
  rouvrirAction: (input: {
    sessionId: string;
    motif: string;
    motDePasse: string;
  }) => Promise<Resultat>;
  reverrouillerAction: (input: { sessionId: string; motif?: string }) => Promise<Resultat>;
}

export function RouvrirDossierForm({
  sessionId,
  mode,
  rouvrirAction,
  reverrouillerAction,
}: RouvrirDossierFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const longueur = motif.trim().length;
  const motifValide = longueur >= MOTIF_REOUVERTURE_MIN;
  const motDePasseSaisi = motDePasse !== "";

  function rouvrir() {
    setErreur(null);
    startTransition(async () => {
      const r = await rouvrirAction({ sessionId, motif: motif.trim(), motDePasse });
      // Le mot de passe ne survit pas à l'envoi, qu'il soit accepté ou refusé.
      setMotDePasse("");
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setOuvert(false);
      setMotif("");
      router.refresh();
    });
  }

  function clore() {
    setErreur(null);
    startTransition(async () => {
      const r = await reverrouillerAction({
        sessionId,
        ...(motif.trim() !== "" ? { motif: motif.trim() } : {}),
      });
      if ("error" in r) {
        // Le refus liste ce qui manque encore : c'est la réponse attendue.
        setErreur(r.error);
        return;
      }
      setMotif("");
      router.refresh();
    });
  }

  if (mode === "clore") {
    return (
      <div className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
        <label
          htmlFor={`motif-reverrouillage-${sessionId}`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          Ce qui a été corrigé (facultatif, versé au journal)
        </label>
        <textarea
          id={`motif-reverrouillage-${sessionId}`}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={isPending}
          className="admin-input"
        />
        <button
          type="button"
          onClick={clore}
          disabled={isPending}
          className="admin-button self-start"
        >
          {isPending ? "Clôture…" : "Clore à nouveau"}
        </button>
        {erreur !== null && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            {erreur}
          </p>
        )}
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="admin-button-ghost mt-[var(--space-admin-3)]"
      >
        Rouvrir le dossier
      </button>
    );
  }

  return (
    <div className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
      <label
        htmlFor={`motif-reouverture-${sessionId}`}
        className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
      >
        Motif de la réouverture (obligatoire)
      </label>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Ce motif est enregistré avec votre nom et l&apos;heure, et il figure dans le dossier remis à
        l&apos;auditeur. Écrivez ce qu&apos;il faut corriger, et pourquoi.
      </p>
      <textarea
        id={`motif-reouverture-${sessionId}`}
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={3}
        required
        minLength={MOTIF_REOUVERTURE_MIN}
        maxLength={2000}
        disabled={isPending}
        placeholder="Ex. : taux de présence d'un stagiaire faux, relevé de connexion reçu après la clôture."
        className="admin-input"
      />
      <p
        aria-live="polite"
        className={
          "text-[length:var(--text-admin-xs)] " +
          (motifValide
            ? "text-[color:var(--color-admin-fg-muted)]"
            : "text-[color:var(--color-admin-warning)]")
        }
      >
        {longueur} / {MOTIF_REOUVERTURE_MIN} caractères au minimum
      </p>
      <label
        htmlFor={`mdp-reouverture-${sessionId}`}
        className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
      >
        Mot de passe de sécurité (obligatoire)
      </label>
      <input
        id={`mdp-reouverture-${sessionId}`}
        type="password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        required
        maxLength={200}
        // « new-password » et non « off » : Chrome ignore « off » sur un champ
        // mot de passe et y injectait le mot de passe ENREGISTRÉ du compte admin
        // (constaté en prod le 01/10). Ce mot de passe de sécurité n'est pas celui
        // du compte, il ne doit jamais être pré-rempli.
        autoComplete="new-password"
        name="mot-de-passe-reouverture"
        disabled={isPending}
        className="admin-input"
      />
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          onClick={rouvrir}
          disabled={isPending || !motifValide || !motDePasseSaisi}
          className="admin-button"
        >
          {isPending ? "Réouverture…" : "Rouvrir avec ce motif"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setMotif("");
            setMotDePasse("");
            setErreur(null);
          }}
          disabled={isPending}
          className="admin-button-ghost"
        >
          Annuler
        </button>
      </div>
      {erreur !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
