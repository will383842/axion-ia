/**
 * Les briques communes aux écrans de FIN du parcours d'appel — confirmation,
 * annulation, report — et à leurs refus.
 *
 * ## Pourquoi un module partagé, et pas trois copies
 *
 * Mesuré au téléphone (375 px) le 2026-09-02 : « C'est réservé » portait un
 * pictogramme, « C'est annulé » et « C'est déplacé » n'en portaient pas, et
 * les sorties étaient deux liens texte de 21 px qui se repliaient sur deux
 * lignes avec le point médian orphelin — « voulez · Retour à l'accueil ». Trois
 * pages qui disent la même chose avec trois têtes différentes se lisent comme
 * trois sites. Une seule tête, une seule rangée de sorties, dérivées ici.
 *
 * ## 🔑 La sortie PRINCIPALE est un bouton, la secondaire un lien
 *
 * Après une annulation, la seule action utile est de reprendre un rendez-vous :
 * elle mérite une cible de 44 px pleine largeur sous le pouce, pas un lien
 * souligné. Le retour à l'accueil reste un lien, mais avec une hauteur de
 * cible minimale au téléphone. Les deux s'empilent sous `sm`, et se rangent
 * en ligne au-dessus.
 *
 * ## 🎯 Le passage « punch » du 2026-09-02 — ce qui a changé, et pourquoi
 *
 * Will : « il manque de punch », « il manque aussi un peu de contraste à des
 * endroits ». Trois gestes, tous portés ICI pour que les trois écrans en
 * profitent ensemble :
 *
 * 1. **La pastille porte un halo.** 48 px de couleur pleine posés sur l'ivoire
 *    se lisaient comme une puce ; le même carré ceint d'un anneau de 4 px dans
 *    la version douce de sa propre couleur occupe 56 px et se lit comme un
 *    sceau. Aucun pixel de mise en page perdu : l'anneau ne pousse rien.
 * 2. **Le titre grandit** (28 → 40 px au plafond) et le sous-titre passe de
 *    15 à 16/17 px. Un écran de fin n'a qu'une phrase à faire lire.
 * 3. **Les traits pâles passent en `border-strong`.** `--color-border` sur
 *    l'ivoire donne un trait qu'on devine ; `--color-border-strong`, plus
 *    saturé, donne un trait qu'on voit. Le jeton existait pour ça — son
 *    commentaire dans `globals.css` dit « dividers marqués ». (Les valeurs
 *    exactes ne se recopient pas ici : `globals.css` est le seul fichier où
 *    un hex a le droit d'être écrit, et le linter `anti-hex` le vérifie.)
 *
 * ## ⛔ `bg-terracotta` s'appaire avec `text-mocha-fg`, JAMAIS avec du blanc pur
 *
 * C'est la règle du dépôt (cf. `src/components/ui/button.tsx`), et
 * `/fr/appel` fait partie des pages tenues à zéro violation axe serious —
 * `color-contrast` y est classé serious. Le bouton de sortie portait
 * `text-white` : remplacé, et verrouillé par
 * `__tests__/parcours-ui.spec.tsx`.
 */
import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

/** Une sortie : où elle mène, et ce qu'elle dit. */
export interface Sortie {
  readonly href: Href;
  readonly label: string;
}

/**
 * Pictogramme, titre, sous-titre. `ton="ok"` pour un geste accompli,
 * `ton="attention"` pour un refus, une attente ou un point à vérifier.
 *
 * ⚠️ `surtitre` se place AU-DESSUS de la pastille, pas entre elle et le titre.
 * Ce n'est pas un choix esthétique : la garde voisine lit la pastille comme
 * `h1.previousElementSibling` pour distinguer les deux tons. L'intercaler
 * casserait cette lecture sans qu'aucun rendu ne change à l'œil.
 */
export function TeteDeParcours({
  icone,
  ton,
  titre,
  sous,
  surtitre,
}: {
  icone: ReactNode;
  ton: "ok" | "attention";
  titre: string;
  sous: string;
  surtitre?: string;
}) {
  return (
    <div className="mb-7">
      {surtitre ? (
        <p className="text-terracotta mb-3 text-[11px] font-semibold tracking-widest uppercase sm:text-xs">
          {surtitre}
        </p>
      ) : null}
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-4 ${
          ton === "ok"
            ? "bg-sage text-mocha-fg ring-sage-soft"
            : "bg-terracotta text-mocha-fg ring-terracotta-soft"
        }`}
      >
        {icone}
      </div>
      <h1
        className="text-fg text-[clamp(1.75rem,6.5vw,2.5rem)] leading-[1.1] font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {titre}
      </h1>
      <p className="text-fg-soft mt-3 text-base leading-relaxed sm:text-[17px]">{sous}</p>
    </div>
  );
}

/**
 * La rangée de sorties en pied d'écran. Jamais de cul-de-sac : au moins une
 * des deux est attendue.
 */
export function SortiesDeParcours({
  principale,
  secondaire,
}: {
  principale?: Sortie;
  secondaire?: Sortie;
}) {
  return (
    <div className="border-border-strong mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:gap-5">
      {principale ? (
        <Link
          href={principale.href}
          className="bg-terracotta-deep text-mocha-fg hover:bg-terracotta focus-visible:ring-terracotta inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-[15px] font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
        >
          {principale.label}
        </Link>
      ) : null}
      {secondaire ? (
        <Link
          href={secondaire.href}
          className="text-fg-soft hover:text-terracotta-deep inline-flex min-h-11 items-center justify-center text-[15px] font-medium underline underline-offset-4 sm:min-h-0 sm:justify-start"
        >
          {secondaire.label}
        </Link>
      ) : null}
    </div>
  );
}
