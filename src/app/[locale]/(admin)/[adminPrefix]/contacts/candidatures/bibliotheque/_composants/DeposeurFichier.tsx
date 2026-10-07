"use client";
// use-client: envoi par morceaux depuis le navigateur (fichier local, progression, reprise) — chargé à la demande.

/**
 * LE DÉPOSEUR — envoi direct navigateur → stockage en ligne (R2), par morceaux
 * de 64 Mio, 3 à la fois, jusqu'à 20 Go (Candidatures unifiées L4, ADR 0065).
 *
 * Aucun SDK : chaque morceau part en `PUT` sur une adresse signée d'une heure
 * que le serveur fournit par lots. Le serveur relit lui-même les morceaux reçus
 * et revérifie la taille finale : le navigateur ne décide de rien.
 *
 * Reprise : l'identifiant de l'envoi est noté dans ce navigateur (clé = nom,
 * taille, date de modification du fichier). Re-choisir le MÊME fichier après
 * une coupure ou un onglet fermé ne renvoie que les morceaux manquants.
 *
 * Chargé SEULEMENT à l'ouverture (import dynamique dans `OuvrirDepot`).
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Monitor, X } from "lucide-react";

import {
  abandonnerDepotAction,
  ajouterLienAction,
  commencerDepotAction,
  reprendreDepotAction,
  signerMorceauxAction,
  terminerDepotAction,
} from "@/features/bibliotheque-fichiers/actions";
import {
  CATEGORIES_DEPOT,
  CATEGORIES_LIEN,
  ENVOIS_PARALLELES,
  LIBELLE_CATEGORIE,
  MORCEAUX_PAR_SIGNATURE,
  SEUIL_AVERTISSEMENT_MOBILE_OCTETS,
  TAILLE_MAX_EQUIPE_OCTETS,
  TAILLE_MORCEAU_OCTETS,
  nombreMorceaux,
  tailleLisible,
  tailleMorceau,
} from "@/server/partages/regles";

type Mode = "fichier" | "lien";
type Phase = "choix" | "envoi" | "fini";

const ESSAIS_PAR_MORCEAU = 3;
const MSG_CORS =
  "Le stockage en ligne a refusé l'envoi depuis la console. Le réglage d'accès (CORS) du compartiment est sans doute à revoir : prévenez l'administrateur. Rien n'est perdu, l'envoi pourra reprendre.";

function cleReprise(f: File): string {
  return `axion-partage-depot:${f.name}:${f.size}:${f.lastModified}`;
}
function lireReprise(f: File): string | null {
  try {
    return window.localStorage.getItem(cleReprise(f));
  } catch {
    return null;
  }
}
function noterReprise(f: File, id: string | null): void {
  try {
    if (id) window.localStorage.setItem(cleReprise(f), id);
    else window.localStorage.removeItem(cleReprise(f));
  } catch {
    // stockage du navigateur indisponible : la reprise ne sera simplement pas proposée
  }
}

class ErreurEnvoi extends Error {}

/** Un fichier déposé, rendu à l'appelant (composeur de réponse, L5). */
export interface FichierDepose {
  readonly id: string;
  readonly titre: string;
  readonly categorie: string;
  readonly taille: number;
}

interface PropsDeposeur {
  readonly onFermer: () => void;
  /**
   * Candidatures unifiées L5 — utilisé DEPUIS LE COMPOSEUR de réponse : le
   * fichier est ponctuel (`dansBibliotheque: false`), seul le mode « Depuis mon
   * ordinateur » est proposé, et l'appelant reçoit le fichier une fois déposé.
   */
  readonly ponctuel?: boolean;
  readonly onDepose?: (f: FichierDepose) => void;
}

