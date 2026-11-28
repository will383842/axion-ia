"use client";
// use-client: formulaire d'envoi et boutons « Renvoyer » / « Révoquer » qui appellent des actions serveur.

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  envoyerQuestionnaireAction,
  renvoyerQuestionnaireAction,
  revoquerQuestionnaireAction,
} from "@/server/actions/equipe/invitations";

export interface LigneInvitation {
  id: string;
  categorieLibelle: string;
  prenom: string | null;
  statut: "envoyee" | "ouverte" | "remplie" | "expiree" | "revoquee";
  creeLe: string;
  expireLe: string;
  active: boolean;
  renvoyable: boolean;
}

const LIBELLE_STATUT: Record<LigneInvitation["statut"], string> = {
  envoyee: "Envoyée",
  ouverte: "Ouverte",
  remplie: "Remplie",
  expiree: "Expirée",
  revoquee: "Révoquée",
};

const BOUTON =
  "rounded border border-terracotta text-terracotta hover:bg-terracotta px-3 py-1 text-sm hover:text-white disabled:opacity-50";

export function InvitationsQuestionnaire({
  categories,
  invitations,
}: {
  categories: ReadonlyArray<{ slug: string; libelle: string }>;
  invitations: ReadonlyArray<LigneInvitation>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function executer(action: () => Promise<{ ok: boolean; erreur?: string }>, succes: string) {
    demarrer(async () => {
      const r = await action();
      setMessage(r.ok ? { ok: true, texte: succes } : { ok: false, texte: r.erreur ?? "Échec." });
      if (r.ok) router.refresh();
    });
  }

  function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    executer(
      () =>
        envoyerQuestionnaireAction({
          categorie: d.get("categorie"),
          email: d.get("email"),
          prenom: (d.get("prenom") as string) || undefined,
        }),
      "Questionnaire envoyé par e-mail.",
    );
    form.reset();
  }

  return (
    <section className="mb-8" aria-labelledby="titre-invitations">
      <h2 id="titre-invitations" className="text-terracotta mb-2 text-lg font-semibold">
        Envoyer le questionnaire
      </h2>
      <form onSubmit={envoyer} className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Catégorie
          <select name="categorie" required defaultValue="" className="border px-2 py-1">
            <option value="" disabled>
              Choisir…
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Adresse e-mail
          <input name="email" type="email" required maxLength={254} className="border px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Prénom (facultatif)
          <input name="prenom" type="text" maxLength={80} className="border px-2 py-1" />
        </label>
        <button type="submit" disabled={enCours} className={BOUTON}>
          Envoyer le questionnaire
        </button>
      </form>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "" : "text-terracotta"}>
          {message.texte}
        </p>
      ) : null}
      {invitations.length === 0 ? (
        <p className="text-sm">Aucune invitation pour le moment.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Prénom</th>
              <th>Catégorie</th>
              <th>Statut</th>
              <th>Envoyée le</th>
              <th>Expire le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.prenom ?? "—"}</td>
                <td>{i.categorieLibelle}</td>
                <td>{LIBELLE_STATUT[i.statut]}</td>
                <td>{i.creeLe}</td>
                <td>{i.expireLe}</td>
                <td className="flex gap-2">
                  {i.renvoyable ? (
                    <button
                      type="button"
                      className={BOUTON}
                      disabled={enCours}
                      onClick={() =>
                        executer(() => renvoyerQuestionnaireAction(i.id), "Nouveau lien envoyé.")
                      }
                    >
                      Renvoyer
                    </button>
                  ) : null}
                  {i.active ? (
                    <button
                      type="button"
                      className={BOUTON}
                      disabled={enCours}
                      onClick={() =>
                        executer(() => revoquerQuestionnaireAction(i.id), "Invitation révoquée.")
                      }
                    >
                      Révoquer
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
