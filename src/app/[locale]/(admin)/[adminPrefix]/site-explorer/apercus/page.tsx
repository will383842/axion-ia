// Onglet « Aperçus de partage » — recensement OG du 2026-08-17.
//
// 🔴 CE QUE CET ÉCRAN RÉPARE. Il n'existait aucun endroit où voir ce que le
// site sert quand on partage un lien. On découvrait un aperçu cassé en le
// partageant — et les 1 667 URLs indexables annonçaient toutes une taille
// d'image que le fichier n'avait pas.
//
// 🔑 UNE LIGNE PAR MODÈLE, PAS PAR URL. Le site pré-rend 17 629 routes, dont
// 10 162 pages ville×service qui ne diffèrent que d'un nom de ville. Afficher
// 10 162 vignettes quasi identiques n'apprendrait rien. On montre donc un
// exemple rendu par modèle, avec le nombre de routes qu'il représente.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import {
  listerApercusParModele,
  statistiquesApercus,
  type NatureApercu,
} from "@/server/actions/site-explorer/og-apercus";
import { ApercuPartageTrio } from "@/components/admin/site-explorer/ApercuPartage";
import { adminPath } from "@/lib/admin-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçus de partage — ce que voient WhatsApp et LinkedIn | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const NATURE_LABELS: Record<NatureApercu, string> = {
  carte_generee: "Carte générée",
  image_propre: "Image propre",
  image_tierce: "Hébergée ailleurs",
  aucune: "Aucune image",
};

const NATURE_TONS: Record<NatureApercu, string> = {
  carte_generee:
    "bg-[color:var(--color-admin-surface-sunken)] text-[color:var(--color-admin-fg-soft)]",
  image_propre:
    "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
  image_tierce:
    "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
  aucune:
    "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Tuile({
  label,
  valeur,
  ton = "neutral",
  aide,
}: {
  label: string;
  valeur: number;
  ton?: "neutral" | "green" | "amber" | "red";
  aide?: string;
}) {
  const tons: Record<string, string> = {
    neutral: "border-[color:var(--color-admin-border)] bg-white",
    green: "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)]",
    amber: "border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)]",
    red: "border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)]",
  };
  return (
    <div className={`rounded-lg border p-3 ${tons[ton]}`}>
      <p className="text-2xl font-semibold tabular-nums">{valeur.toLocaleString("fr-FR")}</p>
      <p className="text-xs text-[color:var(--color-admin-fg-muted)]">{label}</p>
      {aide ? (
        <p className="mt-0.5 text-[11px] text-[color:var(--color-admin-fg-muted)]">{aide}</p>
      ) : null}
    </div>
  );
}

