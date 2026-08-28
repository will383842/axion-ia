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
// FR uniquement (admin FR).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { CATALOGUE, LIBELLE_CATEGORIE } from "@/server/email/apercu/catalogue";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { renderEmailTemplate } from "@/lib/email/templates";
import type { EmailJobName } from "@/server/queue/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu d'un gabarit",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string; nom: string }>;
}

function estGabarit(nom: string): nom is EmailJobName {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, nom);
}

export default async function ApercuGabaritPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, nom } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (!estGabarit(nom)) notFound();
  const fiche = CATALOGUE[nom];

  // Le rendu peut échouer — un gabarit dont un champ requis manquerait lèverait.
  // On le montre au lieu de rendre une page blanche : un aperçu cassé est une
  // information, une page vide n'en est pas une.
  let rendu: { subject: string; html: string } | null = null;
  let erreur: string | null = null;
  try {
    const r = await renderEmailTemplate(nom, "fr", { ...PAYLOAD_EXEMPLE });
    rendu = { subject: r.subject, html: r.html };
  } catch (e) {
    erreur = e instanceof Error ? e.message : String(e);
  }

  const dormant = fiche.source === null;

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
