"use client";
// use-client: aperçu puis confirmation (état local, useTransition) pour les actions de
// fin de collaboration et d'avertissement : rien ne part sans aperçu.

/**
 * FinCollaborationPanel — fin de collaboration d'un formateur indépendant (lot L14).
 *
 * Affiché seulement si `formateurs.fin_collaboration` est allumé et que le rôle peut
 * habiliter un formateur (la page en décide ; les actions revérifient). Deux gestes,
 * chacun avec aperçu de l'e-mail : l'avertissement F49, puis la fin (F47). Une fiche
 * terminée affiche ses dates et la conservation de ses pièces : aucun bouton.
 */

import { useState, useTransition } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  apercuAvertissementAction,
  apercuFinCollaborationAction,
  envoyerAvertissementFormateurAction,
  terminerCollaborationFormateurAction,
  type ApercuFin,
} from "@/server/actions/qualiopi/formateur-fin-collaboration";
import {
  LIBELLES_MOTIF_FIN,
  MOTIFS_FIN,
  type MotifFin,
} from "@/server/qualiopi/formateurs-independants/fin-collaboration";

const DATE_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const dateFr = (iso: string) => DATE_FR.format(new Date(`${iso}T00:00:00Z`));

const RESULTATS_EMAIL: Readonly<Record<string, string>> = {
  envoye: "E-mail envoyé.",
  "en-validation": "E-mail placé dans la corbeille de validation.",
  aucun: "Aucun e-mail (décès, ou envoi non demandé).",
  "texte-non-valide": "E-mail NON envoyé : son texte n'est pas encore validé.",
};
const resultatEmail = (r: string) => RESULTATS_EMAIL[r] ?? `E-mail non envoyé (${r}).`;

export interface FinTerminee {
  readonly decideeLe: string;
  readonly effetLe: string | null;
  readonly motif: string;
  readonly conservation: { contratEtVigilance: string; piecesComptables: string } | null;
}

function Apercu({ sujet, html }: { sujet: string; html: string }) {
  return (
    <div className="mt-[var(--space-admin-3)]">
      <p className="admin-meta">Aperçu — objet : {sujet}</p>
      <iframe
        title="Aperçu de l'e-mail"
        sandbox=""
        srcDoc={html}
        className="admin-card mt-[var(--space-admin-2)] h-80 w-full"
      />
    </div>
  );
}

