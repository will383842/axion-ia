"use client";
// use-client: capture d'un tracé sur <canvas> via Pointer Events.
/**
 * SignaturePad — pavé de signature, sans aucune dépendance.
 *
 * ## 🔴 RGPD article 9 — la contrainte qui gouverne ce fichier
 *
 * La CNIL qualifie la « dynamique de tracé » — pression, vitesse, timing,
 * inclinaison du stylet — de caractéristique BIOMÉTRIQUE COMPORTEMENTALE. La
 * capturer ferait basculer tout le dispositif sous l'article 9 : interdiction de
 * principe, analyse d'impact probable. Le tracé rasterisé, lui, reste une donnée
 * personnelle ordinaire (article 6).
 *
 * Or `PointerEvent` expose précisément `pressure`, `timeStamp`, `tiltX`,
 * `tiltY`, `twist` et `pointerType`. Ce composant ne lit QUE `clientX`/`clientY`.
 * Aucun tableau de points, aucun horodatage, aucune vitesse n'est conservé en
 * mémoire au-delà du point précédent, ni sérialisé. La seule sortie est
 * `canvas.toDataURL("image/png")` : des pixels.
 *
 * ⚠️ Toute évolution qui lirait un autre champ de l'événement, ou qui
 * conserverait la suite des points, ferait changer le régime juridique du
 * produit. Ce n'est pas une préférence de style.
 *
 * ## Accessibilité
 *
 * Un canvas n'offre aucun chemin clavier ni lecteur d'écran. Ce composant ne
 * prétend donc PAS être accessible : il expose `onBasculerAccessible` pour que
 * la page propose la modalité de remplacement (case à cocher + saisie du nom),
 * qui est le vrai chemin conforme. Le canvas porte malgré tout un `role="img"`
 * et un `aria-label` pour être annoncé, et un bouton « Effacer » atteignable au
 * clavier.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface SignaturePadProps {
  /** Rappelé à chaque changement : data-URL PNG, ou `null` si le pavé est vide. */
  onChange: (dataUrl: string | null) => void;
  /** Proposé sous le pavé — le chemin clavier et lecteur d'écran. */
  onBasculerAccessible?: (() => void) | undefined;
  disabled?: boolean | undefined;
  /** Étiquette accessible du pavé. */
  label?: string | undefined;
}

/** Résolution de rendu. Au-delà, on stocke du bruit, pas du tracé. */
const LARGEUR = 600;
const HAUTEUR = 220;
const EPAISSEUR = 2.5;

export function SignaturePad({
  onChange,
  onBasculerAccessible,
  disabled = false,
  label = "Zone de signature",
}: SignaturePadProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dessine = useRef(false);
  // Point précédent UNIQUEMENT — pas l'historique du tracé. Conserver la suite
  // des points reconstituerait la dynamique que l'article 9 interdit.
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const [vide, setVide] = useState(true);

  const contexte = useCallback((): CanvasRenderingContext2D | null => {
    const c = canvasRef.current;
    return c === null ? null : c.getContext("2d");
  }, []);

  useEffect(() => {
    const ctx = contexte();
    if (ctx === null) return;
    ctx.lineWidth = EPAISSEUR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [contexte]);

  /**
   * Coordonnées dans le repère du canvas.
   *
   * On lit `clientX`/`clientY` et RIEN d'autre de l'événement. Le rapport entre
   * la taille CSS et la taille du buffer est appliqué ici pour que le tracé
   * suive le doigt quelle que soit la largeur d'écran.
   */
  function pointDe(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LARGEUR,
      y: ((e.clientY - rect.top) / rect.height) * HAUTEUR,
    };
  }

  function commencer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dessine.current = true;
    dernier.current = pointDe(e);
    setVide(false);
  }

  function tracer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessine.current || disabled) return;
    const ctx = contexte();
    const depart = dernier.current;
    if (ctx === null || depart === null) return;

    const point = pointDe(e);
    ctx.beginPath();
    ctx.moveTo(depart.x, depart.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    dernier.current = point;
  }

  function terminer() {
    if (!dessine.current) return;
    dessine.current = false;
    dernier.current = null;
    // L'image n'est produite qu'au relâché : la produire à chaque mouvement
    // encoderait indirectement la vitesse du tracé dans la suite des appels.
    const c = canvasRef.current;
    if (c !== null) onChange(c.toDataURL("image/png"));
  }

  function effacer() {
    const ctx = contexte();
    const c = canvasRef.current;
    if (ctx === null || c === null) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setVide(true);
    dernier.current = null;
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={LARGEUR}
        height={HAUTEUR}
        role="img"
        aria-label={label}
        className="w-full touch-none rounded-md border border-neutral-400 bg-white"
        style={{ aspectRatio: `${LARGEUR} / ${HAUTEUR}` }}
        onPointerDown={commencer}
        onPointerMove={tracer}
        onPointerUp={terminer}
        onPointerLeave={terminer}
        onPointerCancel={terminer}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={effacer}
          disabled={disabled || vide}
          className="text-sm underline underline-offset-4 disabled:opacity-50"
        >
          Effacer et recommencer
        </button>

        {onBasculerAccessible !== undefined && (
          <button
            type="button"
            onClick={onBasculerAccessible}
            className="text-sm underline underline-offset-4"
          >
            Je préfère signer sans tracer (clavier)
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-600">
        Seule l&apos;image de votre signature est enregistrée. Ni la pression, ni la vitesse, ni la
        durée de votre tracé ne sont mesurées ou transmises.
      </p>
    </div>
  );
}
