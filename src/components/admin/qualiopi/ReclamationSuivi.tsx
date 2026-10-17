"use client";
// use-client: ajout d'une étape datée (formulaire, useTransition) + confirmation avant inscription.

/**
 * ReclamationSuivi — le suivi daté d'une réclamation (chantier QNC, L09).
 *
 * Affiche le journal des étapes (date du serveur à l'heure de Paris, auteur
 * réel), les deux échéances en jours ouvrés, la session rattachée par
 * l'inscription, les actions d'amélioration qui la citent et l'état de l'e-mail
 * de réponse dans la corbeille. Propose seulement les étapes qui peuvent suivre.
 *
 * Zéro appel DB côté client : tout arrive du Server Component.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";
import type { ajouterEtapeReclamationAction } from "@/server/actions/qualiopi/reclamations";
import { CONTENU_MIN, LIBELLE_ETAPE } from "@/server/qualiopi/reclamations/cycle";
import type { EtapeCode, EtatEcheance } from "@/server/qualiopi/reclamations/echeances";

type EtapeAjoutable = Exclude<EtapeCode, "reception">;

const DATE_HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});
const DATE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const LIBELLE_ECHEANCE: Record<EtatEcheance, string> = {
  fait: "fait",
  dans_les_temps: "dans les temps",
  proche: "échéance proche",
  depassee: "échéance dépassée",
};

const CLASSE_ECHEANCE: Record<EtatEcheance, string> = {
  fait: "text-[color:var(--color-admin-success)]",
  dans_les_temps: "text-[color:var(--color-admin-fg-soft)]",
  proche: "text-[color:var(--color-admin-warning)]",
  depassee: "font-semibold text-[color:var(--color-admin-error)]",
};

const LIBELLE_EMAIL: Record<string, string> = {
  a_valider: "à valider dans la corbeille des e-mails",
  approuve: "approuvé, en cours d'envoi",
  envoye: "envoyé",
  refuse: "refusé dans la corbeille",
};

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

export interface ReclamationSuiviProps {
  reclamationId: string;
  numero: string;
  etapes: ReadonlyArray<{
    id: string;
    etape: EtapeCode;
    contenu: string;
    auteurNom: string;
    creeLe: Date;
  }>;
  possibles: ReadonlyArray<EtapeCode>;
  echeances: {
    accuse: EtatEcheance;
    reponse: EtatEcheance;
    accuseAvant: Date;
    reponseAvant: Date;
  };
  session: { libelle: string; href: string } | null;
  stagiaire: string | null;
  ameliorations: ReadonlyArray<{ id: string; numero: string; action: string }>;
  emailsReponse: ReadonlyArray<{ statut: string; creeLe: Date }>;
  /** Où ouvrir une action d'amélioration (registre AXI-AMC). */
  hrefAmelioration: string;
  ajouterEtapeAction: typeof ajouterEtapeReclamationAction;
}

export function ReclamationSuivi(props: ReclamationSuiviProps): React.ReactElement {
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
    <div className="flex min-w-72 flex-col gap-[var(--space-admin-3)]">
      {dialogue}
      <dl className={`${petitCls} grid grid-cols-[auto_1fr] gap-x-[var(--space-admin-2)]`}>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Accusé</dt>
        <dd className={CLASSE_ECHEANCE[props.echeances.accuse]}>
          {LIBELLE_ECHEANCE[props.echeances.accuse]}
          {props.echeances.accuse !== "fait"
            ? ` — au plus tard le ${DATE_PARIS.format(props.echeances.accuseAvant)}`
            : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Réponse</dt>
        <dd className={CLASSE_ECHEANCE[props.echeances.reponse]}>
          {LIBELLE_ECHEANCE[props.echeances.reponse]}
          {props.echeances.reponse !== "fait"
            ? ` — au plus tard le ${DATE_PARIS.format(props.echeances.reponseAvant)}`
            : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Session</dt>
        <dd>
          {props.session ? (
            <a
              href={props.session.href}
              className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              {props.session.libelle}
            </a>
          ) : (
            "non rattachée"
          )}
          {props.stagiaire ? ` · ${props.stagiaire}` : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Amélioration</dt>
        <dd>
          {props.ameliorations.length > 0
            ? props.ameliorations.map((a) => a.numero).join(", ")
            : "aucune action liée"}{" "}
          <a
            href={props.hrefAmelioration}
            className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            (registre d&apos;amélioration)
          </a>
        </dd>
        {props.emailsReponse.length > 0 && (
          <>
            <dt className="text-[color:var(--color-admin-fg-muted)]">E-mail</dt>
            <dd>
              {props.emailsReponse
                .map(
                  (m) =>
                    `${LIBELLE_EMAIL[m.statut] ?? m.statut} (${DATE_HEURE_PARIS.format(m.creeLe)})`,
                )
                .join(" · ")}
            </dd>
          </>
        )}
      </dl>

      <ol className="flex flex-col gap-[var(--space-admin-2)] border-l border-[color:var(--color-admin-border)] pl-[var(--space-admin-3)]">
        {props.etapes.map((e) => (
          <li key={e.id} className={petitCls}>
            <span className="block font-medium">{LIBELLE_ETAPE[e.etape]}</span>
            <span className="block text-[color:var(--color-admin-fg-muted)]">
              {DATE_HEURE_PARIS.format(e.creeLe)} — {e.auteurNom}
            </span>
            <span className="whitespace-pre-line">{e.contenu}</span>
          </li>
        ))}
      </ol>

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
    </div>
  );
}
