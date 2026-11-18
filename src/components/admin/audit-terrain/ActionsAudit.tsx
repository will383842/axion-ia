"use client";
// use-client: formulaires à état local (mode de fermeture, retour de l'action) avec appel de Server Action

// Audit présentiel (PR3) : les îlots interactifs de l'écran « Audit ».
// Aucun journal navigateur : le jeton ne vit que dans l'état React, jamais dans l'URL, le stockage ou la console.
// Chaque action redit le clientId de la fiche : le serveur vérifie que la session / le rapport lui appartient.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { creerJetonAudit, validerRapportAudit } from "@/features/admin-audit-terrain/actions";
import {
  regenererJetonDeLaFiche,
  revoquerJetonDeLaFiche,
} from "@/features/admin-audit-terrain/actions-fiche";

const MESSAGES: Record<string, string> = {
  interdit: "Action réservée au super administrateur.",
  invalide: "Demande invalide.",
  introuvable: "Élément introuvable.",
  ancienne_version:
    "Une version plus récente du rapport existe, ou le rapport a déjà été traité : actualisez.",
};
const dire = (e: string): string => MESSAGES[e] ?? "Échec de l'action.";

/** Affiche un jeton UNE seule fois, avec avertissement. */
function JetonAffiche({
  jeton,
  expireLe,
  onFermer,
}: {
  jeton: string;
  expireLe: string;
  onFermer: () => void;
}) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(jeton);
      setCopie(true);
    } catch {
      setCopie(false);
    }
  }
  return (
    <div
      role="alertdialog"
      aria-labelledby="jeton-titre"
      aria-describedby="jeton-avert"
      className="rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-[var(--space-admin-3)]"
    >
      <p id="jeton-titre" className="font-semibold">
        Jeton prêt : copiez-le maintenant
      </p>
      <p id="jeton-avert" className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        Il n&apos;est affiché qu&apos;une seule fois et ne pourra jamais être relu : la console
        n&apos;en garde qu&apos;une empreinte. Collez-le dans le fichier jeton de l&apos;outil sur
        le PC, puis fermez cet encadré. Valable jusqu&apos;au{" "}
        {new Date(expireLe).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.
      </p>
      <label className="block text-[length:var(--text-admin-xs)]" htmlFor="jeton-valeur">
        Jeton d&apos;audit
      </label>
      <input
        id="jeton-valeur"
        readOnly
        autoComplete="off"
        spellCheck={false}
        value={jeton}
        onFocus={(e) => e.currentTarget.select()}
        className="mb-[var(--space-admin-2)] min-h-11 w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] font-mono text-[length:var(--text-admin-xs)]"
      />
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button type="button" className="admin-button-secondary" onClick={copier}>
          Copier
        </button>
        <button type="button" className="admin-button-secondary" onClick={onFermer}>
          J&apos;ai copié le jeton, fermer
        </button>
      </div>
      <p role="status" className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
        {copie ? "Jeton copié dans le presse-papiers." : ""}
      </p>
    </div>
  );
}

