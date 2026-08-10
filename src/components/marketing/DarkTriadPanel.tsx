// Server Component — panneau MOCHA à trois colonnes.
//
// Extrait de `TrustSignalsPanel` (accueil) le 2026-08-10 pour être réutilisé sur
// /methodologie. Rôle éditorial : casser le rythme ivoire d'une page longue par
// un bloc brun profond (jeton `--color-mocha` de la charte, jamais du noir) qui
// se lit comme un encart premium.
// À réserver aux sections « parti pris / réassurance » : son
// effet vient de sa rareté, deux panneaux sur une même page l'annulent.
//
// Décor : halo terracotta en dégradé radial (extinction douce, pas de bord dur)
// + trame de points. Aucun filtre `blur-*` — coûteux au paint.
//
// Contraste : `mocha-fg`, `mocha-fg-muted` et `terracotta-on-mocha` sur `mocha`
// sont trois paires vérifiées WCAG AA par `pnpm contrast:check`.
//
// Composant serveur pur : icônes Lucide rendues en HTML au build, 0 KB de JS.

import type { LucideIcon } from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";

export interface DarkTriadItem {
  Icon: LucideIcon;
  title: string;
  description: string;
  /** Repère court optionnel affiché au-dessus du titre (ex. « 01 »). */
  eyebrow?: string;
}

export function DarkTriadPanel({ items }: { items: readonly DarkTriadItem[] }) {
  return (
    <FadeInOnView>
      <div className="bg-mocha relative overflow-hidden rounded-2xl">
        {/* Halo terracotta — dégradé radial : extinction douce, pas de bord dur
            (une forme pleine, même à faible opacité, laisse une arête visible). */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(70% 130% at 88% 0%, var(--color-terracotta) 0%, transparent 60%)",
          }}
        />
        {/* Trame de points — matière discrète sur le brun */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(var(--color-mocha-fg-muted) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        <ul className="divide-border-on-mocha relative grid grid-cols-1 divide-y p-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:p-12">
          {items.map((item, idx) => (
            <li
              key={item.title}
              className="flex flex-col gap-4 py-7 first:pt-0 last:pb-0 sm:px-8 sm:py-0 sm:first:pt-0 sm:first:pl-0 sm:last:pr-0"
            >
              <FadeInOnView delay={idx * 80}>
                {/* Puce d'icône — cercle translucide cerclé, lisible sur mocha */}
                <span
                  aria-hidden="true"
                  className="border-border-on-mocha text-terracotta-on-mocha inline-flex h-12 w-12 items-center justify-center rounded-full border bg-white/5"
                >
                  <item.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                {item.eyebrow ? (
                  <p className="text-terracotta-on-mocha mt-4 text-xs font-bold tracking-[0.18em] uppercase">
                    {item.eyebrow}
                  </p>
                ) : null}
                <h3
                  className={`text-mocha-fg text-base leading-tight font-bold tracking-tight sm:text-lg ${
                    item.eyebrow ? "mt-2" : "mt-4"
                  }`}
                >
                  {item.title}
                </h3>
                <p className="text-mocha-fg-muted mt-2 text-sm leading-relaxed">
                  {item.description}
                </p>
              </FadeInOnView>
            </li>
          ))}
        </ul>
      </div>
    </FadeInOnView>
  );
}
