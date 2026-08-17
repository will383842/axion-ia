"use client";
// use-client: état local + rendu du dialogue de confirmation.

/**
 * 🔴 REMPLACER `window.confirm` SANS RÉÉCRIRE NEUF COMPOSANTS.
 *
 * ## Le défaut
 *
 * Neuf écrans de la console appelaient `window.confirm()` — dont la suppression
 * définitive d'un document, l'annulation d'un dossier de financement et la
 * purge RGPD d'un stagiaire.
 *
 * Trois problèmes, dans l'ordre de gravité :
 *
 *   1. **Il gèle l'automatisation.** Une boîte de dialogue native bloque tout
 *      événement navigateur : aucun test Playwright ne peut traverser l'écran.
 *      C'est une des raisons pour lesquelles le parcours admin n'a jamais pu
 *      être rejoué de bout en bout.
 *   2. **Il ne dit pas la conséquence.** Une seule phrase, aucune place pour
 *      « ceci est définitif et révoque les accès ». On clique « OK » par
 *      réflexe.
 *   3. **Il n'est pas stylable ni traduisible** — le bouton dit « OK » et
 *      « Annuler » dans la langue du navigateur, pas celle de la console.
 *
 * ## Pourquoi un crochet, et pas neuf réécritures
 *
 * `AdminConfirmDialog` existait **déjà** — écrit, exporté, avec sa
 * confirmation en deux temps et son retour de focus au déclencheur. Il avait
 * **zéro consommateur**. C'est exactement le défaut qu'on vient de corriger sur
 * `lienTelechargement` : une capacité que personne n'appelle n'est pas une
 * capacité.
 *
 * Le manquant n'était pas le composant, c'était la **forme d'appel**. Chaque
 * site faisait `if (!window.confirm(msg)) return;` en tête de son gestionnaire ;
 * brancher un dialogue contrôlé demandait d'y ajouter un état, un effet et un
 * rendu — neuf fois. Ce crochet rend l'appel aussi court que l'original.
 *
 * ```tsx
 * const { demander, dialogue } = useConfirmation();
 * // …
 * function supprimer() {
 *   demander({ titre: "…", description: "…", destructif: true }, () => {
 *     // le geste réel
 *   });
 * }
 * return (<>{dialogue}<button onClick={supprimer}>Supprimer</button></>);
 * ```
 */

import { useCallback, useRef, useState } from "react";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

export interface DemandeConfirmation {
  readonly titre: string;
  /**
   * Ce qui va se passer. ⚠️ Écrire la CONSÉQUENCE, pas la question : « ceci est
   * définitif et révoque les liens d'émargement » fait réfléchir, « êtes-vous
   * sûr ? » ne fait que demander un second clic.
   */
  readonly description: string;
  readonly destructif?: boolean;
  readonly libelleConfirmer?: string;
  /**
   * Chaîne à recopier pour armer le bouton (confirmation en deux temps).
   * À réserver aux gestes réellement irréversibles : l'imposer partout
   * apprendrait à la recopier sans lire.
   */
  readonly recopier?: string;
}

export function useConfirmation(): {
  readonly demander: (demande: DemandeConfirmation, geste: () => void | Promise<void>) => void;
  readonly dialogue: React.ReactElement | null;
} {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  // Le geste vit dans une ref : le placer dans l'état re-déclencherait un rendu
  // à chaque ouverture, et une fonction n'est pas une donnée d'affichage.
  const gesteRef = useRef<(() => void | Promise<void>) | null>(null);

  const demanderConfirmation = useCallback(
    (d: DemandeConfirmation, geste: () => void | Promise<void>) => {
      gesteRef.current = geste;
      setDemande(d);
    },
    [],
  );

  const dialogue =
    demande === null ? null : (
      <AdminConfirmDialog
        open
        onOpenChange={(ouvert) => {
          if (!ouvert) setDemande(null);
        }}
        title={demande.titre}
        description={demande.description}
        {...(demande.destructif === true ? { destructive: true } : {})}
        {...(demande.libelleConfirmer !== undefined
          ? { confirmLabel: demande.libelleConfirmer }
          : {})}
        {...(demande.recopier !== undefined ? { requireTypeToConfirm: demande.recopier } : {})}
        onConfirm={async () => {
          const geste = gesteRef.current;
          // On referme AVANT d'exécuter : le geste déclenche souvent un
          // `router.refresh()`, et un dialogue resté ouvert par-dessus une page
          // rafraîchie donne l'impression que rien ne s'est passé.
          setDemande(null);
          await geste?.();
        }}
      />
    );

  return { demander: demanderConfirmation, dialogue };
}
