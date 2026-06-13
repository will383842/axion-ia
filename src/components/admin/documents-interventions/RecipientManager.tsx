"use client";

// Gestion des listes de destinataires e-mail (formateurs / commerciaux) :
// ajout, activation/désactivation, suppression. Aucun compte requis.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRecipientAction,
  toggleRecipientAction,
  deleteRecipientAction,
} from "@/server/actions/intervention-documents/recipients.actions";

interface Recipient {
  id: string;
  email: string;
  nom: string | null;
  role: string;
  famille: string | null;
  interventionSlug: string | null;
  actif: boolean;
}

const FAMILLE_LABEL: Record<string, string> = {
  formation: "Formations",
  un_a_un: "1-to-1",
  audit: "Audits",
};

export function RecipientManager({ recipients }: { recipients: Recipient[] }): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<"formateur" | "commercial">("formateur");
  const [famille, setFamille] = useState<"" | "formation" | "un_a_un" | "audit">("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!email.trim()) {
      setError("E-mail requis.");
      return;
    }
    startTransition(async () => {
      const res = await createRecipientAction({
        email: email.trim(),
        nom: nom.trim() || undefined,
        role,
        famille: famille || null,
        interventionSlug: slug.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setEmail("");
      setNom("");
      setSlug("");
      router.refresh();
    });
  }

  function toggle(id: string, actif: boolean) {
    startTransition(async () => {
      await toggleRecipientAction({ id, actif });
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteRecipientAction({ id });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="border-border bg-bg mb-6 flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <label className="text-mocha text-xs font-medium">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border mt-1 block w-56 rounded border px-2 py-1 text-xs"
            placeholder="formateur@exemple.fr"
          />
        </label>
        <label className="text-mocha text-xs font-medium">
          Nom (optionnel)
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="border-border mt-1 block w-40 rounded border px-2 py-1 text-xs"
          />
        </label>
        <label className="text-mocha text-xs font-medium">
          Rôle
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "formateur" | "commercial")}
            className="border-border mt-1 block rounded border px-2 py-1 text-xs"
          >
            <option value="formateur">Formateur</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="text-mocha text-xs font-medium">
          Périmètre
          <select
            value={famille}
            onChange={(e) => setFamille(e.target.value as typeof famille)}
            className="border-border mt-1 block rounded border px-2 py-1 text-xs"
          >
            <option value="">Toutes familles</option>
            <option value="formation">Formations</option>
            <option value="un_a_un">1-to-1</option>
            <option value="audit">Audits</option>
          </select>
        </label>
        <label className="text-mocha text-xs font-medium">
          Prestation (slug, optionnel)
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-border mt-1 block w-40 rounded border px-2 py-1 text-xs"
            placeholder="ia-express"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="bg-terracotta rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {error ? <p className="text-error mb-3 text-xs">{error}</p> : null}

      {recipients.length === 0 ? (
        <p className="text-fg-muted text-sm">Aucun destinataire. Ajoutez-en ci-dessus.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-border text-fg-muted border-b text-left">
              <th className="py-1">E-mail</th>
              <th>Nom</th>
              <th>Rôle</th>
              <th>Périmètre</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} className="border-sand border-b">
                <td className="py-1.5">{r.email}</td>
                <td>{r.nom ?? "—"}</td>
                <td>{r.role === "commercial" ? "Commercial" : "Formateur"}</td>
                <td>
                  {r.famille ? (FAMILLE_LABEL[r.famille] ?? r.famille) : "Toutes"}
                  {r.interventionSlug ? ` · ${r.interventionSlug}` : ""}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(r.id, !r.actif)}
                    className={`rounded px-1.5 py-0.5 ${r.actif ? "bg-sage-soft text-success" : "bg-sand text-fg-muted"}`}
                  >
                    {r.actif ? "Actif" : "Inactif"}
                  </button>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    className="text-error hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
