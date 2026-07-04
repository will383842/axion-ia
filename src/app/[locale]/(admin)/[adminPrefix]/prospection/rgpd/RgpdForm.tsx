"use client";
// use-client: formulaire opposition (opt-out) appelant une Server Action
// Justification "use client" : formulaire d'opposition (opt-out) appelant une
// Server Action — état + feedback requis.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitProspectionOptOut } from "@/server/actions/prospection/rgpd";

const TYPES = ["siren", "email", "domaine", "personKey"] as const;

export function RgpdForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<(typeof TYPES)[number]>("siren");
  const [value, setValue] = useState("");
  const [raison, setRaison] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        await submitProspectionOptOut(type, value, raison || undefined);
        setValue("");
        setMsg("Opposition enregistrée et propagée.");
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="admin-form"
      style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}
    >
      <label className="admin-form-field">
        <span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-form-field">
        <span>Valeur</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          placeholder="SIREN / email / domaine"
        />
      </label>
      <label className="admin-form-field">
        <span>Raison (optionnel)</span>
        <input value={raison} onChange={(e) => setRaison(e.target.value)} />
      </label>
      <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
        {isPending ? "…" : "Enregistrer l'opposition"}
      </button>
      {msg && (
        <p className="admin-muted" role="status">
          {msg}
        </p>
      )}
    </form>
  );
}
