"use client";
// use-client: le glisser-déposer de FICHIER (critère 4) exige les événements
// `drop` et l'API `DataTransfer.files`, hors de portée d'un Server Component.
// C'est le troisième et dernier composant client de la console éditoriale.

/**
 * Console éditoriale — déposer un média sur une publication (critères 4 et 5).
 *
 * > « Déposer un fichier par glisser-déposer crée l'asset, le lie, calcule
 * >   durée et dimensions, génère la vignette — EN UNE ACTION. »
 *
 * « En une action » est le point dur : pas de dialogue, pas de formulaire en
 * deux temps, pas de bouton « confirmer ». On lâche le fichier, et c'est fait.
 *
 * ── Ce que l'écran DIT, et pourquoi ───────────────────────────────────────
 *
 * Trois retours différents, parce qu'ils appellent trois réactions :
 *
 * - **doublon** (critère 5) — le fichier existait déjà, il a été RATTACHÉ et
 *   non dupliqué. On le dit en clair : sans cela, l'utilisateur croit avoir
 *   raté son geste et recommence.
 * - **avertissement** — le fichier est là, mais quelque chose n'a pas été
 *   calculé (durée d'une vidéo, vignette en échec). Un demi-succès annoncé
 *   vaut mieux qu'un succès qui cache un trou.
 * - **erreur** — rien n'a été écrit, et le message dit quoi faire.
 */

import { useState, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

interface Retour {
  ton: "succes" | "doublon" | "avertissement" | "erreur";
  message: string;
}

interface Props {
  publicationId: string;
  /** Action serveur, passée depuis le Server Component. */
  televerser: (donnees: FormData) => Promise<
    | {
        data: { libelle: string; doublon: boolean; avertissement: string | null };
      }
    | { error: string }
  >;
}

export function DepotFichier({ publicationId, televerser }: Props): React.ReactElement {
  const router = useRouter();
  const [survol, setSurvol] = useState(false);
  const [retours, setRetours] = useState<Retour[]>([]);
  const [enCours, demarrerTransition] = useTransition();
  const champ = useRef<HTMLInputElement>(null);

  const envoyer = useCallback(
    (fichiers: FileList | null) => {
      if (!fichiers || fichiers.length === 0) return;
      setRetours([]);

      demarrerTransition(async () => {
        const nouveaux: Retour[] = [];
        // Séquentiel, et non `Promise.all` : deux exemplaires du MÊME fichier
        // envoyés en parallèle passeraient tous deux le contrôle de doublon
        // avant que l'un des deux n'ait écrit. Le critère 5 tomberait sur une
        // course, pas sur un défaut de logique.
        for (const fichier of Array.from(fichiers)) {
          const donnees = new FormData();
          donnees.set("fichier", fichier);
          donnees.set("publicationId", publicationId);

          const r = await televerser(donnees);
          if ("error" in r) {
            nouveaux.push({ ton: "erreur", message: `${fichier.name} — ${r.error}` });
            continue;
          }
          if (r.data.doublon) {
            nouveaux.push({
              ton: "doublon",
              message: r.data.avertissement ?? `${fichier.name} existait déjà.`,
            });
            continue;
          }
          nouveaux.push(
            r.data.avertissement
              ? { ton: "avertissement", message: `${r.data.libelle} — ${r.data.avertissement}` }
              : { ton: "succes", message: `${r.data.libelle} déposé.` },
          );
        }
        setRetours(nouveaux);
        router.refresh();
      });
    },
    [publicationId, televerser, router],
  );

  const couleurDe = (ton: Retour["ton"]): string => {
    if (ton === "erreur") return "var(--color-admin-destructive-fg)";
    if (ton === "doublon" || ton === "avertissement") return "var(--color-admin-warning-fg)";
    return "var(--color-admin-success-fg)";
  };

  return (
    <div>
      {/* Le champ natif reste le chemin CLAVIER : une zone de dépôt seule
          serait inutilisable sans souris. */}
      <label
        htmlFor={`depot-${publicationId}`}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          envoyer(e.dataTransfer.files);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-admin-md)] border-2 border-dashed p-6 text-center transition-colors",
          survol
            ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)]"
            : "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]",
        ].join(" ")}
      >
        <UploadCloud size={24} aria-hidden="true" />
        <span className="font-medium">
          {enCours ? "Dépôt en cours…" : "Glissez un fichier ici, ou cliquez pour choisir"}
        </span>
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Images, PDF, vidéos courtes et audio. Les rushes restent sur le volume de montage.
        </span>
        <input
          id={`depot-${publicationId}`}
          ref={champ}
          type="file"
          multiple
          disabled={enCours}
          onChange={(e) => envoyer(e.target.files)}
          className="sr-only"
        />
      </label>

      {retours.length > 0 && (
        <ul className="mt-[var(--space-admin-3)] space-y-1" aria-live="polite">
          {retours.map((r, i) => (
            <li
              key={`${r.ton}-${i}`}
              style={{ color: couleurDe(r.ton) }}
              className="text-[length:var(--text-admin-sm)]"
            >
              {r.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