/** Créer le jeton : affiché une seule fois. */
export function CreerJeton({
  clientId,
  auditMissionId,
}: {
  clientId: string;
  auditMissionId?: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [jeton, setJeton] = useState<{ valeur: string; expireLe: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function creer() {
    setErreur(null);
    demarrer(async () => {
      const r = await creerJetonAudit({ clientId, ...(auditMissionId ? { auditMissionId } : {}) });
      if (r.ok) setJeton({ valeur: r.jeton, expireLe: r.expireLe });
      else setErreur(dire(r.erreur));
    });
  }
  return (
    <div>
      {jeton === null ? (
        <button type="button" className="admin-button-secondary" onClick={creer} disabled={enCours}>
          {enCours ? "Création…" : "Créer le jeton"}
        </button>
      ) : (
        <JetonAffiche
          jeton={jeton.valeur}
          expireLe={jeton.expireLe}
          onFermer={() => {
            setJeton(null);
            router.refresh();
          }}
        />
      )}
      {erreur !== null ? (
        <p role="alert" className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/** Régénérer le jeton d'une séance : l'ancien code cesse de marcher, les données restent. */
export function RegenererJeton({ clientId, sessionId }: { clientId: string; sessionId: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [jours, setJours] = useState<2 | 5 | 10>(2);
  const [enCours, demarrer] = useTransition();
  const [jeton, setJeton] = useState<{ valeur: string; expireLe: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const idChoix = `validite-${sessionId}`;

  function regenerer() {
    setErreur(null);
    demarrer(async () => {
      const r = await regenererJetonDeLaFiche({ clientId, sessionId, joursValidite: jours });
      if (r.ok) {
        setJeton({ valeur: r.jeton, expireLe: r.expireLe });
        setOuvert(false);
      } else setErreur(dire(r.erreur));
    });
  }
  if (jeton !== null) {
    return (
      <JetonAffiche
        jeton={jeton.valeur}
        expireLe={jeton.expireLe}
        onFermer={() => {
          setJeton(null);
          router.refresh();
        }}
      />
    );
  }
  return (
    <span>
      {ouvert ? (
        <span className="block max-w-prose rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border-strong)] p-[var(--space-admin-2)]">
          <span className="mb-[var(--space-admin-2)] block text-[length:var(--text-admin-xs)]">
            À faire si vous changez d&apos;ordinateur ou perdez le code. L&apos;ancien code cesse de
            marcher ; les données déjà reçues restent.
          </span>
          <label
            htmlFor={idChoix}
            className="mr-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
          >
            Valable
          </label>
          <select
            id={idChoix}
            value={jours}
            onChange={(e) => setJours(Number(e.target.value) as 2 | 5 | 10)}
            className="mr-[var(--space-admin-2)] min-h-11 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)]"
          >
            <option value={2}>2 jours</option>
            <option value={5}>5 jours</option>
            <option value={10}>10 jours</option>
          </select>
          <button
            type="button"
            className="admin-button-secondary"
            onClick={regenerer}
            disabled={enCours}
          >
            {enCours ? "Régénération…" : "Régénérer maintenant"}
          </button>{" "}
          <button type="button" className="admin-button-secondary" onClick={() => setOuvert(false)}>
            Annuler
          </button>
        </span>
      ) : (
        <button type="button" className="admin-button-secondary" onClick={() => setOuvert(true)}>
          Régénérer le jeton
        </button>
      )}
      {erreur !== null ? (
        <span
          role="alert"
          className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </span>
      ) : null}
    </span>
  );
}

/** Révocation en deux temps (confirmation explicite, sans boîte de dialogue du navigateur). */
export function RevoquerJeton({ clientId, sessionId }: { clientId: string; sessionId: string }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  function revoquer() {
    demarrer(async () => {
      const r = await revoquerJetonDeLaFiche({ clientId, sessionId });
      if (r.ok) router.refresh();
      else setErreur(dire(r.erreur));
    });
  }
  return (
    <span>
      {confirme ? (
        <span className="inline-flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <button
            type="button"
            className="admin-button-danger"
            onClick={revoquer}
            disabled={enCours}
          >
            Confirmer la révocation
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            onClick={() => setConfirme(false)}
          >
            Annuler
          </button>
        </span>
      ) : (
        <button type="button" className="admin-button-secondary" onClick={() => setConfirme(true)}>
          Révoquer le jeton
        </button>
      )}
      {erreur !== null ? (
        <span
          role="alert"
          className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </span>
      ) : null}
    </span>
  );
}

export function ValiderRapport({ rapportId, clientId }: { rapportId: string; clientId: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  function valider() {
    demarrer(async () => {
      const r = await validerRapportAudit(rapportId, clientId);
      if (r.ok) router.refresh();
      else setErreur(dire(r.erreur));
    });
  }
  return (
    <div>
      <button type="button" className="admin-button" onClick={valider} disabled={enCours}>
        {enCours ? "Validation…" : "Valider"}
      </button>
      <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Valider ne l&apos;envoie à personne : le rapport reste dans la console.
      </p>
      {erreur !== null ? (
        <p role="alert" className="text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/** Rafraîchit la page toutes les 30 s quand l'onglet est visible ; bouton manuel toujours présent. */
export function RafraichirAuto({ actif }: { actif: boolean }) {
  const router = useRouter();
  const [le, setLe] = useState<string>("");
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setLe(new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" }));
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [actif, router]);
  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <button
        type="button"
        className="admin-button-secondary"
        onClick={() => {
          router.refresh();
          setLe(new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" }));
        }}
      >
        Actualiser
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
      >
        {actif
          ? "Mise à jour automatique toutes les 30 secondes."
          : "Audit terminé ou arrêté : pas de mise à jour automatique."}
        {le !== "" ? ` Dernière actualisation à ${le}.` : ""}
      </span>
    </div>
  );
}
