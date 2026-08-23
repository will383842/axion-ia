"use client";
// use-client: écrire dans le presse-papiers exige `navigator.clipboard`, donc du
// JavaScript. C’est le SEUL composant client de la console éditoriale, et le
// test des « deux clics » du §2 bis en dépend directement.

/**
 * Le bouton « copier » du kit de publication (§2 bis C, critères 1 et 2).
 *
 * 🔴 C'est le SEUL composant client de toute la console éditoriale, et il
 * existe pour une raison qu'aucun Server Component ne peut remplir : écrire
 * dans le presse-papiers demande du JavaScript. Le §2 bis pose le test :
 *
 * > « Entre l'ouverture de la publication et le collage dans LinkedIn,
 * >   DEUX CLICS maximum. Si c'en est trois, le kit est mal fait. »
 *
 * Un clic ici, un clic pour coller. D'où : pas de menu, pas de confirmation,
 * pas de sélection préalable. Le texte part au presse-papiers, le bouton dit
 * qu'il l'a fait, et il redevient lui-même deux secondes plus tard.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";

type Etat = "prêt" | "copié" | "échec";

interface Props {
  /** Le texte à copier. Vide ⇒ le bouton est désactivé, pas masqué. */
  texte: string;
  /** Libellé, explicite : « Copier le corps », « Copier le premier commentaire ». */
  libelle: string;
  /** Mise en avant du geste principal. */
  principal?: boolean;
}

export function BoutonCopier({ texte, libelle, principal = false }: Props): React.ReactElement {
  const [etat, setEtat] = useState<Etat>("prêt");
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sans ce nettoyage, un démontage pendant les deux secondes d'attente
  // déclencherait un setState sur un composant absent.
  useEffect(() => {
    return () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    };
  }, []);

  const copier = useCallback(async () => {
    if (!texte) return;
    try {
      // `navigator.clipboard` n'existe pas hors contexte sécurisé (HTTP nu).
      // Le repli par `execCommand` est déprécié mais reste la seule voie sur
      // un poste qui ouvrirait la console en clair sur le réseau local.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texte);
      } else {
        const zone = document.createElement("textarea");
        zone.value = texte;
        zone.setAttribute("readonly", "");
        zone.style.position = "absolute";
        zone.style.left = "-9999px";
        document.body.appendChild(zone);
        zone.select();
        document.execCommand("copy");
        document.body.removeChild(zone);
      }
      setEtat("copié");
    } catch {
      // Un échec silencieux ferait croire à une copie réussie, et on
      // collerait le contenu précédent dans LinkedIn.
      setEtat("échec");
    }
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEtat("prêt"), 2000);
  }, [texte]);

  const vide = texte.length === 0;
  const Icone = etat === "copié" ? Check : etat === "échec" ? AlertTriangle : Copy;

  return (
    <button
      type="button"
      onClick={() => void copier()}
      disabled={vide}
      className={
        principal ? "admin-button admin-button-sm" : "admin-button-secondary admin-button-sm"
      }
      // Le lecteur d'écran doit apprendre le résultat, pas seulement le voir.
      aria-live="polite"
      title={vide ? `${libelle} — rien à copier` : libelle}
    >
      <Icone size={16} aria-hidden="true" className="shrink-0" />
      {etat === "copié" ? "Copié" : etat === "échec" ? "Échec — copiez à la main" : libelle}
    </button>
  );
}
