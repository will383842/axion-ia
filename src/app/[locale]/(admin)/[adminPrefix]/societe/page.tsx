// Accueil de « Société & conformité ».
//
// Deux informations, dans cet ordre : ce qui périme, puis où en est chaque
// rubrique. La première est la seule qui doive être vue sans la chercher — un
// Kbis expiré au milieu d'une consultation d'achats coûte le référencement.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SocieteTabs } from "@/components/admin/societe-documents/SocieteTabs";
import {
  calculerEcheance,
  libelleEcheance,
  SEUIL_ALERTE_JOURS,
} from "@/server/societe-documents/echeance";
import { compterParRubrique, listSocieteDocsEnAlerte } from "@/server/societe-documents/queries";
import {
  getRubriqueForType,
  labelSocieteDocType,
  SOCIETE_RUBRIQUES,
} from "@/server/societe-documents/rubriques";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Société & conformité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ROLES_LECTURE = new Set(["super_admin", "admin", "editor"]);

export default async function SocietePage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !ROLES_LECTURE.has(role ?? "")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const maintenant = new Date();
  const [compteurs, alertes] = await Promise.all([
    compterParRubrique(),
    listSocieteDocsEnAlerte(maintenant, SEUIL_ALERTE_JOURS),
  ]);

  const parRubrique = new Map(compteurs.map((c) => [c.rubrique, c]));
  const base = `/fr/${adminPrefix}/societe`;

  // État global du dossier : ce qui compte avant d'envoyer, c'est le reste à
  // faire, pas le déjà-fait. Les deux sont affichés, le manque en premier.
  const attendusTotal = compteurs.reduce((n, c) => n + c.attendusTotal, 0);
  const couvertsTotal = compteurs.reduce((n, c) => n + c.attendusCouverts, 0);
  const manquantsTotal = attendusTotal - couvertsTotal;

  return (
    <>
      <SocieteTabs adminPrefix={adminPrefix} actif="" />

      <AdminPageHeader
        title="Société & conformité"
        description="Le dossier qu'un service achats de grand compte réclame pour référencer Axion-IA comme fournisseur, plus les pièces commerciales et de conformité qui partent chez le même destinataire."
      />

      <section className="border-border mb-6 rounded-lg border bg-[color:var(--color-admin-paper)] p-5">
        <p className="text-mocha text-sm font-semibold">
          {manquantsTotal === 0
            ? `Dossier complet — les ${attendusTotal} pièces attendues sont déposées.`
            : `${couvertsTotal} pièce${couvertsTotal > 1 ? "s" : ""} sur ${attendusTotal} — il en manque ${manquantsTotal}.`}
        </p>
        <p className="text-fg-muted mt-1 text-sm">
          Le détail de ce qui manque est en bas de chaque rubrique. Les emplacements
          «&nbsp;Autre…&nbsp;» ne sont pas comptés : un fourre-tout ne peut pas manquer.
        </p>
      </section>

      {alertes.length > 0 ? (
        <section className="mb-6 rounded-lg border border-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)] p-5">
          <h2 className="mb-2 text-sm font-semibold text-[color:var(--color-admin-warning-fg)]">
            {alertes.length === 1
              ? "Une pièce demande attention"
              : `${alertes.length} pièces demandent attention`}
          </h2>
          <ul className="space-y-1.5">
            {alertes.map((doc) => {
              const echeance = calculerEcheance(doc.dateExpiration, maintenant);
              const segment = getRubriqueForType(doc.type)?.segment;
              return (
                <li key={doc.id} className="text-sm">
                  <span className="text-mocha font-medium">{doc.titre}</span>
                  <span className="text-fg-muted"> · {labelSocieteDocType(doc.type)} · </span>
                  <span className="font-medium text-[color:var(--color-admin-warning-fg)]">
                    {libelleEcheance(echeance)}
                  </span>
                  {segment ? (
                    <>
                      {" — "}
                      <Link href={`${base}/${segment}`} className="text-terracotta underline">
                        remplacer
                      </Link>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="border-border text-fg-muted mb-6 rounded-lg border border-dashed p-4 text-sm">
          Aucune pièce ne périme dans les {SEUIL_ALERTE_JOURS} jours. Les pièces sans date de
          péremption ne sont jamais comptées ici.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`${base}/identite`}
          className="border-border hover:border-terracotta rounded-lg border bg-[color:var(--color-admin-paper)] p-5 transition"
        >
          <h3 className="text-mocha mb-1 text-sm font-semibold">Identité</h3>
          <p className="text-fg-muted text-xs">
            SIREN, TVA, capital, siège, signataire, IBAN — lus depuis les réglages, sans seconde
            saisie.
          </p>
        </Link>

        {SOCIETE_RUBRIQUES.map((r) => {
          const c = parRubrique.get(r.key);
          const couverts = c?.attendusCouverts ?? 0;
          const attendus = c?.attendusTotal ?? 0;
          const complet = attendus > 0 && couverts === attendus;
          return (
            <Link
              key={r.key}
              href={`${base}/${r.segment}`}
              className="border-border hover:border-terracotta rounded-lg border bg-[color:var(--color-admin-paper)] p-5 transition"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-mocha text-sm font-semibold">{r.label}</h3>
                <span
                  className={`text-xs font-medium tabular-nums ${
                    complet
                      ? "text-[color:var(--color-admin-success-fg)]"
                      : "text-[color:var(--color-admin-warning-fg)]"
                  }`}
                >
                  {couverts} / {attendus}
                </span>
              </div>
              <p className="text-fg-muted line-clamp-3 text-xs">{r.description}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
