"use client";
// use-client: formulaires de la fiche (état local, useTransition + Server Actions)

// Fiche apporteur : envoyer le lien du dossier, rattacher un parrain, note interne,
// et ouvrir un dossier à la main.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  apercuLienAction,
  enregistrerNoteAction,
  envoyerLienAction,
  ouvrirDossierManuelAction,
  rattacherParrainAction,
  rechercherCandidatsApporteursAction,
  renvoyerContratSigneAction,
  type CandidatTrouve,
} from "@/features/apporteurs-reseau/actions-apporteurs";

import { ApercuEmail, MessageRetour, type EmailApercu } from "./ApercuEmail";

export function EnvoiLienDossier({
  apporteurId,
  contratSigne = false,
  lienPossible = true,
  apercuDirect = false,
  apresEnvoi,
}: {
  apporteurId: string;
  /** Vrai quand le contrat contresigné existe : propose de rejouer son e-mail. */
  contratSigne?: boolean;
  /** Faux pour un dossier signé (à vérifier ou contresigné) : plus de lien à envoyer. */
  lienPossible?: boolean;
  /** « Nouvel apporteur » : l'aperçu de l'e-mail s'ouvre d'emblée. */
  apercuDirect?: boolean;
  /** Après un envoi réussi (ex. ouvrir la fiche). */
  apresEnvoi?: () => void;
}) {
  const [mot, setMot] = useState("");
  const [email, setEmail] = useState<EmailApercu | null>(null);
  // « Déjà envoyé le … » : affiché dans l'aperçu, et le bouton devient « Renvoyer quand même ».
  const [dejaEnvoyeLe, setDejaEnvoyeLe] = useState<string | null>(null);
  // Texte principal réécrit (null = texte d'origine) ; appliqué à l'aperçu ET à l'envoi.
  const [texte, setTexte] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const apercuDemande = useRef(false);
  useEffect(() => {
    if (!apercuDirect || apercuDemande.current) return;
    apercuDemande.current = true;
    demarrer(async () => {
      const r = await apercuLienAction({ apporteurId, mot: "" });
      if (r.ok) {
        setDejaEnvoyeLe(r.dejaEnvoyeLe ?? null);
        setEmail(r.email);
      } else setRetour(r);
    });
  }, [apercuDirect, apporteurId]);
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      {!lienPossible ? null : !email ? (
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
                    setDejaEnvoyeLe(r.dejaEnvoyeLe ?? null);
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
        <>
          {dejaEnvoyeLe ? (
            <p role="alert" className="text-[color:var(--color-admin-warning)]">
              ⚠️ Lien déjà envoyé le {dejaEnvoyeLe}. Confirmez seulement si vous voulez le renvoyer.
            </p>
          ) : null}
          <ApercuEmail
            email={email}
            libelleEnvoyer={dejaEnvoyeLe ? "Renvoyer quand même" : "Envoyer le lien"}
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
                const r = await envoyerLienAction({
                  apporteurId,
                  mot,
                  texte,
                  confirmerRenvoi: dejaEnvoyeLe !== null,
                });
                setRetour(r);
                if (r.ok) {
                  setEmail(null);
                  setTexte(null);
                  setDejaEnvoyeLe(null);
                  apresEnvoi?.();
                }
              })
            }
          />
        </>
      )}
      {contratSigne && !email ? (
        <div>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => setRetour(await renvoyerContratSigneAction({ apporteurId })))
            }
          >
            Renvoyer le contrat signé
          </button>
        </div>
      ) : null}
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
  // Fiche candidat choisie dans la recherche : le dossier y sera RELIÉ (07/10).
  const [fiche, setFiche] = useState<CandidatTrouve | null>(null);
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<CandidatTrouve[]>([]);
  // Cochée par défaut : l'aperçu de « Votre contrat d'apporteur, en ligne » s'ouvre aussitôt.
  const [envoyerLien, setEnvoyerLien] = useState(true);
  const [cree, setCree] = useState<string | null>(null);
  const [existant, setExistant] = useState<{ apporteurId: string; message: string } | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [, demarrerRecherche] = useTransition();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);
  function chercher(q: string) {
    setRecherche(q);
    if (minuterie.current) clearTimeout(minuterie.current);
    const numero = ++derniere.current;
    minuterie.current = setTimeout(() => {
      demarrerRecherche(async () => {
        const r = await rechercherCandidatsApporteursAction(q);
        // Une réponse arrivée après une frappe plus récente est ignorée.
        if (numero === derniere.current) setTrouves(r.ok ? r.candidats : []);
      });
    }, 300);
  }
  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        Nouvel apporteur
      </button>
    );
  }
  if (cree) {
    return (
      <div className="flex flex-col gap-[var(--space-admin-2)]">
        <p role="status">Dossier ouvert. Relisez l&apos;e-mail avant de l&apos;envoyer.</p>
        <EnvoiLienDossier
          apporteurId={cree}
          apercuDirect
          apresEnvoi={() => router.push(`${base}/${cree}`)}
        />
        <div>
          <a className="admin-button-secondary" href={`${base}/${cree}`}>
            Ouvrir sa fiche sans envoyer
          </a>
        </div>
      </div>
    );
  }
  const champs = {
    prenom: "Prénom",
    nom: "Nom",
    email: "E-mail",
    telephone: "Téléphone (facultatif)",
  } as const;
  return (
    <form
      className="flex flex-col gap-[var(--space-admin-2)]"
      onSubmit={(e) => {
        e.preventDefault();
        setExistant(null);
        setRetour(null);
        demarrer(async () => {
          const r = await ouvrirDossierManuelAction({
            ...v,
            telephone: v.telephone || null,
            submissionId: fiche?.submissionId ?? null,
          });
          if (r.ok) {
            if (envoyerLien) setCree(r.apporteurId);
            else router.push(`${base}/${r.apporteurId}`);
          } else if (r.existant) {
            setExistant({ apporteurId: r.existant.apporteurId, message: r.message });
          } else setRetour(r);
        });
      }}
    >
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Ouvre le dossier en ligne de l&apos;apporteur (contrat, IBAN, pièces, signature). Aucun
        e-mail ne part sans votre confirmation.
      </p>
      <div className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
        <input
          className="admin-input"
          aria-label="Rechercher une fiche de candidat apporteur"
          placeholder="Rechercher une fiche candidat (nom, e-mail, téléphone)"
          value={recherche}
          onChange={(e) => chercher(e.target.value)}
        />
      </div>
      {trouves.length > 0 && !fiche ? (
        <ul aria-label="Fiches de candidats trouvées" className="flex flex-col gap-1">
          {trouves.map((c) => (
            <li key={c.submissionId}>
              <button
                type="button"
                className="admin-button-secondary"
                onClick={() => {
                  setFiche(c);
                  setV({ prenom: c.prenom, nom: c.nom, email: c.email, telephone: c.telephone });
                }}
              >
                {[c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom"} · {c.email} · reçue le{" "}
                {c.recueLe}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {fiche ? (
        <p className="text-[length:var(--text-admin-sm)]">
          Le dossier sera relié à la fiche candidat de {fiche.prenom} {fiche.nom}.{" "}
          <button type="button" className="underline" onClick={() => setFiche(null)}>
            Ne pas relier
          </button>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
        {(["prenom", "nom", "email", "telephone"] as const).map((k) => (
          <input
            key={k}
            className="admin-input"
            aria-label={champs[k]}
            placeholder={champs[k]}
            type={k === "email" ? "email" : "text"}
            required={k !== "telephone"}
            value={v[k]}
            onChange={(e) => {
              setV({ ...v, [k]: e.target.value });
              // Adresse ou nom modifiés : ce n'est plus la fiche choisie, le lien est défait.
              if (k === "email" || k === "nom" || k === "prenom") setFiche(null);
            }}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-[length:var(--text-admin-sm)]">
        <input
          type="checkbox"
          checked={envoyerLien}
          onChange={(e) => setEnvoyerLien(e.target.checked)}
        />
        Envoyer tout de suite le lien du dossier (aperçu de l&apos;e-mail avant l&apos;envoi)
      </label>
      {existant ? (
        <p role="alert" className="text-[color:var(--color-admin-warning)]">
          {existant.message}{" "}
          <a className="underline" href={`${base}/${existant.apporteurId}`}>
            Ouvrir sa fiche
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button type="submit" className="admin-button" disabled={enCours}>
          Ouvrir son dossier
        </button>
        <button type="button" className="admin-button-secondary" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
      <MessageRetour retour={retour} />
    </form>
  );
}
