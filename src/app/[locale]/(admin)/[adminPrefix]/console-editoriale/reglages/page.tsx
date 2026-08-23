// Console éditoriale — les réglages (§8).
//
// 🔴 Cet écran répare une promesse que trois de mes commentaires faisaient
// sans qu'elle soit tenue : « un seuil se corrige depuis la console, sans
// pull request ». Les règles vivaient bien en base — mais il fallait un accès
// à Postgres pour les toucher. La passe 5 du protocole l'a relevé.
//
// Ce n'était pas un manque de confort. La promesse du §8 est ce qui JUSTIFIE
// que les seuils vivent en base plutôt que dans le code : sans l'écran, on
// payait le coût de l'indirection sans en toucher le bénéfice.
//
// ⚠️ Aucun cache à invalider après un enregistrement : `evaluerRegle` lit les
// règles en base à CHAQUE appel, jamais en mémoire. C'est ce qui fait qu'un
// seuil corrigé mord au coup suivant, et non au prochain déploiement.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { requireMembreEditorial } from "@/server/actions/editorial/_guards";
import { peut } from "@/server/editorial/permissions";
import {
  modifierRegleConformiteFormAction,
  modifierRegleAlerteFormAction,
} from "@/server/actions/editorial/reglages";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const GRAVITES = ["info", "avertissement", "bloquant"] as const;

/** Le JSON des paramètres, lisible dans un `<textarea>`. */
function formaterParametres(v: unknown): string {
  if (v === null || v === undefined) return "";
  return JSON.stringify(v, null, 2);
}

