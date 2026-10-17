"use client";
// use-client: ajout d'une étape datée (formulaire, useTransition) + confirmation avant inscription.

/**
 * ReclamationEtapeForm — la seule partie interactive du suivi d'une
 * réclamation (chantier QNC, L09) : choisir l'étape qui peut suivre, l'écrire,
 * confirmer, l'inscrire. Le journal et les échéances sont rendus par le Server
 * Component `ReclamationSuivi` : aucun JavaScript n'est envoyé pour les lire.
 *
 * Toujours monté, même sans étape ajoutable : le message de la dernière
 * inscription (une clôture, par exemple) survit au `router.refresh()`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";
import type { ajouterEtapeReclamationAction } from "@/server/actions/qualiopi/reclamations";
import { CONTENU_MIN, LIBELLE_ETAPE } from "@/server/qualiopi/reclamations/cycle";
import type { EtapeCode } from "@/server/qualiopi/reclamations/echeances";

type EtapeAjoutable = Exclude<EtapeCode, "reception">;

const AIDE_ETAPE: Record<EtapeAjoutable, string> = {
  accuse: "Comment l'accusé a été remis (e-mail, courrier, de vive voix) et quand.",
  analyse: "Ce qui s'est passé, pourquoi, et ce qui est envisagé.",
  reponse:
    "La réponse écrite, telle qu'elle partira. Elle sera signée de votre nom et de votre qualité, puis placée dans la corbeille des e-mails à valider.",
  reexamen: "Ce que la personne conteste, ou pourquoi l'organisme réexamine.",
  cloture: "Pourquoi la réclamation peut être close.",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const petitCls = "text-[length:var(--text-admin-xs)]";

export interface ReclamationEtapeFormProps {
  reclamationId: string;
  numero: string;
  possibles: ReadonlyArray<EtapeCode>;
  ajouterEtapeAction: typeof ajouterEtapeReclamationAction;
}

export function ReclamationEtapeForm(props: ReclamationEtapeFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { demander, dialogue } = useConfirmation();
  const ajoutables = props.possibles.filter((e): e is EtapeAjoutable => e !== "reception");
  const [etape, setEtape] = useState<EtapeAjoutable | "">("");
  const [contenu, setContenu] = useState("");
  const [qualite, setQualite] = useState("");
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (etape === "") return;
    const choisie = etape;
    demander(
      {
        titre: `Inscrire « ${LIBELLE_ETAPE[choisie]} » au journal de ${props.numero}`,
        description:
          choisie === "reponse"
            ? "L'étape est datée par le serveur et signée de votre nom ; elle ne pourra plus être modifiée ni effacée. L'e-mail de réponse attendra votre validation dans la corbeille."
            : "L'étape est datée par le serveur et signée de votre nom ; elle ne pourra plus être modifiée ni effacée.",
        libelleConfirmer: "Inscrire",
      },
      () => enregistrer(choisie),
    );
  }

  function enregistrer(choisie: EtapeAjoutable) {
    setMessage(null);
    startTransition(async () => {
      const r = await props.ajouterEtapeAction({
        id: props.reclamationId,
        etape: choisie,
        contenu,
        ...(choisie === "reponse" ? { signataireQualite: qualite } : {}),
      });
      if ("error" in r) {
        setMessage({ ton: "erreur", texte: r.error });
        return;
      }
      setMessage({
        ton: "ok",
        texte:
          r.data.email === "a_valider"
            ? "Réponse inscrite. L'e-mail attend votre validation dans « E-mails à valider »."
            : r.data.email === "sans_adresse"
              ? "Réponse inscrite. Aucune adresse : remettez-la par courrier et consignez-le."
              : r.data.email === "echec"
                ? "Réponse inscrite, mais l'e-mail n'a pas pu être préparé : remettez-la autrement."
                : "Étape inscrite.",
      });
      setEtape("");
      setContenu("");
      router.refresh();
    });
  }

  return (
    <>
      {dialogue}
      {ajoutables.length > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-admin-2)]">
          <div>
            <label htmlFor={`suivi-${props.reclamationId}-etape`} className={labelCls}>
              Étape suivante
            </label>
            <select
              id={`suivi-${props.reclamationId}-etape`}
              value={etape}
              onChange={(e) => setEtape(e.target.value as EtapeAjoutable | "")}
              disabled={isPending}
              className={inputCls}
            >
              <option value="">— choisir —</option>
              {ajoutables.map((a) => (
                <option key={a} value={a}>
                  {LIBELLE_ETAPE[a]}
                </option>
              ))}
            </select>
          </div>
          {etape !== "" && (
            <>
              <div>
                <label htmlFor={`suivi-${props.reclamationId}-contenu`} className={labelCls}>
                  {LIBELLE_ETAPE[etape]}
                </label>
                <textarea
                  id={`suivi-${props.reclamationId}-contenu`}
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  disabled={isPending}
                  required
                  minLength={CONTENU_MIN}
                  rows={etape === "reponse" ? 6 : 3}
                  className={inputCls}
                />
                <p className={`${petitCls} mt-1 text-[color:var(--color-admin-fg-muted)]`}>
                  {AIDE_ETAPE[etape]}
                </p>
              </div>
              {etape === "reponse" && (
                <div>
                  <label htmlFor={`suivi-${props.reclamationId}-qualite`} className={labelCls}>
                    Votre qualité (signature)
                  </label>
                  <input
                    id={`suivi-${props.reclamationId}-qualite`}
                    type="text"
                    value={qualite}
                    onChange={(e) => setQualite(e.target.value)}
                    disabled={isPending}
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Responsable qualité"
                    className={inputCls}
                  />
                </div>
              )}
              <button type="submit" disabled={isPending} className="admin-button">
                {isPending ? "Inscription…" : "Inscrire l'étape"}
              </button>
            </>
          )}
        </form>
      )}

      {message && (
        <p
          role={message.ton === "erreur" ? "alert" : "status"}
          className={`${petitCls} ${
            message.ton === "erreur"
              ? "text-[color:var(--color-admin-error)]"
              : "text-[color:var(--color-admin-success)]"
          }`}
        >
          {message.texte}
        </p>
      )}
    </>
  );
}
