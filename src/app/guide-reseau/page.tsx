// Page « Recevoir le guide » (lot S2) — `/guide-reseau?j=<jeton>`.
//
// COMPOSANT SERVEUR, AUCUN JavaScript client : un formulaire HTML natif en POST vers
// `/guide-reseau/envoyer` (route), qui répond 303 vers `/guide-reseau/merci`.
//
//   · interrupteur `PAGE_GUIDE_RESEAU_ENABLED` éteint → 404, rien n'est lu ;
//   · jeton absent, invalide, expiré, déjà utilisé, secret mal configuré → la MÊME page neutre
//     (texte + lien vers le formulaire /guide-ia), jamais la cause ;
//   · sinon le formulaire : prénom (obligatoire), e-mail, une case obligatoire, un champ piège.
//
// Rendu à la demande (`force-dynamic`), jamais au build : le build tourne avec une base factice
// (`stub.invalid`) et sans le secret du lien, qui n'est lu qu'ici, à la requête.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pageGuideReseauActive } from "@/server/guides-reseau/config";
import { lireSecretLien } from "@/server/guides-reseau/secret-lien";
import { empreinteJeton, verifierJeton } from "@/server/guides-reseau/lien-page-guide";
import { GUIDES_RESEAU_CONNUS, PRENOM_MAX, PRENOM_MIN } from "@/content/guides-reseau";
import { TEXTES_PAGE_GUIDE as T, URL_CONFIDENTIALITE, URL_FORMULAIRE_GUIDE } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recevoir le guide — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const un = (v: string | string[] | undefined): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;

/** Le jeton est-il utilisable ? Toute cause d'échec donne la même réponse (`false`). */
async function jetonUtilisable(jeton: string | null): Promise<boolean> {
  if (!jeton) return false;
  const secret = lireSecretLien();
  if (!secret) return false;
  try {
    const v = verifierJeton(jeton, secret, Date.now());
    // Guide inconnu = page neutre dès le GET (sinon la personne remplirait un formulaire qui échouera).
    if (!v.ok || !GUIDES_RESEAU_CONNUS.includes(v.donnees.guide)) return false;
    const deja = await prisma.contactGuideReseau.findUnique({
      where: { jetonEmpreinte: empreinteJeton(jeton) },
      select: { id: true },
    });
    return deja === null;
  } catch {
    return false;
  }
}

export default async function PageRecevoirLeGuide({ searchParams }: PageProps) {
  if (!pageGuideReseauActive()) notFound();
  const jeton = un((await searchParams)["j"]);

  if (!(await jetonUtilisable(jeton))) {
    return (
      <>
        <h1 className="text-[28px] leading-tight font-semibold">{T.titre}</h1>
        <p className="mt-4 text-[17px] leading-relaxed">{T.lienNeutre}</p>
        <p className="mt-4">
          <a className="text-terracotta-deep font-semibold underline" href={URL_FORMULAIRE_GUIDE}>
            {T.lienNeutreCta}
          </a>
        </p>
      </>
    );
  }

  const champ = "border-border bg-bg mt-1.5 block w-full rounded-lg border px-3.5 py-3 text-[17px]";
  return (
    <>
      <h1 className="text-[28px] leading-tight font-semibold">{T.titre}</h1>
      <p className="mt-4 text-[17px] leading-relaxed">{T.intro}</p>
      <form method="post" action="/guide-reseau/envoyer" className="mt-6 space-y-5">
        <input type="hidden" name="j" value={jeton as string} />
        <div>
          <label htmlFor="prenom" className="text-[16px] font-semibold">
            {T.prenom}
          </label>
          <input
            id="prenom"
            name="prenom"
            type="text"
            required
            minLength={PRENOM_MIN}
            maxLength={PRENOM_MAX}
            autoComplete="given-name"
            className={champ}
          />
        </div>
        <div>
          <label htmlFor="email" className="text-[16px] font-semibold">
            {T.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            className={champ}
          />
        </div>
        {/* Champ piège : invisible pour une personne, rempli par un robot. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
          <label htmlFor="site-web">Site web</label>
          <input id="site-web" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="flex items-start gap-3">
          <input
            id="accord"
            name="accord"
            type="checkbox"
            value="oui"
            required
            className="mt-1 h-5 w-5 shrink-0"
          />
          <label htmlFor="accord" className="text-[16px] leading-snug">
            {T.case}
          </label>
        </div>
        <p className="text-[14px] leading-snug opacity-80">
          {T.information}{" "}
          <a className="underline" href={URL_CONFIDENTIALITE}>
            {T.lienConfidentialite}
          </a>
          .
        </p>
        <button
          type="submit"
          className="bg-terracotta w-full rounded-lg px-5 py-3.5 text-[17px] font-semibold text-white"
        >
          {T.envoyer}
        </button>
      </form>
    </>
  );
}
