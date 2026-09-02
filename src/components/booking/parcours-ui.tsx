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
 */
export function TeteDeParcours({
  icone,
  ton,
  titre,
  sous,
}: {
  icone: ReactNode;
  ton: "ok" | "attention";
  titre: string;
  sous: string;
}) {
  return (
    <div className="mb-6">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
          ton === "ok" ? "bg-sage text-mocha-fg" : "bg-terracotta text-mocha-fg"
        }`}
      >
        {icone}
      </div>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {titre}
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">{sous}</p>
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
    <div className="border-border mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:gap-5">
      {principale ? (
        <Link
          href={principale.href}
          className="bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-[15px] font-semibold text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
        >
          {principale.label}
        </Link>
      ) : null}
      {secondaire ? (
        <Link
          href={secondaire.href}
          className="text-fg-soft hover:text-terracotta-deep inline-flex min-h-11 items-center justify-center text-sm font-medium underline underline-offset-2 sm:min-h-0 sm:justify-start"
        >
          {secondaire.label}
        </Link>
      ) : null}
    </div>
  );
}
