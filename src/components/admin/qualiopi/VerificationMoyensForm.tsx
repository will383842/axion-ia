"use client";
// use-client: cases à cocher + useTransition pour enregistrerVerificationMoyensAction, router.refresh() après succès.

/**
 * VerificationMoyensForm — bloc « Vérification des moyens » d'une session
 * (chantier QNC, lot L07, exigence orale O11). Six points constatés AVANT le
 * début ; chez l'entreprise, ce qu'elle fournit et qui l'a confirmé.
 * L'horodatage est posé par le serveur, jamais par ce formulaire.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { enregistrerVerificationMoyensAction } from "@/server/actions/qualiopi/verification-moyens";

const POINTS = [
  ["salle", "Salle prête"],
  ["wifi", "Wifi fonctionnel"],
  ["projection", "Projection"],
  ["postes", "Postes de travail"],
  ["comptes", "Comptes et accès"],
  ["materielStagiaire", "Matériel du stagiaire"],
] as const;

type Point = (typeof POINTS)[number][0];

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

export function VerificationMoyensForm({
  sessionId,
  chezEntreprise,
}: {
  sessionId: string;
  chezEntreprise: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [coches, setCoches] = useState<Record<Point, boolean>>({
    salle: false,
    wifi: false,
    projection: false,
    postes: false,
    comptes: false,
    materielStagiaire: false,
  });
  const [fourni, setFourni] = useState("");
  const [par, setPar] = useState("");
  const [le, setLe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const fournis = fourni
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x !== "");
      const r = await enregistrerVerificationMoyensAction({
        sessionId,
        ...coches,
        ...(chezEntreprise
          ? {
              fourniParEntreprise: fournis,
              ...(par.trim() !== "" && le.trim() !== ""
                ? { confirmationEntreprise: { par, le } }
                : {}),
            }
          : {}),
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-[var(--space-admin-3)]">
      <fieldset className="grid gap-[var(--space-admin-2)] sm:grid-cols-2">
        <legend className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
          Constaté avant le début de la session
        </legend>
        {POINTS.map(([cle, libelle]) => (
          <label
            key={cle}
            className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
          >
            <input
              type="checkbox"
              checked={coches[cle]}
              disabled={isPending}
              onChange={(e) => setCoches((c) => ({ ...c, [cle]: e.target.checked }))}
            />
            {libelle}
          </label>
        ))}
      </fieldset>

      {chezEntreprise && (
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <label
            htmlFor="verif-fourni"
            className="text-[length:var(--text-admin-sm)] font-semibold"
          >
            Ce que l&apos;entreprise fournit (un élément par ligne)
          </label>
          <textarea
            id="verif-fourni"
            rows={3}
            value={fourni}
            disabled={isPending}
            onChange={(e) => setFourni(e.target.value)}
            className={inputCls}
          />
          <label htmlFor="verif-par" className="text-[length:var(--text-admin-sm)] font-semibold">
            Confirmé par (nom et fonction)
          </label>
          <input
            id="verif-par"
            type="text"
            value={par}
            disabled={isPending}
            onChange={(e) => setPar(e.target.value)}
            className={inputCls}
          />
          <label htmlFor="verif-le" className="text-[length:var(--text-admin-sm)] font-semibold">
            Confirmé le
          </label>
          <input
            id="verif-le"
            type="date"
            value={le}
            disabled={isPending}
            onChange={(e) => setLe(e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {ok && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
        >
          Vérification enregistrée, datée par le serveur.
        </p>
      )}
      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer la vérification"}
      </button>
    </form>
  );
}
