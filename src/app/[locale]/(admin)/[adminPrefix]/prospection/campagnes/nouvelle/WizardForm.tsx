"use client";
// use-client: wizard campagne interactif (selections + Server Action)
// Justification "use client" : wizard interactif (sélections multi-critères +
// soumission Server Action) — état local requis. Aucune donnée sensible côté client.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SECTEURS, TAILLES } from "@/lib/prospection/enums";
import { createProspectionCampaign } from "@/server/actions/prospection/campaigns";

export function WizardForm({ base }: { base: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [departements, setDepartements] = useState("38");
  const [secteurs, setSecteurs] = useState<string[]>(["btp", "sante"]);
  const [tailles, setTailles] = useState<string[]>(["PME"]);
  const [enrichirContacts, setEnrichirContacts] = useState(true);
  const [enrichirPersonnes, setEnrichirPersonnes] = useState(true);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await createProspectionCampaign({
          nom,
          departements: departements
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
          secteurs,
          nafCodes: [],
          tailles,
          enrichirContacts,
          enrichirPersonnes,
        });
        router.push(`${base}/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de création");
      }
    });
  }

  return (
    <form onSubmit={submit} className="admin-form">
      <label className="admin-form-field">
        <span>Nom de la campagne</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          maxLength={200}
          placeholder="Pilote Isère · BTP + Santé"
        />
      </label>

      <label className="admin-form-field">
        <span>Départements (séparés par des virgules)</span>
        <input
          value={departements}
          onChange={(e) => setDepartements(e.target.value)}
          required
          placeholder="38, 69"
        />
      </label>

      <fieldset className="admin-form-field">
        <legend>Secteurs</legend>
        {SECTEURS.filter((s) => s !== "autre").map((s) => (
          <label key={s} className="admin-checkbox">
            <input
              type="checkbox"
              checked={secteurs.includes(s)}
              onChange={() => toggle(secteurs, s, setSecteurs)}
            />{" "}
            {s}
          </label>
        ))}
      </fieldset>

      <fieldset className="admin-form-field">
        <legend>Tailles</legend>
        {TAILLES.map((t) => (
          <label key={t} className="admin-checkbox">
            <input
              type="checkbox"
              checked={tailles.includes(t)}
              onChange={() => toggle(tailles, t, setTailles)}
            />{" "}
            {t}
          </label>
        ))}
      </fieldset>

      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={enrichirContacts}
          onChange={(e) => setEnrichirContacts(e.target.checked)}
        />{" "}
        Enrichir les contacts (email/téléphone)
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={enrichirPersonnes}
          onChange={(e) => setEnrichirPersonnes(e.target.checked)}
        />{" "}
        Enrichir les responsables (pages équipe)
      </label>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
        {isPending ? "Création…" : "Créer la campagne (brouillon)"}
      </button>
    </form>
  );
}
