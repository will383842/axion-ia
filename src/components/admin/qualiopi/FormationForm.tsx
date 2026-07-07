"use client";
// use-client: formulaire interactif avec état local (inputs, selects) + useTransition pour createFormationAction / updateFormationAction + router.refresh().

/**
 * FormationForm — Création ou édition d'une formation.
 *
 * - Sans `id` : appelle `createFormationAction` puis redirige vers la page de
 *   détail /[id].
 * - Avec `id` : appelle `updateFormationAction` puis `router.refresh()`.
 *
 * Champs create : titre, slug, offreSiteId, dureeHeures, modalite.
 * Champs update : titre, methodesPedagogiques, seuilReussitePct, ratioPratiquePct,
 *                 accessibleHandicap.
 *
 * Les champs create ne sont pas ré-éditables après création (ils pilotent la
 * numérotation et le rattachement à l'offre).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFormationAction, updateFormationAction } from "@/server/actions/qualiopi/formations";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ModaliteFormation = "presentiel" | "distanciel" | "hybride";
type NiveauFormation = "debutant" | "intermediaire" | "avance" | "tous_niveaux";

interface OffreSiteOption {
  id: string;
  code: string;
  titreFr: string;
  dureeHeuresMin: number;
  dureeHeuresMax: number;
}

/** Props mode création (pas d'id). */
interface FormationFormCreateProps {
  id?: undefined;
  offres: OffreSiteOption[];
  /** Préfixe admin + locale pour la redirection post-création. */
  basePath: string;
  initial?: undefined;
}

/** Props mode édition (id présent). */
interface FormationFormEditProps {
  id: string;
  offres?: undefined;
  basePath?: undefined;
  initial: {
    titre: string;
    methodesPedagogiques: string | null;
    seuilReussitePct: number | null;
    ratioPratiquePct: number | null;
    accessibleHandicap: boolean;
    niveau: NiveauFormation;
    prerequis: string;
    secteurCible: string;
    outilsClient: string;
  };
}

type FormationFormProps = FormationFormCreateProps | FormationFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const MODALITE_OPTIONS: Array<{ value: ModaliteFormation; label: string }> = [
  { value: "presentiel", label: "Présentiel" },
  { value: "distanciel", label: "Distanciel" },
  { value: "hybride", label: "Hybride" },
];

