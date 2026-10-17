"use client";
// use-client: ouverture d'une action AXI-AMC et ajout d'étapes via useTransition + Server Actions.

/**
 * RegistreAmeliorationPanel — le registre des actions d'amélioration AXI-AMC
 * (chantier QNC, L10 ; indicateur 32). Affiché seulement quand
 * `qualiopi.amelioration.actif` est allumé.
 *
 * Rien ne se modifie : une action s'ouvre (numéro, origine, constat, action),
 * puis vit par ses étapes, chacune datée par le serveur et signée de son auteur.
 * Les règles (responsable et échéance, motif d'abandon, efficacité après
 * réalisation) sont celles du serveur (`etapes-amc.ts`) ; l'écran les annonce.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ajouterEtapeAmeliorationAction,
  ouvrirActionAmeliorationAction,
} from "@/server/actions/qualiopi/amelioration";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const texteDiscret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

type Origine =
  "reclamation" | "incident" | "appreciation" | "revue_direction" | "veille" | "audit" | "autre";
type Etape = "mise_en_oeuvre" | "realisee" | "efficacite_verifiee" | "abandonnee" | "note";

const ORIGINES: ReadonlyArray<[Origine, string]> = [
  ["revue_direction", "Revue de direction"],
  ["reclamation", "Réclamation"],
  ["incident", "Incident"],
  ["appreciation", "Appréciation"],
  ["veille", "Veille"],
  ["audit", "Audit"],
  ["autre", "Autre"],
];

const ETAPES: ReadonlyArray<[Etape, string]> = [
  ["mise_en_oeuvre", "Mise en œuvre (responsable et échéance)"],
  ["realisee", "Réalisée (ce qui a été fait, pièce modifiée)"],
  ["efficacite_verifiee", "Efficacité vérifiée (comment)"],
  ["abandonnee", "Abandonnée (motif obligatoire)"],
  ["note", "Note de suivi"],
];

export interface ActionAmcAffichee {
  id: string;
  numero: string;
  origineLibelle: string;
  constat: string;
  action: string;
  auteurNom: string;
  creeLe: string;
  etat: string;
  close: boolean;
  etapes: ReadonlyArray<{
    libelle: string;
    commentaire: string;
    auteurNom: string;
    creeLe: string;
  }>;
}

export interface RegistreAmeliorationPanelProps {
  actions: ReadonlyArray<ActionAmcAffichee>;
  /** Pré-remplit l'origine « revue de direction » sur la revue de l'année. */
  revueId: string | null;
  ouvrirAction: typeof ouvrirActionAmeliorationAction;
  ajouterEtapeAction: typeof ajouterEtapeAmeliorationAction;
}

function FormulaireEtape({
  actionId,
  close,
  ajouterEtapeAction,
}: {
  actionId: string;
  close: boolean;
  ajouterEtapeAction: typeof ajouterEtapeAmeliorationAction;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [etape, setEtape] = useState<Etape>(close ? "note" : "mise_en_oeuvre");
  const [commentaire, setCommentaire] = useState("");
  const [responsable, setResponsable] = useState("");
  const [echeance, setEcheance] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await ajouterEtapeAction({
            actionId,
            etape,
            commentaire,
            ...(etape === "mise_en_oeuvre" ? { responsable, echeance } : {}),
          });
          if ("error" in r) setError(r.error);
          else {
            setCommentaire("");
            router.refresh();
          }
        });
      }}
    >
      <div>
        <label htmlFor={`amc-etape-${actionId}`} className={labelCls}>
          Étape
        </label>
        <select
          id={`amc-etape-${actionId}`}
          value={etape}
          onChange={(e) => setEtape(e.target.value as Etape)}
          disabled={isPending}
          className={inputCls}
        >
          {ETAPES.filter(([v]) => !close || v === "note").map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {etape === "mise_en_oeuvre" && (
        <div className="grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-2">
          <div>
            <label htmlFor={`amc-responsable-${actionId}`} className={labelCls}>
              Responsable
            </label>
            <input
              id={`amc-responsable-${actionId}`}
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              disabled={isPending}
              required
              maxLength={150}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`amc-echeance-${actionId}`} className={labelCls}>
              Échéance
            </label>
            <input
              id={`amc-echeance-${actionId}`}
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              disabled={isPending}
              required
              className={inputCls}
            />
          </div>
        </div>
      )}
      <div>
        <label htmlFor={`amc-commentaire-${actionId}`} className={labelCls}>
          Commentaire
        </label>
        <textarea
          id={`amc-commentaire-${actionId}`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          disabled={isPending}
          rows={2}
          className={inputCls}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      <button type="submit" disabled={isPending} className="admin-button self-start">
        {isPending ? "Enregistrement…" : "Ajouter l'étape"}
      </button>
    </form>
  );
}

