"use client";
// use-client: useActionState pour afficher le résultat du ping — sans état
// client, le bouton ne rendait aucun retour à l'utilisateur.

/**
 * 🔴 POURQUOI CE COMPOSANT EXISTE (audit du code, 2026-08-03).
 *
 * Le bouton « Notifier les moteurs maintenant » était câblé sur une action qui
 * JETAIT son résultat :
 *
 *     pingAction={async () => { "use server"; await pingIndexNowAction(); }}
 *
 * L'action renvoyait pourtant un `{ ok, status, message, urlsPinged }` soigné,
 * avec des messages métier distincts pour la clé absente, l'échec HTTP et
 * l'erreur réseau. Aucun n'atteignait jamais l'écran : on cliquait, rien ne se
 * passait visiblement, et rien ne disait si les moteurs avaient été prévenus.
 *
 * Le résultat est désormais affiché — c'est tout l'objet de ce composant.
 */

import { useActionState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";

export interface PingResult {
  ok: boolean;
  status: number;
  message: string;
  urlsPinged: number;
}

interface Props {
  action: () => Promise<PingResult>;
  disabled: boolean;
  titre: string;
}

const ETAT_INITIAL: PingResult | null = null;

export function IndexNowPingButton({ action, disabled, titre }: Props): React.ReactElement {
  const [resultat, formAction, enCours] = useActionState<PingResult | null>(
    async () => action(),
    ETAT_INITIAL,
  );

  return (
    <form action={formAction}>
      <button type="submit" className="admin-button" disabled={disabled || enCours} title={titre}>
        {enCours ? "Notification en cours…" : "Notifier les moteurs maintenant"}
      </button>

      {resultat ? (
        <p
          role="status"
          className={`admin-meta-block mt-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] ${
            resultat.ok
              ? "text-[color:var(--color-admin-success)]"
              : "text-[color:var(--color-admin-destructive)]"
          }`}
        >
          {resultat.ok ? (
            <CircleCheck size={15} aria-hidden="true" className="shrink-0" />
          ) : (
            <TriangleAlert size={15} aria-hidden="true" className="shrink-0" />
          )}
          {resultat.message}
        </p>
      ) : null}
    </form>
  );
}
