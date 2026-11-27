/**
 * Admin — questionnaire du Baromètre 2027 : état de la collecte.
 *
 * Nombre de réponses, état (ouvert / fermé), dates, lien vers l'export CSV (administrateur
 * seul). AUCUN texte libre et aucune réponse n'est affiché ici : seul l'export les porte.
 * Server Component, force-dynamic, noindex.
 */
import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { estSuperAdmin } from "@/server/auth/habilitations";
import { prisma } from "@/lib/prisma";
import {
  CAMPAGNE,
  CONSERVATION_MOIS,
  DATE_DEBUT_COLLECTE,
  DATE_FIN_COLLECTE,
  estOuvert,
  limiteEffacement,
} from "@/lib/barometre-questionnaire/constantes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Questionnaire Baromètre 2027 | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function BarometreQuestionnaireAdminPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  let nombre: number | null = null;
  try {
    nombre = await prisma.barometreQuestionnaireReponse.count({ where: { campagne: CAMPAGNE } });
  } catch {
    nombre = null; // table absente (migration en attente) : dit plus bas.
  }
  const ouvert = estOuvert(new Date());
  const jourLimite = limiteEffacement().toISOString().slice(0, 10);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Questionnaire du Baromètre 2027"
        description="Collecte non nominative : l'état, les dates et le nombre de réponses. Les réponses elles-mêmes et les textes libres ne s'affichent pas ici."
      />
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium">État</dt>
          <dd>{ouvert ? "Ouvert" : "Fermé"}</dd>
        </div>
        <div>
          <dt className="font-medium">Fenêtre de collecte</dt>
          <dd>
            du {DATE_DEBUT_COLLECTE} au {DATE_FIN_COLLECTE} (inclus)
          </dd>
        </div>
        <div>
          <dt className="font-medium">Réponses enregistrées</dt>
          <dd>{nombre === null ? "indisponible (migration en attente ?)" : nombre}</dd>
        </div>
        <div>
          <dt className="font-medium">Effacement automatique</dt>
          <dd>
            {CONSERVATION_MOIS} mois après la fin de l&apos;enquête, soit à partir du {jourLimite}
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-sm">
        {estSuperAdmin(acces.role) ? (
          // Téléchargement d'un fichier : une balise <a> est voulue (pas de navigation de page).
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a className="underline" href="/api/admin/barometre-questionnaire/export">
            Télécharger l&apos;export CSV
          </a>
        ) : (
          "L'export CSV est réservé à l'administrateur."
        )}
      </p>
    </AdminPageShell>
  );
}