export function FinCollaborationPanel({
  trainerId,
  terminee,
}: {
  trainerId: string;
  terminee: FinTerminee | null;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const [fait, setFait] = useState("");
  const [apercuAv, setApercuAv] = useState<{ sujet: string; html: string } | null>(null);

  const [motif, setMotif] = useState<MotifFin>("initiative_axion");
  const [dateEffet, setDateEffet] = useState("");
  const [note, setNote] = useState("");
  const [irreparable, setIrreparable] = useState(false);
  const [apercuFin, setApercuFin] = useState<ApercuFin | null>(null);

  if (terminee) {
    return (
      <section aria-labelledby="fin-collab-titre" className="admin-card mb-[var(--space-admin-5)]">
        <h2 id="fin-collab-titre" className="admin-meta">
          Fin de collaboration
        </h2>
        <p className="text-[length:var(--text-admin-sm)]">
          Collaboration terminée le {dateFr(terminee.decideeLe)}
          {terminee.effetLe ? `, avec effet au ${dateFr(terminee.effetLe)}` : ""} — {terminee.motif}
          .
        </p>
        {terminee.conservation ? (
          <p className="text-[length:var(--text-admin-sm)]">
            Conservable jusqu&apos;au {dateFr(terminee.conservation.contratEtVigilance)} (contrat,
            attestations de vigilance et leurs preuves) et jusqu&apos;au{" "}
            {dateFr(terminee.conservation.piecesComptables)} (pièces comptables). Aucune purge
            automatique.
          </p>
        ) : null}
      </section>
    );
  }

  const params = () => ({
    trainerId,
    motif,
    note,
    irreparable,
    ...(dateEffet ? { dateEffet } : {}),
  });

  return (
    <section aria-labelledby="fin-collab-titre" className="admin-card mb-[var(--space-admin-5)]">
      <h2 id="fin-collab-titre" className="admin-meta">
        Fin de collaboration
      </h2>
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ton === "ok" ? "admin-alert-success" : "admin-alert-warning"} mt-[var(--space-admin-2)]`}
        >
          {message.texte}
        </p>
      ) : null}

      <h3 className="admin-meta mt-[var(--space-admin-3)]">
        Avertissement avant une fin pour manquement
      </h3>
      <label className="flex flex-col text-[length:var(--text-admin-sm)]">
        Fait constaté (repris tel quel dans l&apos;e-mail)
        <textarea
          value={fait}
          onChange={(e) => {
            setFait(e.target.value);
            setApercuAv(null);
          }}
          maxLength={2000}
          rows={3}
          className="admin-input"
        />
      </label>
      <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-3)]">
        <AdminButton
          type="button"
          variant="secondary"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await apercuAvertissementAction({ trainerId, fait });
              if ("error" in r) setMessage({ ton: "erreur", texte: r.error });
              else setApercuAv(r.data);
            })
          }
        >
          Voir l&apos;avertissement
        </AdminButton>
        {apercuAv ? (
          <AdminButton
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await envoyerAvertissementFormateurAction({ trainerId, fait });
                setApercuAv(null);
                setMessage(
                  "error" in r
                    ? { ton: "erreur", texte: r.error }
                    : { ton: "ok", texte: resultatEmail(r.data.email) },
                );
              })
            }
          >
            Envoyer cet avertissement
          </AdminButton>
        ) : null}
      </div>
      {apercuAv ? <Apercu sujet={apercuAv.sujet} html={apercuAv.html} /> : null}

      <h3 className="admin-meta mt-[var(--space-admin-4)]">Mettre fin à la collaboration</h3>
      <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <label className="flex flex-col text-[length:var(--text-admin-sm)]">
          Motif
          <select
            value={motif}
            onChange={(e) => {
              setMotif(e.target.value as MotifFin);
              setApercuFin(null);
              setDateEffet("");
            }}
            className="admin-input"
          >
            {MOTIFS_FIN.map((m) => (
              <option key={m} value={m}>
                {LIBELLES_MOTIF_FIN[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[length:var(--text-admin-sm)]">
          Date d&apos;effet (vide : calculée)
          <input
            type="date"
            value={dateEffet}
            onChange={(e) => {
              setDateEffet(e.target.value);
              setApercuFin(null);
            }}
            className="admin-input"
          />
        </label>
      </div>
      {motif === "manquement" ? (
        <label className="mt-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          <input
            type="checkbox"
            checked={irreparable}
            onChange={(e) => {
              setIrreparable(e.target.checked);
              setApercuFin(null);
            }}
          />
          Faute qui ne peut pas être réparée (art. 30.4) : sans avertissement, motif à écrire dans
          la note
        </label>
      ) : null}
      <label className="mt-[var(--space-admin-2)] flex flex-col text-[length:var(--text-admin-sm)]">
        Note interne (jamais envoyée ni journalisée)
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setApercuFin(null);
          }}
          maxLength={2000}
          rows={2}
          className="admin-input"
        />
      </label>
      <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-3)]">
        <AdminButton
          type="button"
          variant="secondary"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await apercuFinCollaborationAction(params());
              if ("error" in r) setMessage({ ton: "erreur", texte: r.error });
              else {
                setApercuFin(r.data);
                if (!dateEffet) setDateEffet(r.data.dateEffetDefaut);
              }
            })
          }
        >
          Voir ce qui se passera
        </AdminButton>
        {apercuFin && apercuFin.refus.length === 0 ? (
          <AdminButton
            type="button"
            variant="danger"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await terminerCollaborationFormateurAction({
                  ...params(),
                  dateEffet: dateEffet || apercuFin.dateEffetDefaut,
                });
                setApercuFin(null);
                setMessage(
                  "error" in r
                    ? { ton: "erreur", texte: r.error }
                    : {
                        ton: "ok",
                        texte: `Collaboration terminée. ${resultatEmail(r.data.email)}`,
                      },
                );
              })
            }
          >
            Mettre fin à la collaboration
          </AdminButton>
        ) : null}
      </div>
      {apercuFin ? (
        <div className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          <p>
            {apercuFin.avecPreavis
              ? `Préavis selon la durée de la relation : ${apercuFin.preavis} jours (effet au plus tôt le ${dateFr(apercuFin.dateEffetDefaut)}).`
              : "Fin sans préavis."}
          </p>
          {apercuFin.refus.map((r) => (
            <p key={r} className="admin-alert admin-alert-warning mt-[var(--space-admin-2)]">
              {r}
            </p>
          ))}
          <p>
            Conservable jusqu&apos;au {dateFr(apercuFin.conservation.contratEtVigilance)} (contrat
            et vigilance) et jusqu&apos;au {dateFr(apercuFin.conservation.piecesComptables)} (pièces
            comptables).
          </p>
          {apercuFin.email ? (
            <Apercu sujet={apercuFin.email.sujet} html={apercuFin.email.html} />
          ) : (
            <p>Aucun e-mail ne partira.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
