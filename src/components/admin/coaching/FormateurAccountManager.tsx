"use client";
// use-client: gestion des comptes formateurs (toggle actif + envoi lien, useTransition).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setFormateurActifAction,
  sendFormateurLinkAction,
} from "@/server/actions/coaching-admin/formateurs.actions";

interface Formateur {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  statut: string;
  region: string | null;
  actif: boolean;
  lastFormateurLoginAt: string | null;
  sessionsCount: number;
}

export function FormateurAccountManager({
  formateurs,
}: {
  formateurs: Formateur[];
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(id: string, actif: boolean) {
    setMsg(null);
    startTransition(async () => {
      await setFormateurActifAction({ trainerId: id, actif });
      router.refresh();
    });
  }

  function sendLink(id: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await sendFormateurLinkAction({ trainerId: id });
      setMsg(res.ok ? "Lien de connexion envoyé." : (res.error ?? "Erreur."));
    });
  }

  if (formateurs.length === 0) {
    return (
      <p className="text-fg-muted text-sm">Aucun formateur. Créez-en via Formation / Qualiopi.</p>
    );
  }

  return (
    <div>
      {msg ? <p className="text-success mb-3 text-sm">{msg}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-fg-muted border-b text-left text-xs">
            <th className="py-1.5">Formateur</th>
            <th>E-mail</th>
            <th>Région</th>
            <th className="text-right">Séances</th>
            <th>Dernière connexion</th>
            <th>Compte</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {formateurs.map((f) => (
            <tr key={f.id} className="border-sand border-b">
              <td className="py-1.5">
                {f.prenom} {f.nom}
              </td>
              <td>{f.email}</td>
              <td>{f.region ?? "—"}</td>
              <td className="text-right">{f.sessionsCount}</td>
              <td className="text-fg-muted text-xs">
                {f.lastFormateurLoginAt
                  ? new Date(f.lastFormateurLoginAt).toLocaleDateString("fr-FR")
                  : "jamais"}
              </td>
              <td>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(f.id, !f.actif)}
                  className={`rounded px-2 py-0.5 text-xs ${f.actif ? "bg-sage-soft text-success" : "bg-sand text-fg-muted"}`}
                >
                  {f.actif ? "Actif" : "Désactivé"}
                </button>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  disabled={pending || !f.actif}
                  onClick={() => sendLink(f.id)}
                  className="text-terracotta text-xs hover:underline disabled:opacity-40"
                >
                  Envoyer un lien
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
