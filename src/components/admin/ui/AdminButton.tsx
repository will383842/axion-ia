// Bouton de la console — refonte UI 2026-08-01 (couche 2).
//
// POURQUOI CE COMPOSANT EXISTE
// La console comptait 577 `<button>` écrits à la main et AUCUN composant de
// bouton. Chaque page rappelait donc de mémoire la bonne classe : d'où des
// boutons `.admin-button-secondary` et `.admin-button-danger` qui n'étaient
// définis nulle part, des `text-red-600` hors charte, et des utilitaires
// Tailwind silencieusement inertes posés à côté de la classe.
//
// Ce composant N'INVENTE PAS un second système : il compose les mêmes classes
// `.admin-*` que les 566 usages existants, définies dans `src/app/admin.css`.
// Les deux écritures rendent donc exactement pareil à l'écran, et la migration
// des pages peut se faire progressivement, sans rupture visuelle.
//
// ⚠️ NE PAS passer d'utilitaires Tailwind de largeur, de marge interne, de
// typographie, de rayon ou de fond via `className` : les classes `.admin-*`
// sont hors couche CSS et l'emportent sur `utilities`, ces utilitaires
// seraient donc sans effet. Utiliser `size`, `block` et les variantes. Un test
// (`admin-design-tokens.test.ts`) fait échouer la suite si le motif réapparaît.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ghost-danger";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: "admin-button",
  secondary: "admin-button-secondary",
  ghost: "admin-button-ghost",
  danger: "admin-button-danger",
  "ghost-danger": "admin-button-ghost admin-button-ghost-danger",
};

interface AdminButtonOwnProps {
  children: React.ReactNode;
  variant?: AdminButtonVariant;
  /** `sm` réduit la hauteur au gabarit compact (listes, actions de ligne). */
  size?: "sm" | "md";
  /** Occupe toute la largeur disponible (formulaires verticaux étroits). */
  block?: boolean;
  /** Icône affichée avant le libellé. */
  icon?: LucideIcon;
  /** Icône affichée après le libellé (chevron, flèche sortante…). */
  iconAfter?: LucideIcon;
  className?: string;
}

type AdminButtonAsButton = AdminButtonOwnProps & {
  href?: undefined;
  /**
   * Action en cours : désactive le bouton, annonce `aria-busy` et affiche un
   * indicateur à la place de l'icône. Le libellé RESTE affiché — le remplacer
   * ferait sauter la largeur du bouton et priverait le lecteur d'écran du
   * contexte de l'action.
   */
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  form?: string;
  name?: string;
  value?: string;
  title?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

type AdminButtonAsLink = AdminButtonOwnProps & {
  /** Rend un lien Next stylé comme un bouton. */
  href: string;
  loading?: undefined;
  title?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

export type AdminButtonProps = AdminButtonAsButton | AdminButtonAsLink;

/** Indicateur d'action en cours — cercle partiel qui tourne. */
function Spinner(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-[14px] w-[14px] shrink-0 rounded-full border-2 border-current border-t-transparent",
        // `motion-safe` : respecte « réduire les animations » (WCAG 2.3.3).
        "motion-safe:animate-spin",
      )}
    />
  );
}

export function AdminButton({
  children,
  variant = "primary",
  size = "md",
  block = false,
  icon: Icon,
  iconAfter: IconAfter,
  className,
  ...rest
}: AdminButtonProps): React.ReactElement {
  const classes = cn(
    VARIANT_CLASS[variant],
    size === "sm" && "admin-button-sm",
    block && "admin-button-block",
    className,
  );

  const leadingIcon = Icon ? <Icon size={16} aria-hidden="true" className="shrink-0" /> : null;
  const trailingIcon = IconAfter ? (
    <IconAfter size={16} aria-hidden="true" className="shrink-0" />
  ) : null;

  if (rest.href !== undefined) {
    const { href, loading: _loading, ...linkProps } = rest as AdminButtonAsLink;
    void _loading;
    return (
      <Link {...linkProps} href={href} className={classes}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </Link>
    );
  }

  const {
    loading = false,
    disabled = false,
    type = "button",
    href: _href,
    ...buttonProps
  } = rest as AdminButtonAsButton;
  void _href;

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {loading ? null : trailingIcon}
    </button>
  );
}
