// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Kill switch V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { activateKillSwitch, deactivateKillSwitch } from "@/server/actions/content-gen/kill-switch";

interface KillSwitchState {
  active: boolean;
  activatedAt: string | null;
  reason: string | null;
}

interface Props {
  state: KillSwitchState;
}

export function KillSwitchV2({ state }: Props): React.ReactElement {
  async function activate(formData: FormData) {
    "use server";
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3) throw new Error("reason_required");
    await activateKillSwitch(reason);
  }

  async function deactivate() {
    "use server";
    await deactivateKillSwitch();
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Kill switch"
        description="Stop immédiat de toutes les générations content-gen. Les workers rejetent les jobs au pick tant que l'interrupteur est actif."
      />

      <AdminCard
        {...(state.active
          ? { className: "border-l-4 border-l-[color:var(--color-admin-destructive)]" }
          : {})}
      >
        <h2 className="admin-h2">
          {state.active ? "🛑 Kill switch ACTIF" : "✅ Kill switch INACTIF"}
        </h2>
        {state.active ? (
          <>
            <p className="admin-meta-block">
              <strong>Activé le :</strong> {state.activatedAt}
            </p>
            <p className="admin-meta-block">
              <strong>Raison :</strong> {state.reason ?? "—"}
            </p>
            <form action={deactivate}>
              <button type="submit" className="admin-button">
                Désactiver le kill switch
              </button>
            </form>
          </>
        ) : (
          <form action={activate}>
            <div className="admin-field">
              <label htmlFor="reason" className="admin-label">
                Raison (min 3 caractères, max 280)
              </label>
              <textarea
                id="reason"
                name="reason"
                className="admin-input"
                rows={3}
                required
                minLength={3}
                maxLength={280}
                placeholder="Ex. incident provider — pause d'urgence"
              />
            </div>
            <button
              type="submit"
              className="admin-button bg-[color:var(--color-admin-destructive)] text-[color:var(--color-admin-paper)]"
            >
              🛑 Activer le kill switch
            </button>
          </form>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
