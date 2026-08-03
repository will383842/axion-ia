"use client";
// use-client: formulaire de création de séance coaching (useState/useTransition/router).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionAction } from "@/server/actions/formateur/coaching.actions";
import { COACHING_INTERVENTIONS } from "@/server/formateur/coaching-options";

export function NewSessionForm(): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(COACHING_INTERVENTIONS[0]?.slug ?? "");
  const [date, setDate] = useState("");
  const [nom, setNom] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white"
      >
        + Nouvelle séance
      </button>
    );
  }

  function submit() {
    setError(null);
    if (!date) {
      setError("Date requise.");
      return;
    }
    startTransition(async () => {
      const res = await createSessionAction({
        interventionSlug: slug,
        dateSeance: date,
        beneficiaireNom: nom.trim() || undefined,
        beneficiaireEntreprise: entreprise.trim() || undefined,
        beneficiaireEmail: email.trim() || "",
      });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Erreur.");
        return;
      }
      router.push(`/fr/espace-formateur/seances/${res.id}`);
    });
  }

  return (
    <div className="border-border bg-sand space-y-3 rounded-lg border p-4">
      <h2 className="text-mocha text-sm font-semibold">Nouvelle séance</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-mocha text-xs font-medium">
          Prestation
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-border mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          >
            {COACHING_INTERVENTIONS.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-mocha text-xs font-medium">
          Date de la séance
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-border mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-mocha text-xs font-medium">
          Bénéficiaire (nom)
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="border-border mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-mocha text-xs font-medium">
          Entreprise
          <input
            type="text"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            className="border-border mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-mocha text-xs font-medium sm:col-span-2">
          E-mail bénéficiaire (optionnel)
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border mt-1 block w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {error ? <p className="text-error text-xs">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer la séance"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-fg-muted rounded-md px-3 py-2 text-sm hover:underline"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
