"use client";
// use-client: trois îlots minimes de la rubrique Documents — nom et poids du fichier choisi (champ natif masqué) avec refus d'un fichier trop lourd avant l'envoi, « Ajout en cours… » pendant l'envoi, et copie du lien client dans le presse-papiers. Le reste du formulaire est rendu au serveur.

/**
 * Îlots clients de la rubrique « Documents » d'un projet (ADR 0063).
 *
 * Tout le formulaire est rendu au SERVEUR (`AjouterDocument.tsx`) : il marche
 * sans JavaScript. Ces îlots n'ajoutent que du confort, et le moins d'octets
 * possible à la console : le cliquet du poids de la console admin n'avait
 * qu'environ 1 Ko de marge le 01/10. D'où AUCUN import du projet ici (la limite
 * de taille arrive en propriété, depuis `formats.ts`, côté serveur). Le serveur
 * revérifie tout.
 */

import { useState } from "react";
import { useFormStatus } from "react-dom";

const MO = 1048576;
const discretCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

/** Le bouton « Choisir un fichier », le champ natif masqué, et ce qui a été choisi. */
export function ChampFichierDocument({
  accept,
  decritPar,
  tailleMax,
}: {
  accept: string;
  decritPar: string;
  /** `TAILLE_MAX_FICHIER_OCTETS`, passée par le serveur. */
  tailleMax: number;
}): React.ReactElement {
  const [choisi, setChoisi] = useState("Aucun fichier choisi");
  const [alerte, setAlerte] = useState("");
  return (
    <>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <label
          htmlFor="document-fichier"
          className="admin-button-secondary min-h-[44px] cursor-pointer"
        >
          Choisir un fichier
        </label>
        <input
          id="document-fichier"
          name="fichier"
          type="file"
          accept={accept}
          className="sr-only"
          aria-describedby={decritPar}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            setAlerte("");
            setChoisi("Aucun fichier choisi");
            if (!f) return;
            if (f.size > tailleMax) {
              e.currentTarget.value = "";
              setAlerte(
                `Ce fichier pèse ${Math.ceil(f.size / MO)} Mo : la limite est de 15 Mo. ` +
                  "Enregistrez-le en PDF plus léger, ou déposez-le en ligne et collez son lien.",
              );
              return;
            }
            setChoisi(`${f.name} · ${(f.size / MO).toFixed(1).replace(".", ",")} Mo`);
          }}
        />
        <span className={discretCls}>{choisi}</span>
      </div>
      {alerte ? (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {alerte}
        </p>
      ) : null}
    </>
  );
}

/** « Ajouter le document » (« Ajout en cours… » pendant l'envoi) et « Annuler », qui referme le formulaire. */
export function BoutonsAjoutDocument(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className="admin-button min-h-[44px]" disabled={pending}>
        {pending ? "Ajout en cours…" : "Ajouter le document"}
      </button>
      <button
        type="button"
        className="admin-button-ghost min-h-[44px]"
        onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
      >
        Annuler
      </button>
    </>
  );
}

/**
 * « Copier le lien client » — seulement pour une page partageable (D12,
 * `estPartageable`). Le lien est aussi dans `title` : sans presse-papiers,
 * Will peut le lire.
 */
export function CopierLienClient({
  lien,
  titre,
}: {
  lien: string;
  titre: string;
}): React.ReactElement {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className="admin-button-secondary min-h-[44px]"
      title={lien}
      onClick={() => void navigator.clipboard?.writeText(lien).then(() => setCopie(true))}
    >
      {copie ? "Lien copié" : "Copier le lien client"}
      <span className="sr-only">{` de « ${titre} »`}</span>
    </button>
  );
}
