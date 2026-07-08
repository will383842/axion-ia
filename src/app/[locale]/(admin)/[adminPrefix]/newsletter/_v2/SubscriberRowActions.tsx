"use client";
// use-client: useActionState + confirmation locale pour les actions RGPD par
// abonné (désabonnement forcé + droit à l'effacement). Zéro appel DB côté client
// — délègue aux server actions existantes forceUnsubscribeAction / eraseSubscriberAction.

import { useActionState, useState } from "react";
import {
  forceUnsubscribeAction,
  eraseSubscriberAction,
  type UnsubscribeState,
  type EraseSubscriberState,
} from "@/features/admin-newsletter/actions";

const IDLE_UNSUB: UnsubscribeState = { ok: false, error: "" };
const IDLE_ERASE: EraseSubscriberState = { ok: false, error: "" };

export interface SubscriberRowActionsProps {
  id: string;
  status: string;
}

export function SubscriberRowActions({
  id,
  status,
}: SubscriberRowActionsProps): React.ReactElement {
  const [unsubState, unsubAction, unsubPending] = useActionState(
    forceUnsubscribeAction,
    IDLE_UNSUB,
  );
  const [eraseState, eraseAction, erasePending] = useActionState(eraseSubscriberAction, IDLE_ERASE);
  const [confirmUnsub, setConfirmUnsub] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  const unsubErr = !unsubState.ok ? unsubState.error : "";
  const eraseErr = !eraseState.ok ? eraseState.error : "";

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-2)]">
      <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        {status !== "unsubscribed" ? (
          confirmUnsub ? (
            <form action={unsubAction} className="flex items-center gap-[var(--space-admin-2)]">
              <input type="hidden" name="id" value={id} />
              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Désabonner ?
              </span>
              <button type="submit" disabled={unsubPending} className="admin-button-ghost">
                {unsubPending ? "…" : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnsub(false)}
                className="admin-button-ghost"
              >
                Non
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmUnsub(true)}
              className="admin-button-ghost"
            >
              Désabonner
            </button>
          )
        ) : null}

        {confirmErase ? (
          <form
            action={eraseAction}
            className="flex flex-wrap items-center gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="id" value={id} />
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              placeholder="Motif RGPD (obligatoire)"
              className="admin-input"
              style={{ minWidth: "180px" }}
            />
            <button
              type="submit"
              disabled={erasePending}
              className="admin-button-ghost"
              style={{ color: "var(--color-admin-error)" }}
            >
              {erasePending ? "…" : "Confirmer l'effacement"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmErase(false)}
              className="admin-button-ghost"
            >
              Annuler
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            className="admin-button-ghost"
            style={{ color: "var(--color-admin-error)" }}
            title="Droit à l'effacement RGPD — réservé super_admin"
          >
            Effacer (RGPD)
          </button>
        )}
      </div>
      {unsubErr ? (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {unsubErr}
        </span>
      ) : null}
      {eraseErr ? (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {eraseErr}
        </span>
      ) : null}
    </div>
  );
}
