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
  formationsCount: number;
}

export function FormateurAccountManager({
  formateurs,
}: {
  formateurs: Formateur[];
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  function toggle(id: string, actif: boolean) {
    setMsg(null);
    startTransition(async () => {
      await setFormateurActifAction({ trainerId: id, actif });
      router.refresh();
    });
  }

  /**
   * 🔴 L'ÉCHEC ÉTAIT PEINT EN VERT. Succès et erreur atterrissaient dans le même
   * `msg`, rendu avec `text-success` : « Compte désactivé : réactivez-le
   * d'abord. » s'affichait exactement comme « Lien de connexion envoyé. » — un
   * lien jamais parti, annoncé comme parti.
   */
  function sendLink(id: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await sendFormateurLinkAction({ trainerId: id });
      setMsg(
        res.ok
          ? { ok: true, texte: "Lien de connexion envoyé." }
          : { ok: false, texte: res.error ?? "L'envoi a échoué." },
      );
    });
  }

  if (formateurs.length === 0) {
    return (
      <p className="text-fg-muted text-sm">Aucun formateur. Créez-en via Formation / Qualiopi.</p>
    );
  }

  return (
    <div>
      {msg ? (
        <p
          role={msg.ok ? "status" : "alert"}
          className={
            msg.ok
              ? "mb-3 text-sm text-[color:var(--color-admin-success-fg)]"
              : "mb-3 text-sm text-[color:var(--color-admin-destructive-fg)]"
          }
        >
          {msg.texte}
        </p>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          {/* 🔴 `pr-3` sur chaque cellule — la table n'avait QUE de l'espacement
              vertical (`py-1.5`). Vu en production le 04/08 : l'en-tête lisait
              « FormationsDernière connexion » et la ligne « 101/08/2026 ». Le
              défaut ne sautait aux yeux que sur ces deux colonnes-là, parce
              qu'un nombre aligné à droite y touche une date alignée à gauche —
              mais toutes les colonnes étaient collées. */}
          <tr className="border-border text-fg-muted border-b text-left text-xs">
            <th className="py-1.5 pr-3">Formateur</th>
            <th className="pr-3">E-mail</th>
            <th className="pr-3">Région</th>
            <th className="pr-3 text-right">Séances 1-to-1</th>
            <th className="pr-3 text-right">Formations</th>
            <th className="pr-3">Dernière connexion</th>
            <th className="pr-3">Compte</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {formateurs.map((f) => (
            <tr key={f.id} className="border-sand border-b">
              <td className="py-1.5 pr-3">
                {f.prenom} {f.nom}
              </td>
              <td className="pr-3">{f.email}</td>
              <td className="pr-3">{f.region ?? "—"}</td>
              <td className="pr-3 text-right">{f.sessionsCount}</td>
              <td className="pr-3 text-right">{f.formationsCount}</td>
              <td className="text-fg-muted pr-3 text-xs">
                {f.lastFormateurLoginAt
                  ? new Date(f.lastFormateurLoginAt).toLocaleDateString("fr-FR")
                  : "jamais"}
              </td>
              <td className="pr-3">
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
