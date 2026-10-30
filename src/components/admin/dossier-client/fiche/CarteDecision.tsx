// Carte « Qui décide » (lot B5). Composant serveur PUR : reçoit ses données, ne lit rien.
// Un rôle n'est ni bon ni mauvais : teinte grise, l'icône et le mot portent le sens.

import {
  Gavel,
  GraduationCap,
  Handshake,
  Hand,
  MessageCircle,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { LIBELLE_ROLE_PROJET } from "@/features/dossier-client/libelles";
import { formatDateFrShort } from "@/lib/format-date-fr";

export type RoleDeLaCarte = keyof typeof LIBELLE_ROLE_PROJET;

export interface PersonneDeLaCarte {
  readonly id: string;
  readonly nom: string;
  readonly fonction: string | null;
  readonly statut: "actif" | "parti";
  readonly partiLe: Date | null;
  readonly roles: ReadonlyArray<RoleDeLaCarte>;
}

const ORDRE: ReadonlyArray<RoleDeLaCarte> = [
  "decideur",
  "financeur",
  "referent",
  "utilisateur",
  "prescripteur",
  "influenceur",
  "bloqueur",
  "autre",
];

const ICONE = {
  decideur: Gavel,
  financeur: Wallet,
  referent: MessageCircle,
  utilisateur: GraduationCap,
  prescripteur: Handshake,
  influenceur: Sparkles,
  bloqueur: Hand,
  autre: UserRound,
} as const satisfies Record<RoleDeLaCarte, unknown>;

const mutedCls = "text-[color:var(--color-admin-fg-muted)]";

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? (mots[mots.length - 1]?.[0] ?? "") : ""))
    .toUpperCase()
    .slice(0, 2);
}

/** « 6 personnes, dont 5 actives » */
export function phraseDesPersonnes(total: number, actives: number): string {
  if (total === 0) return "Aucune personne sur cette fiche";
  const s = (n: number): string => (n > 1 ? "s" : "");
  return `${total} personne${s(total)}, dont ${actives} active${s(actives)}`;
}

export function CarteDecision(props: {
  personnes: ReadonlyArray<PersonneDeLaCarte>;
  /** Nom de l'OPCO de la fiche, ou `null` s'il n'est pas renseigné. Ce n'est PAS une personne. */
  opco: string | null;
}): React.ReactElement {
  const { personnes, opco } = props;
  const actives = personnes.filter((p) => p.statut === "actif").length;
  return (
    <AdminBloc teinte="gris" titre="Qui décide" className="mb-[var(--space-admin-4)]">
      <p className="text-[length:var(--text-admin-sm)]">
        {phraseDesPersonnes(personnes.length, actives)}
      </p>
      <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        {ORDRE.map((role) => {
          const gens = personnes.filter((p) => p.roles.includes(role));
          if (gens.length === 0) return null;
          const Icone = ICONE[role];
          return (
            <li key={role} className="flex flex-wrap items-start gap-[var(--space-admin-3)]">
              <span className="flex min-h-[44px] min-w-[13rem] items-center gap-[var(--space-admin-2)] font-medium">
                <Icone aria-hidden className="h-4 w-4 shrink-0" />
                {LIBELLE_ROLE_PROJET[role]}
              </span>
              <ul className="flex flex-wrap gap-[var(--space-admin-3)]">
                {gens.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-[var(--space-admin-2)] ${
                      p.statut === "parti" ? mutedCls : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-admin-border)] text-[length:var(--text-admin-xs)] font-medium"
                    >
                      {initiales(p.nom)}
                    </span>
                    <span>
                      <span className="font-medium">{p.nom}</span>
                      {p.fonction ? <span className={mutedCls}>{`, ${p.fonction}`}</span> : null}
                      {p.statut === "parti" ? (
                        <span className={mutedCls}>
                          {p.partiLe
                            ? ` · a quitté l'entreprise le ${formatDateFrShort(p.partiLe)}`
                            : " · a quitté l'entreprise"}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        {opco !== null ? (
          <li className="flex min-h-[44px] items-center gap-[var(--space-admin-2)]">
            <Wallet aria-hidden className="h-4 w-4 shrink-0" />
            <span className="font-medium">{`Financement : ${opco}`}</span>
          </li>
        ) : null}
      </ul>
      {personnes.every((p) => p.roles.length === 0) && opco === null ? (
        <p className={`mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          Aucun rôle n&apos;est encore noté pour ces personnes.
        </p>
      ) : null}
    </AdminBloc>
  );
}
