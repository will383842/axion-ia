/**
 * Console éditoriale — le brief de production d'un asset.
 *
 * Server Component pur : aucun état, donc aucun JavaScript client. Les cases
 * à cocher sont des formulaires d'une ligne, comme le reste de la console.
 *
 * ── Ce que cet écran répare ───────────────────────────────────────────────
 *
 * Jusqu'au 24/08/2026, la fiche savait dire « il faut produire un carrousel
 * de 9 slides » — et rien de plus. Le script, le prompt et le plan slide par
 * slide vivaient dans quatre fichiers Markdown à côté, qu'il fallait rouvrir
 * pour produire quoi que ce soit. Les 238 segments importés ce jour-là
 * s'affichent ici.
 *
 * ── Pourquoi le prompt est dans un `<pre>` séparé ─────────────────────────
 *
 * Un prompt se COLLE tel quel dans un générateur : le moindre retour à la
 * ligne perdu ou la moindre espace avalée change l'image produite. Un `<pre>`
 * le rend octet pour octet, sélectionnable d'un geste. Et il ne partage
 * jamais son bloc avec le texte de la slide : la règle du dossier est qu'un
 * prompt ne contient AUCUN texte à afficher — les générateurs déforment les
 * lettres. Les mélanger visuellement, c'est inviter à les mélanger au collage.
 */

import { Check, RotateCcw } from "lucide-react";
import { AdminBadge } from "@/components/admin/ui";
import { basculerSegmentFaitFormAction } from "@/server/actions/editorial/segments";

export interface SegmentAffiche {
  id: string;
  ordre: number;
  role: string;
  titre: string | null;
  contenu: string | null;
  prompt: string | null;
  fait: boolean;
}

interface Props {
  segments: readonly SegmentAffiche[];
  /** Où revenir après avoir coché — la fiche elle-même. */
  retour: string;
}

/** L'intitulé humain d'un rôle. La base stocke la clé, l'écran dit le mot. */
const LIBELLE_ROLE: Record<string, string> = {
  script: "Script",
  prompt: "Prompt de génération",
  slide: "Slide",
  legende: "Légende du post",
  consigne: "Consigne",
};

export function BriefProduction({ segments, retour }: Props): React.ReactElement | null {
  if (segments.length === 0) return null;

  const slides = segments.filter((s) => s.role === "slide");
  const faits = segments.filter((s) => s.fait).length;

  return (
    <div className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-3">
      <div className="mb-[var(--space-admin-2)] flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
          Brief de production
        </h3>
        {/*
          L'avancement en clair. Entre « à produire » et « prêt », un carrousel
          de dix slides passe des jours dans un état que rien n'affichait.
        */}
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {slides.length > 0
            ? `${segments.filter((s) => s.role === "slide" && s.fait).length} slide(s) sur ${slides.length} · `
            : ""}
          {faits} / {segments.length} fait(s)
        </span>
      </div>

      <ul className="space-y-2">
        {segments.map((s) => (
          <li
            key={s.id}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <AdminBadge tone={s.fait ? "success" : "neutral"}>
                  {LIBELLE_ROLE[s.role] ?? s.role}
                </AdminBadge>
                {s.titre && <span className="min-w-0 truncate font-medium">{s.titre}</span>}
              </span>

              {/*
                Un formulaire par case, qui envoie l'état VOULU et non
                l'inverse de l'état lu : deux clics rapprochés ne se
                marchent pas dessus.
              */}
              <form action={basculerSegmentFaitFormAction} className="shrink-0">
                <input type="hidden" name="segmentId" value={s.id} />
                <input type="hidden" name="retour" value={retour} />
                <input type="hidden" name="fait" value={s.fait ? "0" : "1"} />
                {/*
                  Pas d'utilitaire de disposition ici : `admin-button-ghost`
                  pose déjà `inline-flex`, l'alignement et l'espacement. Les
                  redire est inerte, et un test du dépôt le refuse — à raison :
                  une classe morte laisse croire qu'elle fait quelque chose.
                */}
                <button type="submit" className="admin-button-ghost admin-button-sm">
                  {/* Icône lucide et non pictogramme : la console interdit
                      les emojis dans ses vues — leur dessin dépend du poste,
                      et deux d'entre eux peuvent ne différer que par la
                      couleur. Un test verrouille la règle. */}
                  {s.fait ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : (
                    <Check size={14} aria-hidden="true" />
                  )}
                  {s.fait ? "à refaire" : "fait"}
                </button>
              </form>
            </div>

            {s.contenu && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-bg)] p-2 font-sans text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                {s.contenu}
              </pre>
            )}

            {s.prompt && (
              <>
                <div className="mt-2 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                  {s.role === "slide" ? "Graphisme" : "Prompt — à coller tel quel"}
                </div>
                <pre className="mt-1 max-h-64 overflow-auto rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] p-2 font-mono text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                  {s.prompt}
                </pre>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
