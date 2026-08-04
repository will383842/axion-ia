/**
 * Coquille commune aux espaces connectés — stagiaire, formateur, ressources.
 *
 * ## Le défaut corrigé
 *
 * Les trois espaces étaient des colonnes uniques où tout s'empilait : sept
 * blocs à la suite pour le stagiaire, sans la moindre navigation. Un bénéficiaire
 * qui cherchait son attestation devait faire défiler la page en espérant la
 * reconnaître, et rien ne lui disait ce qu'il avait à faire.
 *
 * ## Le parti pris
 *
 * Une **barre latérale à gauche** sur écran large, une **barre d'onglets en bas**
 * sur mobile. Ce n'est pas un choix esthétique : sur mobile, le bas de l'écran
 * est la seule zone atteignable au pouce d'une main, et c'est là que les
 * applications que nos utilisateurs manipulent tous les jours mettent leur
 * navigation. Une barre latérale repliée derrière un bouton « hamburger »
 * cacherait la navigation exactement au public qui en a le plus besoin.
 *
 * ## Zéro JavaScript pour naviguer
 *
 * L'état actif vient du SERVEUR (`sectionActive`), pas de `usePathname()`. Cette
 * coquille reste donc un composant serveur : elle n'ajoute pas un octet au
 * bundle, ce qui compte sur des pages soumises au budget « First Load ≤ 75 KB gz »
 * (AGENTS.md) et consultées depuis un téléphone en salle de formation.
 *
 * C'est aussi ce qui garantit `CLS = 0` : rien n'est monté après coup, la
 * barre latérale est dans le HTML initial à sa taille définitive.
 *
 * ## Présentation PURE
 *
 * Ce composant n'importe rien du domaine Qualiopi — il reçoit sa navigation et
 * son utilisateur en props. C'est ce qui lui permet de servir trois espaces aux
 * données très différentes sans les coupler entre eux, et de rester hors du
 * périmètre du contrôle d'isolation.
 */

import type { LucideIcon } from "lucide-react";
// `next/link` et non le `Link` typé de `@/i18n/navigation` : les espaces privés
// ne sont pas déclarés dans `pathnames` (noindex, FR uniquement), et les y
// inscrire ferait entrer des routes internes dans le routage public.
import Link from "next/link";

export interface EspaceNavItem {
  /** Clé stable, comparée à `sectionActive`. Jamais l'URL : elle change. */
  cle: string;
  /** Chemin ABSOLU, locale comprise (ex. `/fr/portail/mon-espace`). */
  href: string;
  label: string;
  /** Libellé court pour la barre du bas (mobile). Défaut : `label`. */
  labelCourt?: string;
  icone: LucideIcon;
  /**
   * Nombre d'actions en attente. `0` ou absent = aucune pastille.
   * Une pastille qui affiche « 0 » inquiète sans rien signaler.
   */
  enAttente?: number;
}

export interface EspaceShellProps {
  /** Nom de l'espace, affiché en tête de la barre latérale. */
  titreEspace: string;
  /** Ligne d'accroche sous le titre. Doit dire à QUI l'espace appartient. */
  sousTitreEspace?: string;
  navigation: readonly EspaceNavItem[];
  sectionActive: string;
  /** Identité affichée en pied de barre latérale. */
  utilisateur?: { nom: string; detail?: string };
  /** Bouton de sortie (composant client fourni par l'appelant). */
  actionSortie?: React.ReactNode;
  children: React.ReactNode;
}

/** Initiales pour l'avatar. Deux lettres au plus — au-delà c'est illisible. */
function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}

/**
 * Pastille de comptage. Le terracotta de MARQUE ici, pas la variante claire :
 * c'est un FOND sous du texte ivoire (5,24:1), l'usage pour lequel il est
 * calibré. Cf. `--color-terracotta-on-mocha` dans `globals.css`.
 */
function Pastille({ nombre }: { nombre: number }) {
  return (
    <span
      className="bg-terracotta text-mocha-fg ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
      aria-label={`${nombre} action${nombre > 1 ? "s" : ""} en attente`}
    >
      {nombre}
    </span>
  );
}