export default async function ReglagesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const retour = `${base}/reglages`;

  const moi = await requireMembreEditorial();
  const jePeuxRegler = peut(moi.role, "reglages.gerer");

  const [conformite, alertes] = await Promise.all([
    prisma.edRegleConformite.findMany({ orderBy: { code: "asc" } }),
    prisma.edRegleAlerte.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Réglages"
        description="Les règles vivent en base. Ce qui change ici mord au geste suivant, pas au prochain déploiement."
        meta={<AdminBadge tone="info">votre rôle : {moi.role}</AdminBadge>}
        actions={
          <AdminButton href={base} variant="secondary" size="sm">
            Retour au tableau de bord
          </AdminButton>
        }
      />

      {sp.erreur && (
        <p role="alert" className="admin-alert admin-alert-error">
          {sp.erreur}
        </p>
      )}
      {sp.regle && (
        <p role="status" className="admin-alert admin-alert-success">
          Règle de conformité enregistrée. Elle s&apos;applique dès la prochaine validation.
        </p>
      )}
      {sp.alerte && (
        <p role="status" className="admin-alert admin-alert-success">
          Règle d&apos;alerte enregistrée. Le tableau de bord en tient compte au prochain affichage.
        </p>
      )}

      {!jePeuxRegler && (
        <p role="status" className="admin-alert admin-alert-info">
          {/* Le §4 réserve `reglages.gerer` à l'admin. On MONTRE quand même les
              règles : savoir ce qui bloque une validation aide, même sans le
              droit de le changer. Ce sont les formulaires qui disparaissent,
              pas l'information. */}
          Lecture seule : modifier les règles demande le rôle <strong>admin</strong>. Les valeurs
          ci-dessous sont celles qui s&apos;appliquent réellement.
        </p>
      )}

      {/* ── Les règles de conformité ────────────────────────────────────── */}
      <AdminCard>
        <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
          <h2 className="admin-h2">Règles de conformité</h2>
          <AdminBadge tone="neutral">
            {conformite.filter((r) => r.actif).length} active(s) sur {conformite.length}
          </AdminBadge>
        </div>

        {conformite.length === 0 ? (
          <AdminEmptyState
            title="Aucune règle en base"
            description="Lancez `pnpm editorial:seed` : les douze règles du §8 y sont semées, et rien ne bloquera une validation tant qu'elles manquent."
          />
        ) : (
          <ul className="space-y-3">
            {conformite.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="admin-code-inline">{r.code}</code>
                  <strong className="min-w-0">{r.libelle}</strong>
                  <AdminBadge tone={r.gravite === "bloquant" ? "destructive" : "warning"}>
                    {r.gravite}
                  </AdminBadge>
                  {!r.actif && <AdminBadge tone="neutral">désactivée</AdminBadge>}
                  <AdminBadge tone="neutral">
                    {r.interdit ? "déclenche si TROUVÉ" : "déclenche si ABSENT"}
                  </AdminBadge>
                </div>
                <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  {r.motif}
                </p>

                {jePeuxRegler ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium">
                      Modifier
                    </summary>
                    <form action={modifierRegleConformiteFormAction} className="admin-form mt-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="retour" value={retour} />

                      <div className="admin-form-row">
                        <div className="admin-form-field">
                          <label htmlFor={`gravite-${r.id}`} className="admin-label">
                            Gravité
                          </label>
                          <select
                            id={`gravite-${r.id}`}
                            name="gravite"
                            defaultValue={r.gravite}
                            className="admin-select"
                          >
                            {GRAVITES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                          <p className="admin-help">
                            Seul <code className="admin-code-inline">bloquant</code> empêche une
                            validation. Les deux autres s&apos;affichent sans arrêter le geste.
                          </p>
                        </div>

                        <div className="admin-form-field">
                          <label htmlFor={`actif-${r.id}`} className="admin-checkbox-label">
                            <input
                              id={`actif-${r.id}`}
                              name="actif"
                              type="checkbox"
                              defaultChecked={r.actif}
                              className="admin-checkbox"
                            />
                            Règle active
                          </label>
                          <p className="admin-help">
                            Désactivée, elle est rendue « conforme » sans rien inspecter. Désactiver
                            n&apos;est pas corriger.
                          </p>
                        </div>
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor={`message-${r.id}`} className="admin-label">
                          Message rendu à l&apos;utilisateur
                        </label>
                        <textarea
                          id={`message-${r.id}`}
                          name="message"
                          rows={2}
                          defaultValue={r.message}
                          className="admin-textarea"
                        />
                        <p className="admin-help">
                          Les accolades sont remplacées :{" "}
                          <code className="admin-code-inline">{"{extrait}"}</code> porte le texte
                          fautif, <code className="admin-code-inline">{"{max}"}</code> et{" "}
                          <code className="admin-code-inline">{"{trouve}"}</code> les compteurs.
                        </p>
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor={`motif-${r.id}`} className="admin-label">
                          Expression régulière
                        </label>
                        <textarea
                          id={`motif-${r.id}`}
                          name="motifRegex"
                          rows={2}
                          defaultValue={r.motifRegex}
                          className="admin-textarea admin-mono"
                        />
                        <p className="admin-help">
                          {/* La garde est côté action, pas seulement ici : on prévient
                              avant de refuser, mais c'est le serveur qui refuse. */}
                          Un quantificateur dans un groupe lui-même quantifié —{" "}
                          <code className="admin-code-inline">(a+)+</code> — est refusé à
                          l&apos;enregistrement : sur 40 caractères, il gèle l&apos;évaluation plus
                          de deux minutes.
                        </p>
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor={`params-${r.id}`} className="admin-label">
                          Paramètres (JSON)
                        </label>
                        <textarea
                          id={`params-${r.id}`}
                          name="parametres"
                          rows={4}
                          defaultValue={formaterParametres(r.parametres)}
                          className="admin-textarea admin-mono"
                        />
                        <p className="admin-help">
                          C&apos;est ici que vivent les seuils :{" "}
                          <code className="admin-code-inline">{'{"min":3,"max":4}'}</code>,{" "}
                          <code className="admin-code-inline">{'{"valeurs":[…]}'}</code>. Un champ
                          inconnu dans <code className="admin-code-inline">champs</code> rend la
                          règle « non évaluée » — jamais « conforme ».
                        </p>
                      </div>

                      <div className="admin-form-actions">
                        <AdminButton type="submit" variant="primary" size="sm">
                          Enregistrer
                        </AdminButton>
                      </div>
                    </form>
                  </details>
                ) : (
                  <dl className="admin-dl mt-2">
                    <dt className="admin-dt">Paramètres</dt>
                    <dd className="admin-dd">
                      <code className="admin-code-inline">
                        {formaterParametres(r.parametres) || "aucun"}
                      </code>
                    </dd>
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {/* ── Les règles d'alerte ─────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Règles d&apos;alerte</h2>
            <AdminBadge tone="neutral">
              {alertes.filter((r) => r.actif).length} active(s) sur {alertes.length}
            </AdminBadge>
          </div>

          {alertes.length === 0 ? (
            <AdminEmptyState
              title="Aucune règle d'alerte"
              description="Le tableau de bord ne signalera rien tant qu'elles manquent. `pnpm editorial:seed` les sème."
            />
          ) : (
            <ul className="space-y-3">
              {alertes.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="admin-code-inline">{r.code}</code>
                    <strong className="min-w-0">{r.libelle}</strong>
                    <AdminBadge tone={r.gravite === "bloquant" ? "destructive" : "warning"}>
                      {r.gravite}
                    </AdminBadge>
                    {!r.actif && <AdminBadge tone="neutral">désactivée</AdminBadge>}
                  </div>
                  <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {r.description}
                  </p>

                  {jePeuxRegler ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium">
                        Modifier le seuil
                      </summary>
                      <form action={modifierRegleAlerteFormAction} className="admin-form mt-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="retour" value={retour} />

                        <div className="admin-form-row">
                          <div className="admin-form-field">
                            <label htmlFor={`agravite-${r.id}`} className="admin-label">
                              Gravité
                            </label>
                            <select
                              id={`agravite-${r.id}`}
                              name="gravite"
                              defaultValue={r.gravite}
                              className="admin-select"
                            >
                              {GRAVITES.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="admin-form-field">
                            <label htmlFor={`aactif-${r.id}`} className="admin-checkbox-label">
                              <input
                                id={`aactif-${r.id}`}
                                name="actif"
                                type="checkbox"
                                defaultChecked={r.actif}
                                className="admin-checkbox"
                              />
                              Alerte active
                            </label>
                          </div>
                        </div>

                        <div className="admin-form-field">
                          <label htmlFor={`aparams-${r.id}`} className="admin-label">
                            Seuil (JSON)
                          </label>
                          <textarea
                            id={`aparams-${r.id}`}
                            name="parametres"
                            rows={3}
                            defaultValue={formaterParametres(r.parametres)}
                            className="admin-textarea admin-mono"
                          />
                          <p className="admin-help">
                            {/* Non nullable en base : une alerte sans seuil ne se
                                déclenche jamais, et son silence ressemble à « tout
                                va bien ». */}
                            Obligatoire : <code className="admin-code-inline">{'{"jours":3}'}</code>
                            , <code className="admin-code-inline">{'{"minParMois":4}'}</code>. Vide,
                            l&apos;alerte ne se déclenche jamais — et son silence ressemble à « tout
                            va bien ».
                          </p>
                        </div>

                        <div className="admin-form-actions">
                          <AdminButton type="submit" variant="primary" size="sm">
                            Enregistrer
                          </AdminButton>
                        </div>
                      </form>
                    </details>
                  ) : (
                    <dl className="admin-dl mt-2">
                      <dt className="admin-dt">Seuil</dt>
                      <dd className="admin-dd">
                        <code className="admin-code-inline">
                          {formaterParametres(r.parametres)}
                        </code>
                      </dd>
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {/* Le code d'une règle n'est PAS modifiable : c'est la clé stable sur
            laquelle l'évaluateur branche ses contrôles structurels. La renommer
            ferait basculer la règle en évaluation par motif, en silence. */}
        Le <code className="admin-code-inline">code</code> d&apos;une règle n&apos;est pas
        modifiable : c&apos;est la clé sur laquelle l&apos;évaluateur branche ses contrôles
        structurels. La renommer ferait basculer la règle en simple motif, sans que rien ne le dise.
        Pour ajouter une règle, passez par{" "}
        <code className="admin-code-inline">src/server/editorial/referentiels/conformite.ts</code>{" "}
        et un amorçage.
      </p>

      <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <Link href={base} className="hover:underline">
          ← Tableau de bord
        </Link>
      </p>
    </AdminPageShell>
  );
}
