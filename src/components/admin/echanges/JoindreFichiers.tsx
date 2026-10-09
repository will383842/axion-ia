"use client";
// use-client: choix des fichiers (bibliothèque ou ordinateur) — chargé SEULEMENT au clic sur « Joindre des fichiers ».

/**
 * JOINDRE DES FICHIERS À UNE RÉPONSE (Candidatures unifiées L5, plan § 5).
 *
 * Deux sources, comme la maquette :
 *   - « Depuis ma bibliothèque » : cases à cocher (liste calculée côté serveur) ;
 *   - « Depuis mon ordinateur » : le déposeur de la bibliothèque (L4), en mode
 *     ponctuel — le fichier n'entre pas dans la bibliothèque et rejoint la
 *     sélection une fois déposé ; l'envoi du message attend donc la fin.
 *
 * Les fichiers partent comme UN lien personnel ajouté à la fin du message,
 * jamais en pièce jointe.
 *
 * L6 — partagé par les deux mondes. Côté réseau d'apporteurs, `ordinateur`
 * vaut `false` : seule la bibliothèque est proposée (kit et présentation, déjà
 * filtrés par le serveur), jamais un fichier ponctuel.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { FolderOpen, Monitor } from "lucide-react";

import type { FichierBibliothequeComposeur, FichierJoint } from "./Composeur";

const DeposeurFichier = dynamic(
  () =>
    import("@/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/bibliotheque/_composants/DeposeurFichier"),
  {
    ssr: false,
    loading: () => <p className="admin-meta-small">Chargement…</p>,
  },
);

interface Props {
  readonly bibliotheque: ReadonlyArray<FichierBibliothequeComposeur>;
  readonly choisis: ReadonlyArray<FichierJoint>;
  readonly onChanger: (fichiers: FichierJoint[]) => void;
  readonly onFermer: () => void;
  /** « Depuis mon ordinateur » proposé ? (faux côté réseau d'apporteurs) */
  readonly ordinateur?: boolean;
  /** Phrase quand la bibliothèque n'a rien à proposer. */
  readonly videTexte?: string;
}

export default function JoindreFichiers({
  bibliotheque,
  choisis,
  onChanger,
  onFermer,
  ordinateur = true,
  videTexte = "La bibliothèque est vide : déposez un fichier depuis votre ordinateur, ou ajoutez-le d'abord dans « Bibliothèque de fichiers ».",
}: Props) {
  const [source, setSource] = useState<"bibliotheque" | "ordinateur">("bibliotheque");
  const ids = new Set(choisis.map((f) => f.id));

  function basculer(f: FichierBibliothequeComposeur): void {
    if (ids.has(f.id)) onChanger(choisis.filter((x) => x.id !== f.id));
    else
      onChanger([
        ...choisis,
        { id: f.id, titre: f.titre, categorie: f.categorie, taille: f.taille },
      ]);
  }

  return (
    <div className="admin-card-inset">
      {ordinateur ? (
        <div
          className="mb-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]"
          role="group"
          aria-label="Source des fichiers"
        >
          <button
            type="button"
            className={
              source === "bibliotheque"
                ? "admin-button-secondary admin-button-sm admin-button-active admin-button-tactile"
                : "admin-button-ghost admin-button-sm admin-button-tactile"
            }
            aria-pressed={source === "bibliotheque"}
            onClick={() => setSource("bibliotheque")}
          >
            <FolderOpen size={14} aria-hidden="true" /> Depuis ma bibliothèque
          </button>
          <button
            type="button"
            className={
              source === "ordinateur"
                ? "admin-button-secondary admin-button-sm admin-button-active admin-button-tactile"
                : "admin-button-ghost admin-button-sm admin-button-tactile"
            }
            aria-pressed={source === "ordinateur"}
            onClick={() => setSource("ordinateur")}
          >
            <Monitor size={14} aria-hidden="true" /> Depuis mon ordinateur
          </button>
        </div>
      ) : null}

      {source === "bibliotheque" || !ordinateur ? (
        bibliotheque.length === 0 ? (
          <p className="admin-meta-small">{videTexte}</p>
        ) : (
          <ul className="grid gap-[var(--space-admin-2)]">
            {bibliotheque.map((f) => (
              <li key={f.id}>
                <label className="admin-checkbox">
                  <input type="checkbox" checked={ids.has(f.id)} onChange={() => basculer(f)} />
                  <span>
                    {f.titre}{" "}
                    <span className="admin-meta-small">
                      · {f.libelleCategorie}
                      {f.tailleLisible ? ` · ${f.tailleLisible}` : ""}
                      {f.enAnalyse ? " · antivirus en cours" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )
      ) : (
        <DeposeurFichier
          ponctuel
          onFermer={() => setSource("bibliotheque")}
          onDepose={(f) =>
            onChanger([
              ...choisis.filter((x) => x.id !== f.id),
              { id: f.id, titre: f.titre, categorie: f.categorie, taille: f.taille },
            ])
          }
        />
      )}

      <div className="mt-[var(--space-admin-3)]">
        <button type="button" className="admin-button-ghost admin-button-sm" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}
