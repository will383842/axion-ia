"use client";
// use-client: deux Server Actions (générer / valider) + feedback + useTransition.
// La génération dure plusieurs dizaines de secondes : sans état de transition,
// l'utilisateur reclique et lance deux fois les appels au modèle.
/**
 * PreparationKitSession — le bloc « qu'est-ce qu'il reste à faire pour cette
 * session ».
 *
 * Une seule phrase, un seul bouton. C'est délibéré : ce bloc s'adresse à
 * quelqu'un qui vient de vendre une formation, pas à quelqu'un qui connaît le
 * vocabulaire du projet. Il ne montre jamais l'état brut (`a_valider`), il
 * montre le geste à poser.
 *
 * Zéro appel base côté client : tout arrive en props.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type EtapeKit = "kit_absent" | "a_generer" | "a_valider" | "pret";

export interface PreparationKitSessionProps {
  sessionId: string;
  etape: EtapeKit;
  aFaire: string;
  nbSorties: number;
  valideLe: string | null;
  /** Lien vers l'écran de relecture des sorties. */
  hrefRelecture: string;
  genererAction: (input: {
    sessionId: string;
  }) => Promise<{ data: { produites: number; echecs: number } } | { error: string }>;
  validerAction: (input: {
    sessionId: string;
  }) => Promise<{ data: { valide: true } } | { error: string }>;
}

const encadre =
  "rounded-[var(--radius-admin-md)] border p-[var(--space-admin-4)] " +
  "bg-[color:var(--color-admin-paper)]";

export function PreparationKitSession({
  sessionId,
  etape,
  aFaire,
  nbSorties,
  valideLe,
  hrefRelecture,
  genererAction,
  validerAction,
}: PreparationKitSessionProps): React.ReactElement {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function lancer(quoi: "generer" | "valider") {
    setErreur(null);
    setInfo(null);
    startTransition(async () => {
      const res =
        quoi === "generer"
          ? await genererAction({ sessionId })
          : await validerAction({ sessionId });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      if (quoi === "generer" && "produites" in res.data) {
        setInfo(
          res.data.echecs > 0
            ? `${res.data.produites} sorties produites, ${res.data.echecs} en échec — relisez, puis relancez si besoin.`
            : `${res.data.produites} sorties produites. Relisez-les avant de valider.`,
        );
      } else {
        setInfo("Sorties validées. Le classeur est prêt à imprimer.");
      }
      router.refresh();
    });
  }

  // Le cadre change de couleur avec l'urgence, mais le texte suffit à comprendre :
  // personne ne doit avoir à décoder une bordure.
  const bordure =
    etape === "pret"
      ? "border-[color:var(--color-admin-border)]"
      : "border-[color:var(--color-admin-accent)]";

  return (
    <section className={`${encadre} ${bordure}`}>
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Préparation du kit formateur
      </h2>
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {aFaire}
      </p>

      {etape === "pret" && valideLe !== null ? (
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {nbSorties} sorties validées le {valideLe}.
        </p>
      ) : null}

      {etape === "a_generer" ? (
        <div className="mt-[var(--space-admin-3)]">
          <button
            type="button"
            onClick={() => lancer("generer")}
            disabled={enCours}
            className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-white disabled:opacity-60"
          >
            {enCours ? "Production en cours…" : "Produire les sorties"}
          </button>
          <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Une demande par démonstration, en série : comptez une minute environ.
          </p>
        </div>
      ) : null}

      {etape === "a_valider" ? (
        <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <a
            href={hrefRelecture}
            className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-white"
          >
            Relire les {nbSorties} sorties
          </a>
          <button
            type="button"
            onClick={() => lancer("valider")}
            disabled={enCours}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline disabled:opacity-60"
          >
            Je les ai lues — valider
          </button>
          <button
            type="button"
            onClick={() => lancer("generer")}
            disabled={enCours}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] underline disabled:opacity-60"
          >
            Reproduire
          </button>
        </div>
      ) : null}

      {etape === "kit_absent" ? (
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Publier le classeur d&apos;abord :{" "}
          <code>pnpm tsx scripts/kit-formateur/publier-vers-r2.ts</code>
        </p>
      ) : null}

      {erreur !== null ? (
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger-fg)]">
          {erreur}
        </p>
      ) : null}
      {info !== null ? (
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          {info}
        </p>
      ) : null}
    </section>
  );
}
