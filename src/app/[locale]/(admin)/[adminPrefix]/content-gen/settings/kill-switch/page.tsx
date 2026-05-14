/**
 * Content Generator — Kill switch (§ 12 master prompt).
 *
 * 1 clic activate/deactivate. Lit l'état depuis `ContentGenConfig` table.
 * Quand actif → tous les workers content-gen rejettent les jobs au pick.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  activateKillSwitch,
  deactivateKillSwitch,
  getKillSwitch,
} from "@/server/actions/content-gen/kill-switch";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KillSwitchPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const state = await getKillSwitch();

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Kill switch</h1>
          <p className="admin-meta">
            Stop immédiat de toutes les générations content-gen. Les workers rejetent les jobs au
            pick tant que l&apos;interrupteur est actif.
          </p>
        </div>
      </div>

      <div
        className="admin-card"
        style={{ borderColor: state.active ? "var(--color-terracotta)" : undefined }}
      >
        <h2>{state.active ? "🛑 Kill switch ACTIF" : "✅ Kill switch INACTIF"}</h2>
        {state.active ? (
          <>
            <p>
              <strong>Activé le :</strong> {state.activatedAt}
            </p>
            <p>
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
              className="admin-button"
              style={{ background: "var(--color-terracotta)", color: "var(--color-paper)" }}
            >
              🛑 Activer le kill switch
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
