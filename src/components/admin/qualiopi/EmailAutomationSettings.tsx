"use client";
// use-client: formulaire de réglage + suppression via useTransition + Server Actions.
/**
 * EmailAutomationSettings — règles d'envoi automatique (F60).
 *
 * 🔴 Vérification E2E 2026-07-26. `definirReglageEmailAction` et
 * `supprimerReglageEmailAction` existaient, testées, **sans aucune interface qui
 * les appelle** : l'écran affichait les règles en lecture seule. Le réglage
 * « en automatique par client ou en général », demandé explicitement, n'était
 * donc pas atteignable.
 *
 * Deux partis pris :
 *
 *   - **Passer un email en automatique se confirme.** Retenir un email de trop
 *     est réparable ; en laisser partir un qu'on voulait relire ne l'est pas.
 *     Le sens « validation » ne demande rien.
 *   - **Une règle se retire, elle ne s'inverse pas.** Supprimer fait retomber le
 *     périmètre sur la règle plus générale — c'est le comportement attendu, et
 *     il est plus lisible qu'un « mode = défaut » qui serait un troisième état.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult<T> = { data: T } | { error: string };

export interface ReglageAffiche {
  id: string;
  scope: "global" | "client";
  clientNom: string | null;
  template: string | null;
  mode: "auto" | "validation";
}

export interface EmailAutomationSettingsProps {
  reglages: readonly ReglageAffiche[];
  clients: readonly { id: string; raisonSociale: string }[];
  /** Natures d'email réglables — tirées des noms de jobs réels. */
  templates: readonly string[];
  definirAction: (input: {
    scope: "global" | "client";
    clientId?: string | null;
    template?: string | null;
    mode: "auto" | "validation";
  }) => Promise<ActionResult<{ id: string }>>;
  supprimerAction: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}

const champ =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const label =
  "mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]";

export function EmailAutomationSettings({
  reglages,
  clients,
  templates,
  definirAction,
  supprimerAction,
}: EmailAutomationSettingsProps) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [scope, setScope] = useState<"global" | "client">("global");
  const [clientId, setClientId] = useState<string>("");
  const [template, setTemplate] = useState<string>("");
  const [mode, setMode] = useState<"auto" | "validation">("validation");

  function enregistrer() {
    setErreur(null);
    if (scope === "client" && clientId === "") {
      setErreur("Choisissez le client concerné.");
      return;
    }
    if (mode === "auto") {
      const cible = scope === "global" ? "TOUS les clients" : "ce client";
      const nature = template === "" ? "toutes les natures d'email" : template;
      const ok = window.confirm(
        `Passer ${nature} en envoi AUTOMATIQUE pour ${cible} ?\n\nCes emails partiront sans passer par votre relecture. Un email envoyé ne se rappelle pas.`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await definirAction({
        scope,
        clientId: scope === "client" ? clientId : null,
        template: template === "" ? null : template,
        mode,
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setClientId("");
      setTemplate("");
      router.refresh();
    });
  }

  function supprimer(id: string) {
    setErreur(null);
    startTransition(async () => {
      const r = await supprimerAction({ id });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      {reglages.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune règle personnalisée : le comportement par défaut s&apos;applique.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-2)]">
          {reglages.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
            >
              <span className="font-medium text-[color:var(--color-admin-fg)]">
                {r.scope === "global" ? "Tous les clients" : (r.clientNom ?? "—")}
              </span>
              <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {r.template ?? "toutes natures d'email"}
              </span>
              <span
                className={
                  r.mode === "auto"
                    ? "text-[color:var(--color-admin-success)]"
                    : "text-[color:var(--color-admin-warning)]"
                }
              >
                {r.mode === "auto" ? "envoi automatique" : "validation requise"}
              </span>
              <button
                type="button"
                onClick={() => supprimer(r.id)}
                disabled={enCours}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline disabled:opacity-50"
              >
                retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-[var(--space-admin-3)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4)] sm:grid-cols-4">
        <div>
          <label className={label} htmlFor="reglage-scope">
            Portée
          </label>
          <select
            id="reglage-scope"
            className={champ}
            value={scope}
            disabled={enCours}
            onChange={(e) => setScope(e.target.value as "global" | "client")}
          >
            <option value="global">Tous les clients</option>
            <option value="client">Un client précis</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="reglage-client">
            Client
          </label>
          <select
            id="reglage-client"
            className={champ}
            value={clientId}
            disabled={enCours || scope === "global"}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="reglage-template">
            Nature d&apos;email
          </label>
          <select
            id="reglage-template"
            className={champ}
            value={template}
            disabled={enCours}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">Toutes</option>
            {templates.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="reglage-mode">
            Mode
          </label>
          <select
            id="reglage-mode"
            className={champ}
            value={mode}
            disabled={enCours}
            onChange={(e) => setMode(e.target.value as "auto" | "validation")}
          >
            <option value="validation">Validation requise</option>
            <option value="auto">Envoi automatique</option>
          </select>
        </div>
      </div>

      {erreur !== null && (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          {erreur}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent-fg)] disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer la règle"}
        </button>
      </div>
    </div>
  );
}
