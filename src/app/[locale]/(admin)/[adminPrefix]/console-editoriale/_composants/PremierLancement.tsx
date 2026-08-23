/**
 * Console éditoriale — le parcours de premier lancement (§3, critère 11).
 *
 * > « À l'ouverture d'une base vierge, la console propose un parcours en trois
 * >   étapes, PAS UN ÉCRAN VIDE. Chaque étape est sautable, et le parcours
 * >   réapparaît tant qu'aucun compte n'existe. »
 *
 * Deux choses à ne pas confondre, et le plan les distingue :
 *
 * - **la persistance du parcours** est conditionnée aux COMPTES (« tant
 *   qu'aucun compte n'existe ») ;
 * - **son utilité** dure tant qu'il reste une étape à faire.
 *
 * D'où l'affichage : le parcours reste visible tant qu'une étape n'est pas
 * franchie, et chaque étape dit ce qu'elle attend et comment la passer. Une
 * étape franchie se coche au lieu de disparaître : voir ce qu'on a déjà fait
 * vaut mieux que voir un écran qui rétrécit sans explication.
 *
 * Server Component pur — aucun état, donc aucun JavaScript.
 */

import { AdminCard, AdminBadge } from "@/components/admin/ui";

export interface EtatPremierLancement {
  comptes: number;
  publications: number;
  idees: number;
  importFait: boolean;
}

interface Props {
  base: string;
  etat: EtatPremierLancement;
}

interface Etape {
  numero: number;
  titre: string;
  faite: boolean;
  explication: string;
  /** Le geste concret. Une commande, ou un lien. */
  geste: React.ReactNode;
}

/**
 * Le parcours doit-il s'afficher ?
 *
 * Exporté pour que la page décide sans dupliquer la règle — et pour qu'un test
 * puisse la vérifier sans monter un écran.
 */
export function doitAfficherParcours(etat: EtatPremierLancement): boolean {
  // Le §3 le rattache aux comptes ; on garde aussi le parcours visible tant
  // qu'aucun contenu n'existe, sinon une base amorcée mais vide n'offrirait
  // qu'un tableau de bord de zéros, sans dire quoi faire.
  return etat.comptes === 0 || (etat.publications === 0 && etat.idees === 0);
}

export function PremierLancement({ base, etat }: Props): React.ReactElement | null {
  if (!doitAfficherParcours(etat)) return null;

  const etapes: Etape[] = [
    {
      numero: 1,
      titre: "Amorcer les référentiels",
      faite: etat.comptes > 0,
      explication:
        "Les deux marques, les onze comptes, les familles d'assets, les douze règles de conformité et les onze règles d'alerte. Rien n'est écrasé : la commande est idempotente.",
      geste: <code className="admin-code-inline">pnpm editorial:seed</code>,
    },
    {
      numero: 2,
      titre: "Importer le dossier existant",
      faite: etat.importFait,
      explication:
        "Les 61 publications du trimestre et leurs 13 échos de page. L'import est transactionnel et ne se rejoue pas tout seul. Cette étape est SAUTABLE : on peut très bien commencer à vide.",
      geste: (
        <code className="admin-code-inline">pnpm editorial:import --source &lt;dossier&gt;</code>
      ),
    },
    {
      numero: 3,
      titre: "Créer une première publication — ou noter une idée",
      faite: etat.publications > 0 || etat.idees > 0,
      explication:
        "Cinq champs pour une publication, un seul pour une idée. C'est le geste qui décide si l'outil sera rouvert demain.",
      geste: (
        <span className="flex flex-wrap gap-2">
          <a href={`${base}/publications/nouvelle`} className="admin-button admin-button-sm">
            Créer une publication
          </a>
          <a href={`${base}/idees`} className="admin-button-secondary admin-button-sm">
            Noter une idée
          </a>
        </span>
      ),
    },
  ];

  const restantes = etapes.filter((e) => !e.faite).length;

  return (
    <AdminCard>
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
        <h2 className="admin-h2">Pour commencer</h2>
        <AdminBadge tone={restantes === 0 ? "success" : "info"}>
          {restantes === 0 ? "tout est fait" : `${restantes} étape${restantes > 1 ? "s" : ""}`}
        </AdminBadge>
      </div>

      <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
        La console est prête, mais elle n&apos;a rien à montrer tant qu&apos;on ne lui a rien donné.
        Trois étapes, toutes sautables.
      </p>

      <ol className="space-y-3">
        {etapes.map((etape) => (
          <li
            key={etape.numero}
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className={
                  etape.faite
                    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-admin-success)] text-[length:var(--text-admin-xs)] font-bold text-white"
                    : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-admin-border)] text-[length:var(--text-admin-xs)] font-bold"
                }
              >
                {etape.numero}
              </span>
              <strong className={etape.faite ? "text-[color:var(--color-admin-fg-muted)]" : ""}>
                {etape.titre}
              </strong>
              {/* Le nom accessible ne doit pas dépendre d'une pastille colorée. */}
              <span className="sr-only">{etape.faite ? "— étape franchie" : "— à faire"}</span>
            </div>

            <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              {etape.explication}
            </p>

            {!etape.faite && <div className="mt-2">{etape.geste}</div>}
          </li>
        ))}
      </ol>
    </AdminCard>
  );
}