export default function DeposeurFichier({ onFermer, ponctuel = false, onDepose }: PropsDeposeur) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("fichier");
  const [fichier, setFichier] = useState<File | null>(null);
  const [categorie, setCategorie] = useState<string>("rushs");
  const [titre, setTitre] = useState("");
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("choix");
  const [envoyes, setEnvoyes] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const arret = useRef<AbortController | null>(null);
  const idEnCours = useRef<string | null>(null);

  async function envoyerMorceau(f: File, numero: number, adresse: string, signal: AbortSignal) {
    const debut = (numero - 1) * TAILLE_MORCEAU_OCTETS;
    const corps = f.slice(debut, debut + tailleMorceau(f.size, numero));
    let derniere: unknown = null;
    for (let essai = 0; essai < ESSAIS_PAR_MORCEAU; essai++) {
      try {
        const r = await fetch(adresse, { method: "PUT", body: corps, signal });
        if (r.ok) return;
        derniere = new ErreurEnvoi(`refus ${r.status}`);
        if (r.status === 403) break; // adresse expirée ou refusée : inutile d'insister
      } catch (e) {
        if (signal.aborted) throw e;
        derniere = e;
      }
    }
    if (derniere instanceof TypeError) throw new ErreurEnvoi(MSG_CORS);
    throw new ErreurEnvoi(
      "Un morceau n'a pas pu être envoyé. Vérifiez la connexion puis choisissez à nouveau le même fichier : l'envoi reprendra.",
    );
  }

  async function deposer() {
    const f = fichier;
    if (!f) return;
    setErreur(null);
    setMessage(null);
    if (f.size > TAILLE_MAX_EQUIPE_OCTETS) {
      setErreur("Ce fichier dépasse 20 Go.");
      return;
    }
    const mobile =
      typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (
      mobile &&
      f.size > SEUIL_AVERTISSEMENT_MOBILE_OCTETS &&
      !window.confirm(
        `Ce fichier pèse ${tailleLisible(f.size)}. Depuis un téléphone, l'envoi peut être long et consommer votre forfait. Continuer ?`,
      )
    ) {
      return;
    }

    const controleur = new AbortController();
    arret.current = controleur;
    setPhase("envoi");
    try {
      let id = lireReprise(f);
      let recus: number[] = [];
      if (id) {
        const r = await reprendreDepotAction(id);
        if (r.ok) recus = r.valeur.recus;
        else id = null;
      }
      if (!id) {
        const r = await commencerDepotAction({
          nom: f.name,
          taille: f.size,
          typeMime: f.type || null,
          categorie,
          titre: titre.trim() || null,
          ...(ponctuel ? { dansBibliotheque: false } : {}),
        });
        if (!r.ok) throw new ErreurEnvoi(r.erreur);
        id = r.valeur.fichierId;
        noterReprise(f, id);
      }
      idEnCours.current = id;

      const n = nombreMorceaux(f.size);
      const dejaLa = new Set(recus);
      let octets = recus.reduce((s, x) => s + tailleMorceau(f.size, x), 0);
      setEnvoyes(octets);
      const manquants: number[] = [];
      for (let i = 1; i <= n; i++) if (!dejaLa.has(i)) manquants.push(i);

      for (let i = 0; i < manquants.length; i += MORCEAUX_PAR_SIGNATURE) {
        const lot = manquants.slice(i, i + MORCEAUX_PAR_SIGNATURE);
        const s = await signerMorceauxAction(id, lot);
        if (!s.ok) throw new ErreurEnvoi(s.erreur);
        const file = [...s.valeur];
        const ouvriers = Array.from(
          { length: Math.min(ENVOIS_PARALLELES, file.length) },
          async () => {
            for (let m = file.shift(); m; m = file.shift()) {
              await envoyerMorceau(f, m.numero, m.url, controleur.signal);
              octets += tailleMorceau(f.size, m.numero);
              setEnvoyes(octets);
            }
          },
        );
        await Promise.all(ouvriers);
      }

      const fin = await terminerDepotAction(id);
      if (!fin.ok) throw new ErreurEnvoi(fin.erreur);
      noterReprise(f, null);
      idEnCours.current = null;
      setPhase("fini");
      setMessage("Fichier déposé. L'antivirus le vérifie (sauf au-delà de 200 Mo).");
      if (onDepose) {
        onDepose({ id, titre: titre.trim() || f.name, categorie, taille: f.size });
      } else {
        router.refresh();
      }
    } catch (e) {
      setPhase("choix");
      if (controleur.signal.aborted) return;
      setErreur(
        e instanceof ErreurEnvoi
          ? e.message
          : "L'envoi s'est interrompu. Choisissez à nouveau le même fichier pour le reprendre.",
      );
    } finally {
      arret.current = null;
    }
  }

  async function arreter() {
    arret.current?.abort();
    const id = idEnCours.current;
    if (fichier) noterReprise(fichier, null);
    idEnCours.current = null;
    setPhase("choix");
    setEnvoyes(0);
    if (id) await abandonnerDepotAction(id);
    setMessage("Envoi arrêté.");
  }

  async function ajouterLien() {
    setErreur(null);
    setMessage(null);
    const r = await ajouterLienAction({ url, titre, categorie });
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setUrl("");
    setTitre("");
    setMessage("Lien ajouté à la bibliothèque.");
    router.refresh();
  }

  const categories = mode === "fichier" ? CATEGORIES_DEPOT : CATEGORIES_LIEN;
  const pourcentage = fichier && fichier.size > 0 ? Math.floor((envoyes / fichier.size) * 100) : 0;

  return (
    <div>
      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <div
          className={ponctuel ? "hidden" : "flex flex-wrap gap-[var(--space-admin-2)]"}
          role="group"
          aria-label="Source"
        >
          <button
            type="button"
            className={
              mode === "fichier"
                ? "admin-button-secondary admin-button-sm admin-button-active"
                : "admin-button-ghost admin-button-sm"
            }
            aria-pressed={mode === "fichier"}
            disabled={phase === "envoi"}
            onClick={() => setMode("fichier")}
          >
            <Monitor size={14} aria-hidden="true" /> Depuis mon ordinateur
          </button>
          <button
            type="button"
            className={
              mode === "lien"
                ? "admin-button-secondary admin-button-sm admin-button-active"
                : "admin-button-ghost admin-button-sm"
            }
            aria-pressed={mode === "lien"}
            disabled={phase === "envoi"}
            onClick={() => {
              setMode("lien");
              if (categorie === "essai_rendu") setCategorie("autre");
            }}
          >
            <Link2 size={14} aria-hidden="true" /> Coller un lien (Drive, WeTransfer)
          </button>
        </div>
        <button
          type="button"
          className="admin-button-ghost admin-button-sm"
          onClick={onFermer}
          disabled={phase === "envoi"}
          aria-label="Fermer"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-[var(--space-admin-3)] md:grid-cols-3">
        <label className="admin-form-field">
          <span>Catégorie</span>
          <select
            className="admin-select"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            disabled={phase === "envoi"}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {LIBELLE_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-form-field md:col-span-2">
          <span>Titre{mode === "fichier" ? " (facultatif)" : ""}</span>
          <input
            className="admin-input"
            value={titre}
            maxLength={200}
            onChange={(e) => setTitre(e.target.value)}
            disabled={phase === "envoi"}
          />
        </label>
      </div>

      {mode === "fichier" ? (
        <div className="mt-[var(--space-admin-3)]">
          <label className="admin-form-field">
            <span>Fichier (20 Go au plus)</span>
            <input
              type="file"
              className="admin-input"
              disabled={phase === "envoi"}
              onChange={(e) => {
                setFichier(e.target.files?.[0] ?? null);
                setPhase("choix");
                setEnvoyes(0);
                setErreur(null);
                setMessage(null);
              }}
            />
          </label>
          {fichier ? (
            <p className="admin-meta-small">
              {fichier.name} · {tailleLisible(fichier.size)}
              {lireReprise(fichier)
                ? " · un envoi interrompu de ce fichier reprendra où il s'était arrêté"
                : ""}
            </p>
          ) : null}
          {phase === "envoi" && fichier ? (
            <div className="mt-[var(--space-admin-3)]" aria-live="polite">
              <div
                className="h-2 w-full overflow-hidden rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-surface-sunken)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pourcentage}
                aria-label="Progression de l'envoi"
              >
                <div
                  className="h-full bg-[color:var(--color-admin-accent)]"
                  style={{ width: `${pourcentage}%` }}
                />
              </div>
              <p className="admin-meta-small mt-[var(--space-admin-2)]">
                {tailleLisible(envoyes)} sur {tailleLisible(fichier.size)} · ne fermez pas
                l&apos;onglet (sinon, choisissez à nouveau le même fichier pour reprendre)
              </p>
            </div>
          ) : null}
          <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
            {phase === "envoi" ? (
              <button
                type="button"
                className="admin-button-secondary"
                onClick={() => void arreter()}
              >
                Arrêter l&apos;envoi
              </button>
            ) : (
              <button
                type="button"
                className="admin-button"
                disabled={!fichier}
                onClick={() => void deposer()}
              >
                Déposer
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-[var(--space-admin-3)]">
          <label className="admin-form-field">
            <span>Adresse du lien (https://…)</span>
            <input
              type="url"
              className="admin-input"
              value={url}
              maxLength={2000}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
          <button
            type="button"
            className="admin-button"
            disabled={!url.trim() || !titre.trim()}
            onClick={() => void ajouterLien()}
          >
            Ajouter le lien
          </button>
        </div>
      )}

      {erreur ? (
        <div className="admin-alert admin-alert-error mt-[var(--space-admin-3)]" role="alert">
          {erreur}
        </div>
      ) : null}
      {message ? (
        <div className="admin-alert admin-alert-success mt-[var(--space-admin-3)]" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}
