"use client";
// use-client: édition ligne à ligne des domaines de compétences (ajout, retrait, niveau, date) + Server Action.

/**
 * TrainerCompetencesPanel — domaines de compétences ÉVALUÉS.
 *
 * 🔴 Ce panneau ferme une non-conformité, pas un manque de confort.
 * L'indicateur 21 exige que l'organisme « détermine, mobilise et ÉVALUE les
 * compétences des intervenants ». La structure `{domaine, niveauMaitrise,
 * verifiedAt}` existait en base, la fiche formateur l'imprimait déjà — et aucun
 * écran ne permettait de la remplir. Toute fiche sortait donc avec « — » en
 * niveau et « Non vérifié » en date, sur chaque ligne : lu par un auditeur,
 * c'est l'absence de preuve d'évaluation.
 *
 * La date de vérification est le champ qui COMPTE : c'est elle qui atteste que
 * la maîtrise a été constatée, et non simplement déclarée.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrainerCompetencesAction } from "@/server/actions/qualiopi/trainers";

export interface DomaineCompetenceEdit {
  domaine: string;
  niveauMaitrise: string;
  /** ISO court `YYYY-MM-DD` pour l'input date, ou "". */
  verifiedAt: string;
}

const NIVEAUX: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "— non évalué" },
  { value: "a_developper", label: "À développer" },
  { value: "maitrise", label: "Maîtrise" },
  { value: "expert", label: "Expert" },
];

export function TrainerCompetencesPanel({
  trainerId,
  domainesInitiaux,
}: {
  trainerId: string;
  domainesInitiaux: DomaineCompetenceEdit[];
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lignes, setLignes] = useState<DomaineCompetenceEdit[]>(domainesInitiaux);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function maj(i: number, patch: Partial<DomaineCompetenceEdit>) {
    setLignes((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setSuccess(null);
  }

  function ajouter() {
    setLignes((prev) => [...prev, { domaine: "", niveauMaitrise: "", verifiedAt: "" }]);
    setSuccess(null);
  }

  function retirer(i: number) {
    setLignes((prev) => prev.filter((_, j) => j !== i));
    setSuccess(null);
  }

  function enregistrer() {
    setError(null);
    setSuccess(null);
    // Une ligne sans libellé n'est pas une compétence : on la retire plutôt que
    // de laisser le serveur refuser tout l'enregistrement pour une ligne vide
    // ajoutée par mégarde.
    const utiles = lignes.filter((l) => l.domaine.trim() !== "");
    startTransition(async () => {
      const res = await setTrainerCompetencesAction({ id: trainerId, domaines: utiles });
      if ("error" in res) {
        setError(res.error);
      } else {
        setLignes(utiles);
        const verifies = utiles.filter((l) => l.verifiedAt !== "").length;
        setSuccess(
          `${res.data.nbDomaines} domaine${res.data.nbDomaines > 1 ? "s" : ""} enregistré${res.data.nbDomaines > 1 ? "s" : ""}, dont ${verifies} évalué${verifies > 1 ? "s" : ""} et daté${verifies > 1 ? "s" : ""}.`,
        );
        router.refresh();
      }
    });
  }

  const nonEvalues = lignes.filter((l) => l.domaine.trim() !== "" && l.verifiedAt === "").length;

  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:ring-1 focus:ring-[color:var(--color-admin-accent)] focus:outline-none";

  return (
    <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Domaines de compétences et évaluation
      </h2>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Indicateur 21 : la maîtrise des compétences doit être <strong>vérifiée</strong>, pas
        seulement déclarée. La date de vérification est ce qui l&apos;atteste — elle figure sur la
        fiche formateur remise à l&apos;auditeur.
      </p>

      {lignes.length === 0 ? (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun domaine enregistré.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
          {lignes.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-end gap-[var(--space-admin-2)] sm:grid-cols-[1fr_170px_170px_auto]"
            >
              <label className="flex flex-col gap-[var(--space-admin-1)]">
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  Domaine
                </span>
                <input
                  type="text"
                  value={l.domaine}
                  onChange={(e) => maj(i, { domaine: e.target.value })}
                  disabled={isPending}
                  placeholder="Ex. : IA générative"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-[var(--space-admin-1)]">
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  Niveau de maîtrise
                </span>
                <select
                  value={l.niveauMaitrise}
                  onChange={(e) => maj(i, { niveauMaitrise: e.target.value })}
                  disabled={isPending}
                  className={inputCls}
                >
                  {NIVEAUX.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-[var(--space-admin-1)]">
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  Vérifié le
                </span>
                <input
                  type="date"
                  value={l.verifiedAt}
                  onChange={(e) => maj(i, { verifiedAt: e.target.value })}
                  disabled={isPending}
                  className={inputCls}
                />
              </label>
              <button
                type="button"
                onClick={() => retirer(i)}
                disabled={isPending}
                className="admin-button admin-button-ghost-danger"
                aria-label={`Retirer le domaine ${l.domaine || i + 1}`}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button
          type="button"
          onClick={ajouter}
          disabled={isPending}
          className="admin-button admin-button-ghost"
        >
          + Ajouter un domaine
        </button>
        <button type="button" onClick={enregistrer} disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer les compétences"}
        </button>
      </div>

      {/* On DIT ce qui manquera sur la fiche, avant qu'un auditeur ne le lise. */}
      {nonEvalues > 0 && (
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {nonEvalues} domaine{nonEvalues > 1 ? "s" : ""} sans date de vérification : ils sortiront
          « Non vérifié » sur la fiche formateur.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </section>
  );
}