export default async function ApercusPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const lire = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const nature = lire("nature") as NatureApercu | undefined;
  const filtres = {
    ...(lire("category") ? { category: lire("category")! } : {}),
    ...(nature ? { nature } : {}),
    ...(lire("defauts") === "1" ? { defautsSeuls: true } : {}),
    ...(lire("q") ? { recherche: lire("q")! } : {}),
  };

  const [{ modeles, tronque, luesr }, stats] = await Promise.all([
    listerApercusParModele(filtres),
    statistiquesApercus(),
  ]);

  const base = adminPath("fr", "site-explorer");
  const enDefaut = modeles.filter((m) => m.defauts.length > 0).length;

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold">Aperçus de partage</h1>
          <Link href={base} className="text-sm text-[color:var(--color-admin-info)] underline">
            ← Toutes les URLs
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-[color:var(--color-admin-fg-muted)]">
          Ce que voient WhatsApp, LinkedIn et Slack quand un lien du site est partagé. Une ligne par{" "}
          <strong>modèle d&apos;URL</strong> : les pages qui ne diffèrent que d&apos;un nom de ville
          partagent le même aperçu, à un mot près.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <Tuile label="Modèles d'URL" valeur={stats.modeles} />
        <Tuile
          label="Routes relevées"
          valeur={stats.relevees}
          aide={`sur ${stats.routesPubliques}`}
        />
        <Tuile label="Carte générée" valeur={stats.carteGeneree} />
        <Tuile label="Image propre" valeur={stats.imagePropre} ton="green" />
        <Tuile label="Hébergée ailleurs" valeur={stats.imageTierce} ton="amber" />
        <Tuile
          label="Aucune image"
          valeur={stats.aucune}
          ton={stats.aucune > 0 ? "red" : "neutral"}
        />
        <Tuile
          label="Taille annoncée fausse"
          valeur={stats.dimensionsFausses}
          ton={stats.dimensionsFausses > 0 ? "red" : "green"}
        />
        <Tuile
          label="Trop petites pour LinkedIn"
          valeur={stats.tropPetites}
          ton={stats.tropPetites > 0 ? "amber" : "green"}
        />
        <Tuile
          label="Images injoignables"
          valeur={stats.injoignables}
          ton={stats.injoignables > 0 ? "red" : "green"}
        />
      </section>

      {/* 🔑 Une page vide doit DIRE pourquoi. Sans ce bloc, un inspecteur qui
          n'a encore rien relevé produirait un écran désert qu'on lirait comme
          « tout va bien ». */}
      {stats.relevees === 0 ? (
        <p className="rounded-lg border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)] p-3 text-sm text-[color:var(--color-admin-warning-fg)]">
          Aucune route n&apos;a encore été relevée. L&apos;inspecteur passe chaque nuit et traite
          500 URLs par run — les aperçus apparaîtront au fil de ses passages. Le bouton «
          ré-inspecter » de la fiche d&apos;une URL force son relevé immédiatement.
        </p>
      ) : null}

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="?"
          className="rounded border border-[color:var(--color-admin-border-strong)] px-2 py-1 hover:bg-[color:var(--color-admin-paper-alt)]"
        >
          Tous
        </Link>
        <Link
          href="?defauts=1"
          className="rounded border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] px-2 py-1 text-[color:var(--color-admin-destructive-fg)] hover:bg-[color:var(--color-admin-destructive-soft)]"
        >
          En défaut ({enDefaut})
        </Link>
        {(Object.keys(NATURE_LABELS) as NatureApercu[]).map((n) => (
          <Link
            key={n}
            href={`?nature=${n}`}
            className="rounded border border-[color:var(--color-admin-border-strong)] px-2 py-1 hover:bg-[color:var(--color-admin-paper-alt)]"
          >
            {NATURE_LABELS[n]}
          </Link>
        ))}
      </nav>

      {tronque ? (
        <p className="rounded-lg border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)] p-3 text-sm text-[color:var(--color-admin-warning-fg)]">
          Lecture bornée à {luesr.toLocaleString("fr-FR")} routes : au-delà, la page cesserait de se
          charger. Des modèles peuvent manquer — affiner par catégorie ou par recherche pour voir le
          reste. (Cette limite est dite, jamais silencieuse.)
        </p>
      ) : null}

      <section className="space-y-8">
        {modeles.length === 0 ? (
          <p className="text-sm text-[color:var(--color-admin-fg-muted)]">
            Aucun modèle ne correspond à ce filtre.
          </p>
        ) : null}

        {modeles.map((m) => (
          <article
            key={m.pathPattern}
            className="space-y-3 border-t border-[color:var(--color-admin-border)] pt-5"
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <code className="rounded bg-[color:var(--color-admin-surface-sunken)] px-1.5 py-0.5 text-sm">
                {m.pathPattern}
              </code>
              <span className={`rounded px-1.5 py-0.5 text-xs ${NATURE_TONS[m.nature]}`}>
                {NATURE_LABELS[m.nature]}
              </span>
              <span className="text-xs text-[color:var(--color-admin-fg-muted)]">
                {m.routes.toLocaleString("fr-FR")} route{m.routes > 1 ? "s" : ""} · {m.relevees}{" "}
                relevée{m.relevees > 1 ? "s" : ""}
              </span>
              <Link
                href={`${base}/${m.id}`}
                className="text-xs text-[color:var(--color-admin-info)] underline"
              >
                fiche de l&apos;exemple
              </Link>
              <a
                href={m.exemple}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[color:var(--color-admin-info)] underline"
              >
                voir la page
              </a>
              {/* Deux portées offertes explicitement : modifier CETTE page, ou
                  TOUTE la famille. Le second lien est le seul moyen d'atteindre
                  les milliers de pages ville×service. */}
              <Link
                href={`${base}/apercus/surcharge?portee=route&cible=${encodeURIComponent(m.exemple)}`}
                className="rounded border border-[color:var(--color-admin-border-strong)] px-1.5 py-0.5 text-xs hover:bg-[color:var(--color-admin-paper-alt)]"
              >
                modifier cette URL
              </Link>
              {m.routes > 1 ? (
                <Link
                  href={`${base}/apercus/surcharge?portee=modele&cible=${encodeURIComponent(m.pathPattern)}`}
                  className="rounded border border-[color:var(--color-admin-border-strong)] px-1.5 py-0.5 text-xs hover:bg-[color:var(--color-admin-paper-alt)]"
                >
                  modifier les {m.routes.toLocaleString("fr-FR")} pages du modèle
                </Link>
              ) : null}
            </header>

            {m.defauts.length > 0 ? (
              <ul className="space-y-0.5 text-sm text-[color:var(--color-admin-destructive-fg)]">
                {m.defauts.map((d) => (
                  <li key={d} className="flex items-start gap-1.5">
                    {/* Convention console : un composant lucide-react, jamais un emoji. */}
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}

            {m.ogInspectedAt ? (
              <ApercuPartageTrio
                image={m.ogImage}
                titre={m.ogTitle}
                description={m.ogDescription}
                url={m.exemple}
                largeurReelle={m.ogImageWidth}
              />
            ) : (
              <p className="text-sm text-[color:var(--color-admin-fg-muted)]">
                Pas encore relevée — l&apos;aperçu s&apos;affichera après le passage de
                l&apos;inspecteur.
              </p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
