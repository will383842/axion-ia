"use client";
// use-client: formulaires de la fiche (état local, useTransition + Server Actions)

// Fiche apporteur : envoyer le lien du dossier, rattacher un parrain, note interne,
// et ouvrir un dossier à la main.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  apercuLienAction,
  enregistrerNoteAction,
  envoyerLienAction,
  ouvrirDossierManuelAction,
  rattacherParrainAction,
} from "@/features/apporteurs-reseau/actions-apporteurs";

import { ApercuEmail, MessageRetour, type EmailApercu } from "./ApercuEmail";

export function EnvoiLienDossier({ apporteurId }: { apporteurId: string }) {
  const [mot, setMot] = useState("");
  const [email, setEmail] = useState<EmailApercu | null>(null);
  // Texte principal réécrit (null = texte d'origine) ; appliqué à l'aperçu ET à l'envoi.
  const [texte, setTexte] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      {!email ? (
        <>
          <input
            className="admin-input"
            aria-label="Un mot personnel (facultatif)"
            placeholder="Un mot personnel (facultatif)"
            value={mot}
            maxLength={500}
            onChange={(e) => setMot(e.target.value)}
          />
          <div>
            <button
              type="button"
              className="admin-button-secondary"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await apercuLienAction({ apporteurId, mot });
                  if (r.ok) {
                    setTexte(null);
                    setEmail(r.email);
                  } else setRetour(r);
                })
              }
            >
              Envoyer le lien du dossier
            </button>
          </div>
        </>
      ) : (
        <ApercuEmail
          email={email}
          libelleEnvoyer="Envoyer le lien"
          occupe={enCours}
          onAnnuler={() => {
            setEmail(null);
            setTexte(null);
          }}
          texte={texte}
          onActualiserTexte={(t) =>
            demarrer(async () => {
              const r = await apercuLienAction({ apporteurId, mot, texte: t });
              if (r.ok) {
                setTexte(t);
                setEmail(r.email);
              } else setRetour(r);
            })
          }
          onEnvoyer={() =>
            demarrer(async () => {
              const r = await envoyerLienAction({ apporteurId, mot, texte });
              setRetour(r);
              if (r.ok) {
                setEmail(null);
                setTexte(null);
              }
            })
          }
        />
      )}
      <MessageRetour retour={retour} />
    </div>
  );
}

export function ParrainEtNote({
  apporteurId,
  parrainId,
  parrainsPossibles,
  note,
}: {
  apporteurId: string;
  parrainId: string | null;
  parrainsPossibles: { id: string; nom: string }[];
  note: string | null;
}) {
  const [parrain, setParrain] = useState(parrainId ?? "");
  const [texte, setTexte] = useState(note ?? "");
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Parrain (10 % de ses commissions pendant 6 mois)
        </span>
        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
          <select
            className="admin-select"
            value={parrain}
            onChange={(e) => setParrain(e.target.value)}
            disabled={enCours}
          >
            <option value="">Aucun</option>
            {parrainsPossibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours || parrain === (parrainId ?? "")}
            onClick={() =>
              demarrer(async () =>
                setRetour(
                  await rattacherParrainAction({ apporteurId, parrainId: parrain || null }),
                ),
              )
            }
          >
            Enregistrer
          </button>
        </div>
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Note interne
        </span>
        <textarea
          className="admin-textarea min-h-[80px]"
          value={texte}
          maxLength={5000}
          onChange={(e) => setTexte(e.target.value)}
        />
        <div>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() =>
              demarrer(async () =>
                setRetour(await enregistrerNoteAction({ apporteurId, note: texte })),
              )
            }
          >
            Enregistrer la note
          </button>
        </div>
      </label>
      <MessageRetour retour={retour} />
    </div>
  );
}

export function NouvelApporteurForm({ base }: { base: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState({ prenom: "", nom: "", email: "", telephone: "" });
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        Nouvel apporteur
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
      onSubmit={(e) => {
        e.preventDefault();
        demarrer(async () => {
          const r = await ouvrirDossierManuelAction({ ...v, telephone: v.telephone || null });
          if (r.ok) router.push(`${base}/${r.apporteurId}`);
          else setRetour(r);
        });
      }}
    >
      {(["prenom", "nom", "email", "telephone"] as const).map((k) => (
        <input
          key={k}
          className="admin-input"
          aria-label={
            { prenom: "Prénom", nom: "Nom", email: "E-mail", telephone: "Téléphone (facultatif)" }[
              k
            ]
          }
          placeholder={
            { prenom: "Prénom", nom: "Nom", email: "E-mail", telephone: "Téléphone (facultatif)" }[
              k
            ]
          }
          type={k === "email" ? "email" : "text"}
          required={k !== "telephone"}
          value={v[k]}
          onChange={(e) => setV({ ...v, [k]: e.target.value })}
        />
      ))}
      <button type="submit" className="admin-button" disabled={enCours}>
        Ouvrir son dossier
      </button>
      <button type="button" className="admin-button-secondary" onClick={() => setOuvert(false)}>
        Annuler
      </button>
      <MessageRetour retour={retour} />
    </form>
  );
}
