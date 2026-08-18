// Modifier l'aperçu de partage d'une URL ou d'un modèle entier.
//
// 🔴 CE QUE CET ÉCRAN OUVRE — recensement OG du 2026-08-17. Rien n'était
// modifiable : l'aperçu de chaque page était calculé dans le code, et le seul
// champ qui prétendait l'être n'était lu par personne.
//
// 🔑 DEUX PORTÉES. « Cette URL » pour un cas précis ; « ce modèle » pour toute
// une famille — c'est le seul moyen d'atteindre les 10 162 pages ville×service,
// qui ne sont même pas au catalogue des URLs.
//
// ⚠️ CE FORMULAIRE NE TOUCHE QUE L'APERÇU SOCIAL. Ni le titre de la page, ni sa
// description de référencement, ni sa canonique. C'est écrit à l'écran, parce
// que confondre les deux ferait changer le SEO en croyant retoucher une image.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { ApercuPartageTrio } from "@/components/admin/site-explorer/ApercuPartage";
import {
  enregistrerSurchargeOg,
  retirerSurchargeOg,
} from "@/server/actions/site-explorer/og-surcharge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modifier un aperçu de partage | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function champ(f: FormData, nom: string): string | null {
  const v = f.get(nom);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function entier(f: FormData, nom: string): number | null {
  const v = champ(f, nom);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function SurchargePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const lire = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const portee = lire("portee") === "modele" ? ("modele" as const) : ("route" as const);
  const cible = lire("cible") ?? "";
  const base = adminPath("fr", "site-explorer");
  const retour = `${base}/apercus`;

  if (!cible.startsWith("/")) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-xl font-semibold">Modifier un aperçu de partage</h1>
        <p className="text-sm text-red-800">
          Aucune cible valide reçue. Revenir aux{" "}
          <Link href={retour} className="underline">
            aperçus
          </Link>{" "}
          et cliquer « modifier » sur une ligne.
        </p>
      </div>
    );
  }

  const existante = await prisma.ogOverride.findUnique({
    where: { portee_cible: { portee, cible } },
  });

  // L'aperçu réellement servi aujourd'hui, pour comparer avant/après.
  const route = await prisma.siteRoute.findFirst({
    where: portee === "route" ? { pathRendered: cible } : { pathPattern: cible },
    select: {
      pathRendered: true,
      ogImage: true,
      ogTitle: true,
      ogDescription: true,
      ogImageWidth: true,
    },
    orderBy: { ogInspectedAt: "desc" },
  });

  const message = lire("m");
  const erreur = lire("e");
  const avertissement = lire("a");

  async function enregistrer(formData: FormData) {
    "use server";
    const resultat = await enregistrerSurchargeOg({
      portee,
      cible,
      ogTitle: champ(formData, "ogTitle"),
      ogDescription: champ(formData, "ogDescription"),
      ogImage: champ(formData, "ogImage"),
      ogImageWidth: entier(formData, "ogImageWidth"),
      ogImageHeight: entier(formData, "ogImageHeight"),
      ogEyebrow: champ(formData, "ogEyebrow"),
      note: champ(formData, "note"),
    });
    const q = new URLSearchParams({ portee, cible });
    if (resultat.ok) {
      q.set("m", resultat.message);
      if (resultat.avertissement) q.set("a", resultat.avertissement);
    } else {
      q.set("e", resultat.message);
    }
    revalidatePath(`${base}/apercus/surcharge`);
    redirect(`${base}/apercus/surcharge?${q.toString()}`);
  }

  async function retirer() {
    "use server";
    const resultat = await retirerSurchargeOg(portee, cible);
    const q = new URLSearchParams({ portee, cible, m: resultat.message });
    revalidatePath(`${base}/apercus/surcharge`);
    redirect(`${base}/apercus/surcharge?${q.toString()}`);
  }

  return (
    <div className="max-w-5xl space-y-6 p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold">Modifier un aperçu de partage</h1>
          <Link href={retour} className="text-sm text-blue-700 underline">
            ← Aperçus de partage
          </Link>
        </div>
        <p className="text-sm text-neutral-600">
          {portee === "modele" ? (
            <>
              Portée <strong>modèle</strong> : cette surcharge s&apos;applique à{" "}
              <strong>toutes les pages</strong> qui suivent ce schéma d&apos;URL. Une surcharge
              posée sur une URL précise l&apos;emporte sur celle-ci.
            </>
          ) : (
            <>
              Portée <strong>cette URL seulement</strong>.
            </>
          )}
        </p>
        <code className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-sm">{cible}</code>
      </header>

      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Ces champs ne changent <strong>que l&apos;aperçu de partage</strong> (WhatsApp, LinkedIn,
        Slack, Facebook). Le titre de la page dans Google, sa description de référencement et son
        adresse canonique ne bougent pas.
      </p>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {avertissement ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {avertissement}
        </p>
      ) : null}
      {erreur ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {erreur}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-700">
          Ce qui est servi aujourd&apos;hui
        </h2>
        {route ? (
          <ApercuPartageTrio
            image={route.ogImage}
            titre={route.ogTitle}
            description={route.ogDescription}
            url={route.pathRendered ?? cible}
            largeurReelle={route.ogImageWidth}
          />
        ) : (
          <p className="text-sm text-neutral-500">
            Cette cible n&apos;a pas encore été relevée par l&apos;inspecteur — impossible de
            montrer l&apos;aperçu actuel. La surcharge fonctionnera quand même.
          </p>
        )}
      </section>

      <form action={enregistrer} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="admin-field md:col-span-2">
            <label htmlFor="ogTitle" className="admin-label">
              Titre de l&apos;aperçu
            </label>
            <input
              id="ogTitle"
              name="ogTitle"
              type="text"
              maxLength={500}
              defaultValue={existante?.ogTitle ?? ""}
              placeholder="Laisser vide pour garder le titre calculé"
              className="admin-input"
            />
          </div>
          <div className="admin-field md:col-span-2">
            <label htmlFor="ogDescription" className="admin-label">
              Description de l&apos;aperçu
            </label>
            <input
              id="ogDescription"
              name="ogDescription"
              type="text"
              maxLength={500}
              defaultValue={existante?.ogDescription ?? ""}
              placeholder="Laisser vide pour garder la description calculée"
              className="admin-input"
            />
          </div>
          <div className="admin-field md:col-span-2">
            <label htmlFor="ogImage" className="admin-label">
              Image de l&apos;aperçu — URL absolue (https://…)
            </label>
            <input
              id="ogImage"
              name="ogImage"
              type="url"
              maxLength={1000}
              defaultValue={existante?.ogImage ?? ""}
              placeholder="https://axion-ia.com/og/mon-image.webp"
              className="admin-input"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Un chemin relatif ne marche pas : aucun réseau social ne le résout. Format conseillé :
              1200 × 675. Sous 1200 px de large, LinkedIn n&apos;affiche qu&apos;une vignette.
            </p>
          </div>
          <div className="admin-field">
            <label htmlFor="ogImageWidth" className="admin-label">
              Largeur réelle (px)
            </label>
            <input
              id="ogImageWidth"
              name="ogImageWidth"
              type="number"
              min={1}
              defaultValue={existante?.ogImageWidth ?? ""}
              className="admin-input"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="ogImageHeight" className="admin-label">
              Hauteur réelle (px)
            </label>
            <input
              id="ogImageHeight"
              name="ogImageHeight"
              type="number"
              min={1}
              defaultValue={existante?.ogImageHeight ?? ""}
              className="admin-input"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Les deux ou aucune. Laisser vide si la taille n&apos;est pas connue : mieux vaut ne
              rien annoncer qu&apos;annoncer un chiffre faux.
            </p>
          </div>
          <div className="admin-field md:col-span-2">
            <label htmlFor="ogEyebrow" className="admin-label">
              Sous-ligne de la carte générée
            </label>
            <input
              id="ogEyebrow"
              name="ogEyebrow"
              type="text"
              maxLength={200}
              defaultValue={existante?.ogEyebrow ?? ""}
              className="admin-input"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Sans effet si une image est fournie ci-dessus : la carte n&apos;est alors plus la
              nôtre.
            </p>
          </div>
          <div className="admin-field md:col-span-2">
            <label htmlFor="note" className="admin-label">
              Note (pourquoi cette surcharge)
            </label>
            <input
              id="note"
              name="note"
              type="text"
              defaultValue={existante?.note ?? ""}
              className="admin-input"
            />
          </div>
        </div>

        {existante ? (
          <p className="text-xs text-neutral-500">
            Dernière modification le{" "}
            {new Date(existante.updatedAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {existante.updatedBy ? ` par ${existante.updatedBy}` : ""}.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="admin-btn admin-btn-primary">
            Enregistrer et régénérer la page
          </button>
          <Link href={retour} className="text-sm text-neutral-600 underline">
            Annuler
          </Link>
        </div>
      </form>

      {existante ? (
        <form action={retirer} className="border-t border-neutral-200 pt-4">
          <button type="submit" className="admin-btn text-red-700">
            Retirer la surcharge — la page revient à son aperçu calculé
          </button>
        </form>
      ) : null}
    </div>
  );
}