export function EspaceShell({
  titreEspace,
  sousTitreEspace,
  navigation,
  sectionActive,
  utilisateur,
  actionSortie,
  children,
}: EspaceShellProps): React.ReactElement {
  return (
    <div className="bg-bg min-h-screen lg:flex">
      {/* ── Barre latérale (écran large) ────────────────────────────────── */}
      {/*
        🔴 Hauteur : `--header-total-h`, PAS `h-screen` (vérification en
        production du 2026-08-04).

        Ces espaces sont rendus sous le header public, qui est COLLANT. Une
        barre en `h-screen` collée à `top-0` mesurait donc une hauteur d'écran
        entière à partir de 81 px plus bas : elle dépassait d'autant, et son
        pied — l'identité et « Se déconnecter » — commençait sous le pli. Sur
        une page courte (« Vous êtes à jour »), il fallait faire défiler pour
        trouver de quoi se déconnecter, sur le seul écran où c'est attendu.
      */}
      <aside
        className="bg-mocha hidden shrink-0 lg:sticky lg:top-[var(--header-total-h)] lg:flex lg:h-[calc(100vh-var(--header-total-h))] lg:w-68 lg:flex-col"
        aria-label={`Navigation — ${titreEspace}`}
      >
        <div className="border-border-on-mocha border-b px-6 py-6">
          <p className="text-mocha-fg font-serif text-lg leading-tight font-semibold">
            {titreEspace}
          </p>
          {sousTitreEspace ? (
            <p className="text-mocha-fg-muted mt-1 text-sm leading-snug">{sousTitreEspace}</p>
          ) : null}
        </div>

        {/*
          🔴 L'étiquette est portée par le `<nav>`, PAS par le `<aside>` qui
          l'entoure. Une première version la mettait sur l'aside : la barre
          latérale était alors une navigation ANONYME pour un lecteur d'écran,
          alors que celle du bas était nommée. Défaut trouvé par le test.

          Les deux barres portent le même nom, et c'est correct : ce sont deux
          rendus de la MÊME navigation, et `hidden` / `lg:hidden` en retirent
          toujours une de l'arbre d'accessibilité — jamais les deux à la fois.
        */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label={`Navigation — ${titreEspace}`}
        >
          <ul className="space-y-1">
            {navigation.map((item) => {
              const actif = item.cle === sectionActive;
              const Icone = item.icone;
              return (
                <li key={item.cle}>
                  {/*
                    L'état actif se dit TROIS fois — fond plus clair, filet
                    d'accent à gauche, icône colorée — et jamais par la couleur
                    seule. Un daltonien, un écran mal calibré ou un mode
                    contraste élevé en gardent au moins un.

                    Le filet est un `<span>` positionné, pas une `border-left` :
                    une bordure décalerait le texte de 3 px entre l'état actif et
                    l'état inactif, ce qui ferait « sauter » le libellé à chaque
                    changement de page.
                  */}
                  <Link
                    href={item.href}
                    aria-current={actif ? "page" : undefined}
                    className={[
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      actif
                        ? "bg-mocha-soft text-mocha-fg font-semibold"
                        : "text-mocha-fg-muted hover:bg-mocha-soft/60 hover:text-mocha-fg",
                    ].join(" ")}
                  >
                    {actif ? (
                      <span
                        aria-hidden="true"
                        className="bg-terracotta-on-mocha absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full"
                      />
                    ) : null}
                    <Icone
                      className={actif ? "text-terracotta-on-mocha size-5" : "size-5"}
                      strokeWidth={actif ? 2.2 : 1.8}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                    {item.enAttente ? <Pastille nombre={item.enAttente} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {utilisateur || actionSortie ? (
          <div className="border-border-on-mocha border-t px-4 py-4">
            {utilisateur ? (
              <div className="mb-3 flex items-center gap-3">
                {/* Texte mocha sur accent clair : 5,82:1. L'inverse — accent
                    clair sur mocha — ne passerait pas en petit texte gras. */}
                <span
                  aria-hidden="true"
                  className="bg-terracotta-on-mocha text-mocha flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold"
                >
                  {initiales(utilisateur.nom)}
                </span>
                <span className="min-w-0">
                  <span className="text-mocha-fg block truncate text-sm font-medium">
                    {utilisateur.nom}
                  </span>
                  {utilisateur.detail ? (
                    <span className="text-mocha-fg-muted block truncate text-xs">
                      {utilisateur.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            {actionSortie}
          </div>
        ) : null}
      </aside>

      {/* ── Zone de contenu ─────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {/* En-tête mobile : l'espace se nomme, l'utilisateur se reconnaît. */}
        <header className="bg-mocha flex items-center justify-between px-4 py-3 lg:hidden">
          <p className="text-mocha-fg font-serif text-base font-semibold">{titreEspace}</p>
          {utilisateur ? (
            <span
              aria-hidden="true"
              className="bg-terracotta-on-mocha text-mocha flex size-8 items-center justify-center rounded-full font-serif text-xs font-semibold"
            >
              {initiales(utilisateur.nom)}
            </span>
          ) : null}
        </header>

        {/*
          `pb-24` sur mobile : réserve la hauteur de la barre du bas pour que le
          dernier élément de la page ne finisse jamais dessous. Sans elle, le
          bouton le plus important d'une page longue serait inatteignable.
        */}
        <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>

      {/* ── Barre d'onglets (mobile) ────────────────────────────────────── */}
      {/*
        `pb-[env(safe-area-inset-bottom)]` : sur iPhone, la barre d'accueil
        recouvre le bas de l'écran. Sans cette réserve, la dernière rangée
        d'icônes passe dessous et devient difficile à toucher — précisément sur
        les appareils depuis lesquels ce portail est le plus consulté.
      */}
      <nav
        className="bg-mocha fixed inset-x-0 bottom-0 z-40 flex pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={`Navigation — ${titreEspace}`}
      >
        {navigation.map((item) => {
          const actif = item.cle === sectionActive;
          const Icone = item.icone;
          return (
            <Link
              key={item.cle}
              href={item.href}
              aria-current={actif ? "page" : undefined}
              className={[
                "relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-center text-xs",
                actif ? "text-terracotta-on-mocha font-semibold" : "text-mocha-fg-muted",
              ].join(" ")}
            >
              {/* Filet supérieur : le repère d'onglet actif des applications
                  natives. Redondant avec la couleur, donc lisible sans elle. */}
              {actif ? (
                <span
                  aria-hidden="true"
                  className="bg-terracotta-on-mocha absolute inset-x-4 top-0 h-0.5 rounded-b-full"
                />
              ) : null}
              <span className="relative">
                <Icone className="size-5" strokeWidth={actif ? 2.2 : 1.8} aria-hidden="true" />
                {item.enAttente ? (
                  <span
                    className="bg-terracotta text-mocha-fg absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                    aria-label={`${item.enAttente} en attente`}
                  >
                    {item.enAttente}
                  </span>
                ) : null}
              </span>
              <span className="leading-none">{item.labelCourt ?? item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
