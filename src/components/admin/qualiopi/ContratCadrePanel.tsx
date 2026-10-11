"use client";
// use-client: état local (message de retour, envoi en cours) + appels Server Actions.

/**
 * Contrat-cadre d'un formateur indépendant, sur sa fiche (lot L7b).
 *
 * Affiché seulement si `formateurs.contrat_cadre_emission` est allumé et que le rôle peut
 * contresigner. Il montre les contrats-cadres de la fiche (numéro, version, état), permet
 * de PRÉPARER la dernière version arrêtée, puis d'envoyer le lien de signature au
 * formateur (F16, texte validé exigé, l'adresse vient de la fiche). La contresignature se
 * fait sur l'écran « Vérifier et contresigner », jamais ici.
 *
 * Le lien n'est jamais affiché : il part par e-mail.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { preparerContratCadreAction } from "@/server/actions/qualiopi/formateur-contrat-cadre";
import { envoyerLienSignatureParEmailAction } from "@/server/actions/qualiopi/piece-lien-signature";

export interface ContratCadreVue {
  readonly id: string;
  readonly numero: string;
  readonly version: number;
  readonly etat: string;
  /** Vivant et pas encore signé par le formateur : le lien peut partir. */
  readonly lienEnvoyable: boolean;
  /** Signé par le formateur, à contresigner. */
  readonly aContresigner: boolean;
}

export function ContratCadrePanel({
  trainerId,
  versionArretee,
  contrats,
  lienVerifier,
}: {
  trainerId: string;
  versionArretee: number | null;
  contrats: readonly ContratCadreVue[];
  lienVerifier: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const preparer = () =>
    demarrer(async () => {
      const r = await preparerContratCadreAction({ trainerId });
      if ("error" in r) {
        setMessage({ ok: false, texte: r.error });
        return;
      }
      setMessage({
        ok: true,
        texte:
          `Contrat ${r.data.numero} (version ${r.data.version}) préparé.` +
          (r.data.remplaces > 0 ? " Le contrat précédent, jamais signé, est remplacé." : ""),
      });
      router.refresh();
    });

  const envoyerLien = (documentGenereId: string) =>
    demarrer(async () => {
      const r = await envoyerLienSignatureParEmailAction({
        documentGenereId,
        partie: "sous_traitant",
      });
      if ("error" in r) {
        setMessage({ ok: false, texte: r.error });
        return;
      }
      setMessage({
        ok: true,
        texte: r.data.garePourValidation
          ? "E-mail placé dans la corbeille de validation."
          : `Lien de signature envoyé à ${r.data.destinataire}.` +
            (r.data.reemission ? " Le lien précédent ne vaut plus." : ""),
      });
      router.refresh();
    });

  return (
    <section
      id="contrat-cadre"
      aria-labelledby="contrat-cadre-titre"
      className="admin-card mb-[var(--space-admin-5)]"
    >
      <h2 id="contrat-cadre-titre" className="admin-meta">
        Contrat-cadre
      </h2>
      {contrats.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)]">
          Aucun contrat-cadre émis par l&apos;outil.
        </p>
      ) : (
        <ul className="text-[length:var(--text-admin-sm)]">
          {contrats.map((c) => (
            <li key={c.id} className="mt-[var(--space-admin-2)]">
              <strong>{c.numero}</strong> — version {c.version} — {c.etat}
              {c.lienEnvoyable ? (
                <span className="ml-[var(--space-admin-2)] inline-block">
                  <AdminButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={enCours}
                    onClick={() => envoyerLien(c.id)}
                  >
                    Envoyer le lien de signature
                  </AdminButton>
                </span>
              ) : null}
              {c.aContresigner ? (
                <a href={lienVerifier} className="ml-[var(--space-admin-2)] underline">
                  Vérifier et contresigner
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {versionArretee !== null ? (
        <div className="mt-[var(--space-admin-3)]">
          <AdminButton type="button" disabled={enCours} onClick={preparer}>
            Préparer le contrat-cadre (version {versionArretee})
          </AdminButton>
        </div>
      ) : null}
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ok ? "admin-alert-success" : "admin-alert-warning"} mt-[var(--space-admin-2)]`}
        >
          {message.texte}
        </p>
      ) : null}
    </section>
  );
}
