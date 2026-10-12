// Un gabarit d'e-mail — son rendu réel, et ce qui le déclenche.
//
// ## Le rendu passe par la MÊME fonction que l'envoi
//
// `renderEmailTemplate` est celle qu'appelle le worker d'envoi. La page affiche
// donc exactement ce que reçoit le destinataire, mise en page comprise. Un
// aperçu qui recomposerait le HTML de son côté finirait par diverger — et
// rassurerait sur un e-mail devenu faux.
//
// ## 🔴 POURQUOI UNE IFRAME `srcDoc` ET PAS UN `dangerouslySetInnerHTML`
//
// Le HTML d'un e-mail porte ses propres styles, en ligne et en `<style>`. Injecté
// dans la page, il déborde sur la console : polices, couleurs, largeurs. L'iframe
// l'isole — c'est aussi ainsi que le voit une boîte mail.
//
// `sandbox` sans `allow-scripts` ni `allow-same-origin` : le document ne peut ni
// exécuter de script, ni lire la page qui le contient. Le contenu vient de nos
// gabarits, mais un aperçu n'a aucune raison de pouvoir agir.
//
// ## Validation du texte (M1, lot A)
//
// Pour un texte d'e-mail aux formateurs indépendants (gabarit ou variante validée à
// part), la page dit s'il est validé, et le super-admin le valide — ou retire la
// validation — d'ici, sous l'aperçu qu'il vient de lire. Les autres rôles voient
// l'état, sans bouton ; le serveur refuse de toute façon.
//
// FR uniquement (admin FR).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { CATALOGUE, LIBELLE_CATEGORIE } from "@/server/email/apercu/catalogue";
import { PAYLOAD_EXEMPLE, VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { renderEmailTemplate } from "@/lib/email/templates";
import { estSuperAdmin } from "@/server/auth/habilitations";
import { estTexteFormateurAValider } from "@/server/email/textes-formateurs-a-valider";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import type { EmailJobName } from "@/server/queue/types";

import { BoutonValidationTexte } from "./BoutonValidationTexte";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu d'un gabarit",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string; nom: string }>;
  searchParams: Promise<{ variante?: string }>;
}

function estGabarit(nom: string): nom is EmailJobName {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, nom);
}