const NIVEAU_OPTIONS: Array<{ value: NiveauFormation; label: string }> = [
  { value: "tous_niveaux", label: "Tous niveaux" },
  { value: "debutant", label: "Débutant" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "avance", label: "Avancé" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Génère un slug depuis un titre : minuscules, tirets, alphanumérique + tiret. */
function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function FormationForm(props: FormationFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── État mode création ────────────────────────────────────────────────────
  const [titre, setTitre] = useState(props.id !== undefined ? props.initial.titre : "");
  const [slug, setSlug] = useState("");
  const [offreSiteId, setOffreSiteId] = useState("");
  const [dureeHeures, setDureeHeures] = useState<number | "">(0);
  const [modalite, setModalite] = useState<ModaliteFormation>("presentiel");

  // ── État mode édition ─────────────────────────────────────────────────────
  const [titreEdit, setTitreEdit] = useState(props.id !== undefined ? props.initial.titre : "");
  const [methodesPedagogiques, setMethodesPedagogiques] = useState(
    props.id !== undefined ? (props.initial.methodesPedagogiques ?? "") : "",
  );
  const [seuilReussitePct, setSeuilReussitePct] = useState<number | "">(
    props.id !== undefined ? (props.initial.seuilReussitePct ?? "") : "",
  );
  const [ratioPratiquePct, setRatioPratiquePct] = useState<number | "">(
    props.id !== undefined ? (props.initial.ratioPratiquePct ?? "") : "",
  );
  const [accessibleHandicap, setAccessibleHandicap] = useState(
    props.id !== undefined ? props.initial.accessibleHandicap : false,
  );
  const [niveau, setNiveau] = useState<NiveauFormation>(
    props.id !== undefined ? props.initial.niveau : "tous_niveaux",
  );
  const [prerequis, setPrerequis] = useState(props.id !== undefined ? props.initial.prerequis : "");
  const [secteurCible, setSecteurCible] = useState(
    props.id !== undefined ? props.initial.secteurCible : "",
  );
  const [outilsClient, setOutilsClient] = useState(
    props.id !== undefined ? props.initial.outilsClient : "",
  );

  // ── Offre sélectionnée (pour afficher la plage durée) ─────────────────────
  const selectedOffre =
    props.id === undefined ? (props.offres.find((o) => o.id === offreSiteId) ?? null) : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTitreCreateChange(val: string) {
    setTitre(val);
    setSlug(slugify(val));
  }

  function handleSubmitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!offreSiteId) {
      setError("Veuillez sélectionner une offre.");
      return;
    }
    if (!titre.trim()) {
      setError("Le titre est requis.");
      return;
    }
    if (dureeHeures === "" || dureeHeures <= 0) {
      setError("La durée est requise.");
      return;
    }

    startTransition(async () => {
      const result = await createFormationAction({
        titre: titre.trim(),
        slug: slug || slugify(titre.trim()),
        offreSiteId,
        dureeHeures: dureeHeures as number,
        modalite,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`${props.basePath}/${result.data.id}`);
      }
    });
  }

  function handleSubmitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!props.id) return;

    const updatePayload: Parameters<typeof updateFormationAction>[0] = { id: props.id };

    if (titreEdit.trim() && titreEdit.trim() !== props.initial.titre) {
      updatePayload.titre = titreEdit.trim();
    }
    if (methodesPedagogiques.trim() !== (props.initial.methodesPedagogiques ?? "")) {
      const trimmed = methodesPedagogiques.trim();
      if (trimmed) {
        updatePayload.methodesPedagogiques = trimmed;
      }
    }
    if (seuilReussitePct !== "" && seuilReussitePct !== props.initial.seuilReussitePct) {
      updatePayload.seuilReussitePct = seuilReussitePct as number;
    }
    if (ratioPratiquePct !== "" && ratioPratiquePct !== props.initial.ratioPratiquePct) {
      updatePayload.ratioPratiquePct = ratioPratiquePct as number;
    }
    if (accessibleHandicap !== props.initial.accessibleHandicap) {
      updatePayload.accessibleHandicap = accessibleHandicap;
    }
    if (niveau !== props.initial.niveau) {
      updatePayload.niveau = niveau;
    }
    if (prerequis.trim() !== props.initial.prerequis) {
      updatePayload.prerequis = prerequis.trim();
    }
    if (secteurCible.trim() !== props.initial.secteurCible) {
      updatePayload.secteurCible = secteurCible.trim();
    }
    if (outilsClient.trim() !== props.initial.outilsClient) {
      updatePayload.outilsClient = outilsClient.trim();
    }

    startTransition(async () => {
      const result = await updateFormationAction(updatePayload);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess("Formation mise à jour.");
        router.refresh();
      }
    });
  }

  // ── CSS helpers ───────────────────────────────────────────────────────────

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const hintCls =
    "mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  // ── Rendu mode création ────────────────────────────────────────────────────

  if (props.id === undefined) {
    return (
      <form
        onSubmit={handleSubmitCreate}
        className="space-y-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
      >
        <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Nouvelle formation
        </h3>

        {/* Offre rattachée */}
        <div>
          <label htmlFor="ff-offre" className={labelCls}>
            Offre du catalogue <span aria-hidden="true">*</span>
          </label>
          <select
            id="ff-offre"
            value={offreSiteId}
            onChange={(e) => setOffreSiteId(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">— Choisir une offre —</option>
            {props.offres.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.titreFr} ({o.dureeHeuresMin}–{o.dureeHeuresMax} h)
              </option>
            ))}
          </select>
          {selectedOffre && (
            <p className={hintCls}>
              Plage autorisée : {selectedOffre.dureeHeuresMin} à {selectedOffre.dureeHeuresMax}{" "}
              heures.
            </p>
          )}
        </div>

        {/* Titre */}
        <div>
          <label htmlFor="ff-titre" className={labelCls}>
            Titre <span aria-hidden="true">*</span>
          </label>
          <input
            id="ff-titre"
            type="text"
            value={titre}
            onChange={(e) => handleTitreCreateChange(e.target.value)}
            required
            maxLength={255}
            placeholder="Ex. Formation IA générative pour les équipes techniques"
            className={inputCls}
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="ff-slug" className={labelCls}>
            Slug (URL)
          </label>
          <input
            id="ff-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            maxLength={180}
            placeholder="Auto-généré depuis le titre"
            className={inputCls}
          />
          <p className={hintCls}>Doit être unique. Généré automatiquement depuis le titre.</p>
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          {/* Durée */}
          <div>
            <label htmlFor="ff-duree" className={labelCls}>
              Durée (heures) <span aria-hidden="true">*</span>
            </label>
            <input
              id="ff-duree"
              type="number"
              value={dureeHeures}
              onChange={(e) =>
                setDureeHeures(e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
              required
              min={selectedOffre?.dureeHeuresMin ?? 1}
              max={selectedOffre?.dureeHeuresMax ?? 9999}
              className={inputCls}
            />
          </div>

          {/* Modalité */}
          <div>
            <label htmlFor="ff-modalite" className={labelCls}>
              Modalité
            </label>
            <select
              id="ff-modalite"
              value={modalite}
              onChange={(e) => setModalite(e.target.value as ModaliteFormation)}
              className={inputCls}
            >
              {MODALITE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-[var(--space-admin-3)]">
          <button type="submit" disabled={isPending} className="admin-button">
            {isPending ? "Création…" : "Créer la formation"}
          </button>
        </div>
      </form>
    );
  }

  // ── Rendu mode édition ─────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmitEdit}
      className="space-y-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Modifier la formation
      </h3>

      {/* Titre */}
      <div>
        <label htmlFor="ff-edit-titre" className={labelCls}>
          Titre
        </label>
        <input
          id="ff-edit-titre"
          type="text"
          value={titreEdit}
          onChange={(e) => setTitreEdit(e.target.value)}
          maxLength={255}
          className={inputCls}
        />
      </div>

      {/* Méthodes pédagogiques */}
      <div>
        <label htmlFor="ff-edit-methodes" className={labelCls}>
          Méthodes pédagogiques
        </label>
        <textarea
          id="ff-edit-methodes"
          value={methodesPedagogiques}
          onChange={(e) => setMethodesPedagogiques(e.target.value)}
          rows={4}
          className={inputCls}
          placeholder="Décrivez les méthodes pédagogiques employées…"
        />
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Seuil de réussite */}
        <div>
          <label htmlFor="ff-edit-seuil" className={labelCls}>
            Seuil de réussite (%)
          </label>
          <input
            id="ff-edit-seuil"
            type="number"
            value={seuilReussitePct}
            onChange={(e) =>
              setSeuilReussitePct(e.target.value === "" ? "" : parseInt(e.target.value, 10))
            }
            min={0}
            max={100}
            className={inputCls}
          />
        </div>

        {/* Ratio pratique */}
        <div>
          <label htmlFor="ff-edit-ratio" className={labelCls}>
            Ratio pratique (%)
          </label>
          <input
            id="ff-edit-ratio"
            type="number"
            value={ratioPratiquePct}
            onChange={(e) =>
              setRatioPratiquePct(e.target.value === "" ? "" : parseInt(e.target.value, 10))
            }
            min={0}
            max={100}
            className={inputCls}
          />
          <p className={hintCls}>Requis ≥ plancher Qualiopi pour publier.</p>
        </div>
      </div>

      {/* Accessibilité handicap */}
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <input
          id="ff-edit-handicap"
          type="checkbox"
          checked={accessibleHandicap}
          onChange={(e) => setAccessibleHandicap(e.target.checked)}
          className="h-4 w-4 rounded border-[color:var(--color-admin-border)] text-[color:var(--color-admin-accent)] focus:ring-[color:var(--color-admin-accent)]"
        />
        <label
          htmlFor="ff-edit-handicap"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          Accessible aux personnes en situation de handicap (référent handicap)
        </label>
      </div>

      {/* ── Paramètres pédagogiques (enrichissent la génération IA) ── */}
      <fieldset className="rounded border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
        <legend className="px-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)]">
          Paramètres pédagogiques (améliorent la génération IA)
        </legend>

        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          {/* Niveau */}
          <div>
            <label htmlFor="ff-edit-niveau" className={labelCls}>
              Niveau des participants
            </label>
            <select
              id="ff-edit-niveau"
              value={niveau}
              onChange={(e) => setNiveau(e.target.value as NiveauFormation)}
              className={inputCls}
            >
              {NIVEAU_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className={hintCls}>Calibre profondeur, vocabulaire et difficulté.</p>
          </div>

          {/* Secteur cible */}
          <div>
            <label htmlFor="ff-edit-secteur" className={labelCls}>
              Secteur / métier cible
            </label>
            <input
              id="ff-edit-secteur"
              type="text"
              value={secteurCible}
              onChange={(e) => setSecteurCible(e.target.value)}
              maxLength={200}
              className={inputCls}
              placeholder="ex. cabinet d'avocats, BTP, santé…"
            />
            <p className={hintCls}>Ancre les exemples sur ce métier.</p>
          </div>
        </div>

        {/* Prérequis */}
        <div className="mt-[var(--space-admin-4)]">
          <label htmlFor="ff-edit-prerequis" className={labelCls}>
            Prérequis
          </label>
          <textarea
            id="ff-edit-prerequis"
            value={prerequis}
            onChange={(e) => setPrerequis(e.target.value)}
            rows={2}
            maxLength={2000}
            className={inputCls}
            placeholder="Ce que le stagiaire doit déjà savoir/avoir (vide = aucun)…"
          />
        </div>

        {/* Outils client */}
        <div className="mt-[var(--space-admin-4)]">
          <label htmlFor="ff-edit-outils" className={labelCls}>
            Outils / logiciels du client
          </label>
          <textarea
            id="ff-edit-outils"
            value={outilsClient}
            onChange={(e) => setOutilsClient(e.target.value)}
            rows={2}
            maxLength={2000}
            className={inputCls}
            placeholder="ex. Microsoft 365, Salesforce…"
          />
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
