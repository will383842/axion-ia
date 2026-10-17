"use client";
// use-client: décider / corriger / archiver une entrée de veille tracée via useTransition + Server Actions.

/**
 * VeilleTraceeActions — les trois gestes d'une veille tracée (chantier QNC, L10).
 *
 * Remplace « Modifier » et « Supprimer » quand `qualiopi.veille.actif` est
 * allumé : la table est en ajout seul, rien ne se réécrit.
 *   - Décider  : une PERSONNE décide la suite et nomme la pièce modifiée ;
 *   - Corriger : correction par ajout, motivée. Ni le type ni la date de
 *     l'information ne sont proposés : ils ne se corrigent pas ;
 *   - Archiver : remplace la suppression, motivé. La ligne reste au journal.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  archiverVeilleAction,
  corrigerVeilleAction,
  deciderVeilleAction,
} from "@/server/actions/qualiopi/veille";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const boutonCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80 disabled:opacity-50";

export interface VeilleTraceeActionsProps {
  veille: {
    id: string;
    source: string;
    titre: string;
    contenu: string;
    impact: string | null;
    decidee: boolean;
  };
  deciderAction: typeof deciderVeilleAction;
  corrigerAction: typeof corrigerVeilleAction;
  archiverAction: typeof archiverVeilleAction;
}

type Panneau = "aucun" | "decider" | "corriger" | "archiver";

export function VeilleTraceeActions({
  veille,
  deciderAction,
  corrigerAction,
  archiverAction,
}: VeilleTraceeActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panneau, setPanneau] = useState<Panneau>("aucun");
  const [error, setError] = useState<string | null>(null);

  const [decision, setDecision] = useState("");
  const [pieceModifiee, setPieceModifiee] = useState("");
  const [source, setSource] = useState(veille.source);
  const [titre, setTitre] = useState(veille.titre);
  const [contenu, setContenu] = useState(veille.contenu);
  const [impact, setImpact] = useState(veille.impact ?? "");
  const [motif, setMotif] = useState("");

  function ouvrir(p: Panneau): void {
    setError(null);
    setMotif("");
    setPanneau(p);
  }

  function envoyer(appel: () => Promise<{ data: unknown } | { error: string }>): void {
    setError(null);
    startTransition(async () => {
      const r = await appel();
      if ("error" in r) {
        setError(r.error);
      } else {
        setPanneau("aucun");
        router.refresh();
      }
    });
  }

  const pied = (libelle: string) => (
    <div className="flex items-center gap-[var(--space-admin-2)]">
      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : libelle}
      </button>
      <button
        type="button"
        onClick={() => setPanneau("aucun")}
        disabled={isPending}
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
      >
        Annuler
      </button>
    </div>
  );

  const erreur = error && (
    <p
      role="alert"
      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
    >
      {error}
    </p>
  );

  const formCls =
    "flex w-full max-w-md flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";

  if (panneau === "decider") {
    return (
      <form
        className={formCls}
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(() => deciderAction({ id: veille.id, decision, pieceModifiee }));
        }}
      >
        <div>
          <label htmlFor={`veille-decision-${veille.id}`} className={labelCls}>
            Décision
          </label>
          <textarea
            id={`veille-decision-${veille.id}`}
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            disabled={isPending}
            required
            minLength={10}
            rows={3}
            placeholder="Ce que l'organisme décide — y compris « aucune suite », motivé."
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={`veille-piece-${veille.id}`} className={labelCls}>
            Pièce modifiée
          </label>
          <input
            id={`veille-piece-${veille.id}`}
            type="text"
            value={pieceModifiee}
            onChange={(e) => setPieceModifiee(e.target.value)}
            disabled={isPending}
            required
            maxLength={300}
            placeholder="Référence ou lien de la pièce mise à jour, ou « aucune »"
            className={inputCls}
          />
        </div>
        {erreur}
        {pied("Enregistrer la décision")}
      </form>
    );
  }

  if (panneau === "corriger") {
    return (
      <form
        className={formCls}
        onSubmit={(e) => {
          e.preventDefault();
          // Ni type ni date : ils ne se corrigent pas, et ne sont donc pas renvoyés.
          envoyer(() => corrigerAction({ id: veille.id, source, titre, contenu, impact, motif }));
        }}
      >
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          La correction s&apos;ajoute : l&apos;entrée d&apos;origine reste lisible, archivée, avec
          ce motif. Le type et la date de l&apos;information ne se corrigent pas.
        </p>
        {(
          [
            ["source", "Source", source, setSource, false],
            ["titre", "Titre", titre, setTitre, false],
            ["contenu", "Analyse", contenu, setContenu, true],
            ["impact", "Impact", impact, setImpact, true],
          ] as const
        ).map(([cle, libelle, valeur, poser, long]) => (
          <div key={cle}>
            <label htmlFor={`veille-corriger-${cle}-${veille.id}`} className={labelCls}>
              {libelle}
            </label>
            {long ? (
              <textarea
                id={`veille-corriger-${cle}-${veille.id}`}
                value={valeur}
                onChange={(e) => poser(e.target.value)}
                disabled={isPending}
                rows={2}
                className={inputCls}
              />
            ) : (
              <input
                id={`veille-corriger-${cle}-${veille.id}`}
                type="text"
                value={valeur}
                onChange={(e) => poser(e.target.value)}
                disabled={isPending}
                required
                maxLength={300}
                className={inputCls}
              />
            )}
          </div>
        ))}
        <div>
          <label htmlFor={`veille-corriger-motif-${veille.id}`} className={labelCls}>
            Motif de la correction
          </label>
          <input
            id={`veille-corriger-motif-${veille.id}`}
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            disabled={isPending}
            required
            minLength={10}
            className={inputCls}
          />
        </div>
        {erreur}
        {pied("Enregistrer la correction")}
      </form>
    );
  }

  if (panneau === "archiver") {
    return (
      <form
        className={formCls}
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(() => archiverAction({ id: veille.id, motif }));
        }}
      >
        <div>
          <label htmlFor={`veille-archiver-motif-${veille.id}`} className={labelCls}>
            Motif de l&apos;archivage
          </label>
          <input
            id={`veille-archiver-motif-${veille.id}`}
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            disabled={isPending}
            required
            minLength={10}
            placeholder="Doublon, information erronée…"
            className={inputCls}
          />
        </div>
        {erreur}
        {pied("Archiver")}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
      <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <button type="button" onClick={() => ouvrir("decider")} className={boutonCls}>
          {veille.decidee ? "Décider à nouveau" : "Décider"}
        </button>
        <button type="button" onClick={() => ouvrir("corriger")} className={boutonCls}>
          Corriger
        </button>
        <button type="button" onClick={() => ouvrir("archiver")} className={boutonCls}>
          Archiver
        </button>
      </div>
      {erreur}
    </div>
  );
}