export default async function ApercuGabaritPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, nom } = await params;
  const { variante: varianteDemandee } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (!estGabarit(nom)) notFound();
  const fiche = CATALOGUE[nom];
  // Une variante validée à part (gabarit partagé) a son propre aperçu.
  const variantes = VARIANTES_EXEMPLE[nom] ?? {};
  const variante =
    varianteDemandee !== undefined &&
    Object.prototype.hasOwnProperty.call(variantes, varianteDemandee)
      ? varianteDemandee
      : null;

  // Le rendu peut échouer — un gabarit dont un champ requis manquerait lèverait.
  // On le montre au lieu de rendre une page blanche : un aperçu cassé est une
  // information, une page vide n'en est pas une.
  let rendu: { subject: string; html: string } | null = null;
  let erreur: string | null = null;
  try {
    const r = await renderEmailTemplate(nom, "fr", {
      ...PAYLOAD_EXEMPLE,
      ...(variante !== null ? variantes[variante] : {}),
    });
    rendu = { subject: r.subject, html: r.html };
  } catch (e) {
    erreur = e instanceof Error ? e.message : String(e);
  }

  const dormant = fiche.source === null;

  const aValider = estTexteFormateurAValider(nom, variante ?? undefined);
  const valide = aValider
    ? estTexteValide(await lireTextesValides(), nom, variante ?? undefined)
    : false;
  const peutValider = estSuperAdmin((session.user as { role?: string }).role);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={nom}
        description={fiche.quand}
        meta={
          <>
            <AdminBadge tone="neutral">{LIBELLE_CATEGORIE[fiche.categorie]}</AdminBadge>
            {dormant ? (
              <AdminBadge tone="warning" dot>
                dormant — rien ne l&apos;envoie
              </AdminBadge>
            ) : (
              <AdminBadge tone="success" dot>
                actif
              </AdminBadge>
            )}
          </>
        }
        actions={
          <Link
            href={`/fr/${adminPrefix}/emails/gabarits`}
            className="text-primary text-sm hover:underline"
          >
            ← Tous les gabarits
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AdminCard>
          {erreur ? (
            <div className="text-sm">
              <p className="text-destructive font-medium">Ce gabarit ne rend pas.</p>
              <p className="text-fg-soft mt-2">
                Le jeu de données d&apos;exemple ne suffit pas, ou le composant lève. C&apos;est un
                défaut réel, pas un défaut d&apos;aperçu.
              </p>
              <pre className="bg-sand text-fg-soft mt-3 overflow-x-auto rounded p-3 text-xs">
                {erreur}
              </pre>
            </div>
          ) : (
            <>
              {/* La ligne d'objet, telle qu'elle s'affiche dans une boîte. */}
              <div className="border-border bg-sand/30 mb-4 rounded-lg border px-4 py-3">
                <p className="text-fg-muted text-[11px] font-medium tracking-wide uppercase">
                  Objet
                </p>
                <p className="text-fg mt-1 text-sm leading-snug font-semibold">{rendu?.subject}</p>
              </div>

              {/*
                Cadré à 680 px sur un fond neutre : c'est la largeur à laquelle
                une boîte mail rend un e-mail. L'afficher pleine page donnerait
                une idée fausse de ce que reçoit le destinataire.
              */}
              <div className="border-border bg-sand/40 rounded-lg border p-3 sm:p-6">
                <iframe
                  title={`Aperçu de ${nom}`}
                  srcDoc={rendu?.html ?? ""}
                  sandbox=""
                  className="border-border bg-paper mx-auto h-[68vh] w-full max-w-[680px] rounded-lg border shadow-sm"
                />
              </div>
            </>
          )}
        </AdminCard>

        <div className="space-y-4">
          <AdminCard>
            <h2 className="text-fg mb-3 text-sm font-semibold">Quand il part</h2>
            <p className="text-fg-soft text-sm">{fiche.quand}</p>
            <h2 className="text-fg mt-5 mb-2 text-sm font-semibold">Qui le reçoit</h2>
            <p className="text-fg-soft text-sm">{fiche.destinataire}</p>
            {Object.keys(variantes).length > 0 ? (
              <>
                <h2 className="text-fg mt-5 mb-2 text-sm font-semibold">Variantes</h2>
                <ul className="text-sm">
                  <li>
                    <Link
                      href={`/fr/${adminPrefix}/emails/gabarits/${nom}`}
                      className="text-primary hover:underline"
                      aria-current={variante === null ? "page" : undefined}
                    >
                      Texte de base
                    </Link>
                  </li>
                  {Object.keys(variantes).map((v) => (
                    <li key={v}>
                      <Link
                        href={`/fr/${adminPrefix}/emails/gabarits/${nom}?variante=${v}`}
                        className="text-primary hover:underline"
                        aria-current={variante === v ? "page" : undefined}
                      >
                        Variante « {v} »
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <h2 className="text-fg mt-5 mb-2 text-sm font-semibold">D&apos;où il part</h2>
            {fiche.source ? (
              <code className="text-fg-soft block text-xs break-all">src/{fiche.source}</code>
            ) : (
              <p className="text-fg-soft text-sm">
                Aucun code ne l&apos;envoie. Le gabarit existe et se maintient, mais il ne part
                jamais.
              </p>
            )}
          </AdminCard>

          {aValider ? (
            <AdminCard>
              <h2 className="text-fg mb-2 text-sm font-semibold">
                Validation du texte{variante !== null ? ` (variante « ${variante} »)` : ""}
              </h2>
              <p className="mb-3">
                {valide ? (
                  <AdminBadge tone="success" dot>
                    validé
                  </AdminBadge>
                ) : (
                  <AdminBadge tone="warning" dot>
                    non validé — rien ne part
                  </AdminBadge>
                )}
              </p>
              <p className="text-fg-soft mb-3 text-sm">
                {variante !== null
                  ? "Cette variante se valide à part : elle ne part que si le texte de base ET elle sont validés."
                  : "Le texte ne part que s'il est validé ici ET que l'interrupteur « textes validés » des formateurs est allumé."}
              </p>
              {peutValider ? (
                <BoutonValidationTexte gabarit={nom} variante={variante} valide={valide} />
              ) : (
                <p className="text-fg-soft text-sm">
                  Seule la direction (super-admin) valide les textes.
                </p>
              )}
            </AdminCard>
          ) : null}

          <AdminCard>
            <h2 className="text-fg mb-2 text-sm font-semibold">Données affichées</h2>
            <p className="text-fg-soft text-sm">
              L&apos;aperçu utilise un jeu de données <strong>fictif</strong> — noms inventés,
              adresses en <code>.invalid</code>, liens vers <code>exemple.invalid</code>. Aucune
              donnée réelle, aucun lien vers la production.
            </p>
          </AdminCard>
        </div>
      </div>
    </AdminPageShell>
  );
}