export function RegistreAmeliorationPanel({
  actions,
  revueId,
  ouvrirAction,
  ajouterEtapeAction,
}: RegistreAmeliorationPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [origine, setOrigine] = useState<Origine>("revue_direction");
  const [constat, setConstat] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="mt-[var(--space-admin-8)]">
      <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Registre des actions d&apos;amélioration (AXI-AMC)
      </h2>
      <p className={`mb-[var(--space-admin-4)] ${texteDiscret}`}>
        La seule source du plan d&apos;actions (indicateur 32). Rien ne se modifie ni ne
        s&apos;efface : chaque étape s&apos;ajoute, datée par le serveur (heure de Paris) et signée
        de son auteur.
      </p>

      <form
        className="mb-[var(--space-admin-6)] flex max-w-2xl flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const r = await ouvrirAction({
              origine,
              origineRefId: origine === "revue_direction" ? revueId : null,
              constat,
              action,
            });
            if ("error" in r) setError(r.error);
            else {
              setConstat("");
              setAction("");
              router.refresh();
            }
          });
        }}
      >
        <div>
          <label htmlFor="amc-origine" className={labelCls}>
            Origine
          </label>
          <select
            id="amc-origine"
            value={origine}
            onChange={(e) => setOrigine(e.target.value as Origine)}
            disabled={isPending}
            className={inputCls}
          >
            {ORIGINES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="amc-constat" className={labelCls}>
            Constat
          </label>
          <textarea
            id="amc-constat"
            value={constat}
            onChange={(e) => setConstat(e.target.value)}
            disabled={isPending}
            required
            rows={2}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="amc-action" className={labelCls}>
            Action décidée
          </label>
          <textarea
            id="amc-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={isPending}
            required
            rows={2}
            className={inputCls}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={isPending} className="admin-button self-start">
          {isPending ? "Ouverture…" : "Ouvrir l'action"}
        </button>
      </form>

      {actions.length === 0 ? (
        <p className={texteDiscret}>Aucune action ouverte au registre.</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {actions.map((a) => (
            <li
              key={a.id}
              className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-admin-2)]">
                <span className="font-medium text-[color:var(--color-admin-fg)]">
                  {a.numero} — {a.action}
                </span>
                <span className={texteDiscret}>{a.etat}</span>
              </div>
              <p className={texteDiscret}>
                {a.origineLibelle} · ouverte le {a.creeLe} par {a.auteurNom}
              </p>
              <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] whitespace-pre-line text-[color:var(--color-admin-fg)]">
                {a.constat}
              </p>
              {a.etapes.length > 0 && (
                <ol className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-1)]">
                  {a.etapes.map((e, i) => (
                    <li key={i} className={texteDiscret}>
                      <span className="font-medium">{e.libelle}</span> — {e.creeLe}, {e.auteurNom}
                      {e.commentaire !== "" ? ` : ${e.commentaire}` : ""}
                    </li>
                  ))}
                </ol>
              )}
              <FormulaireEtape
                actionId={a.id}
                close={a.close}
                ajouterEtapeAction={ajouterEtapeAction}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
