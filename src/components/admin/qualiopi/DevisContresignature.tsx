"use client";
// use-client: pavé de signature (canvas + pointer events) + état local + Server Action.

/**
 * Contresignature du devis par l'organisme — l'acte qui CONCLUT.
 *
 * 🔴 Sans cet écran, l'action `contresignerDevisAction` n'était appelable par
 * personne, et le circuit ne pouvait jamais se terminer : le SSOT déclare deux
 * parties, le devis serait resté `partielle` indéfiniment, sur un « bon pour
 * accord » que l'organisme n'a jamais accepté.
 *
 * C'est exactement le défaut que ce chantier a déjà retiré deux fois ailleurs —
 * du code de signature écrit, testé, et que rien n'appelle.
 *
 * ⚠️ Le pavé n'est PAS un ornement : l'organisme signe comme le client, avec un
 * tracé, un horodatage et une empreinte. Une contresignature posée au clic —
 * sans image, sans signataire, sans empreinte, avec un PDF qui rend « signé » —
 * est précisément le faux positif que ce chantier retire du côté AFEST.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/portail/SignaturePad";

export interface DevisContresignatureProps {
  documentGenereId: string;
  /** Nom affiché du signataire — lu de la session côté serveur, jamais saisi. */
  organismeNom: string;
  contresignerAction: (input: {
    documentGenereId: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<
    { ok: true; signatureId: string; statutSignature: string } | { ok: false; message: string }
  >;
}

export function DevisContresignature({
  documentGenereId,
  organismeNom,
  contresignerAction,
}: DevisContresignatureProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [trace, setTrace] = useState<string | null>(null);
  const [modeAccessible, setModeAccessible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const pret = modeAccessible || trace !== null;

  function soumettre() {
    setErreur(null);
    startTransition(async () => {
      const res = await contresignerAction({
        documentGenereId,
        methode: modeAccessible ? "confirmation_accessible" : "trace",
        // ⚠️ Jamais d'image en mode accessible : le service la REFUSE, parce que
        // transmettre un tracé présenterait comme manuscrite une signature qui
        // ne l'est pas.
        ...(modeAccessible || trace === null ? {} : { imageDataUrl: trace }),
      });
      if (res.ok) {
        setOuvert(false);
        router.refresh();
      } else {
        setErreur(res.message);
      }
    });
  }

  if (!ouvert) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-paper)]"
        >
          Contresigner ce devis
        </button>
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {`Le client a donné son accord. En contresignant, ${organismeNom} conclut le devis : il passera automatiquement en « accepté ».`}
        </p>
      </div>
    );
  }

  return (
    <div>
      {!modeAccessible ? (
        <>
          <SignaturePad
            onChange={setTrace}
            disabled={enCours}
            label="Zone de signature de l'organisme"
            onBasculerAccessible={() => {
              setModeAccessible(true);
              setTrace(null);
            }}
          />
        </>
      ) : (
        <div className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
          <p className="text-[length:var(--text-admin-sm)]">
            Contresignature sans tracé manuscrit. Elle sera mentionnée comme telle sur le document.
          </p>
          <button
            type="button"
            onClick={() => setModeAccessible(false)}
            disabled={enCours}
            className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] underline underline-offset-4 disabled:opacity-50"
          >
            Revenir au tracé manuscrit
          </button>
        </div>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}

      <div className="mt-[var(--space-admin-4)] flex gap-[var(--space-admin-3)]">
        <button
          type="button"
          onClick={soumettre}
          disabled={!pret || enCours}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
        >
          {enCours ? "Enregistrement…" : "Signer et conclure"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          disabled={enCours}
          className="text-[length:var(--text-admin-sm)] underline underline-offset-4 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
