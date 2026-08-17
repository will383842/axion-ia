// Aperçu de partage — la vignette telle que les messageries l'affichent.
//
// 🔴 POURQUOI CE COMPOSANT — recensement OG du 2026-08-17.
//
// La demande était explicite : « je veux VOIR la vignette telle qu'elle
// apparaîtra dans WhatsApp et LinkedIn, pas une liste de balises ». Une liste
// de `<meta>` ne dit pas si le titre sera coupé, si la description tiendra, ni
// si l'image sera grande ou réduite à une pastille.
//
// 🔑 LES TROIS RENDUS NE SONT PAS DÉCORATIFS — ils diffèrent sur le point qui
// casse le plus souvent :
//
//   · LinkedIn  : grande carte SI l'image fait ≥ 1200 px de large, sinon
//                 vignette carrée à gauche. C'est exactement le défaut qui
//                 touchait les 134 articles de blog (1080 px de large).
//   · WhatsApp  : bulle étroite, titre sur 2 lignes, description sur 2.
//   · Slack     : barre latérale, image réduite, description sur 3 lignes.
//
// Server Component pur : aucun JS expédié au navigateur.

/* eslint-disable @next/next/no-img-element -- APERÇU FIDÈLE, PAS IMAGE DE PAGE.
   Cet écran affiche l'URL EXACTE que le robot social ira chercher. Passer par
   `next/image` la ré-encoderait et la redimensionnerait : un fichier cassé,
   trop petit ou injoignable — précisément ce que cet écran existe pour
   révéler — s'afficherait alors normalement. L'optimisation serait ici une
   falsification. Écran d'administration, hors du budget Web Vitals public. */

import { OG_LARGEUR_MINIMALE_GRANDE_CARTE } from "@/lib/og-format";

// Couleurs de MARQUES TIERCES, pas de notre palette.
//
// 🔑 Ces deux teintes n'ont rien à faire dans nos tokens : ce sont celles de
// WhatsApp et de Slack, et elles n'existent ici que pour rendre les mocks
// reconnaissables au premier coup d'œil. Les remplacer par un token Axion-IA
// rendrait les trois aperçus identiques — donc inutiles, puisque tout l'intérêt
// est de reconnaître le réseau sans lire son nom. Elles sont posées en style
// inline (et non en classe Tailwind arbitraire) pour rester assumées et
// localisées à cet endroit.
const WHATSAPP_BULLE = "#dcf8c6"; // hex-ok: vert de bulle WhatsApp, marque tierce
const SLACK_LIEN = "#1264a3"; // hex-ok: bleu de lien Slack, marque tierce

export type ReseauApercu = "linkedin" | "whatsapp" | "slack";

interface Props {
  readonly reseau: ReseauApercu;
  readonly image: string | null;
  readonly titre: string | null;
  readonly description: string | null;
  /** URL de la page, pour le domaine affiché sous la carte. */
  readonly url: string;
  /**
   * Largeur RÉELLE du fichier. Décide du rendu LinkedIn : sous le seuil, la
   * grande carte devient une vignette. `null` = pas encore mesurée.
   */
  readonly largeurReelle: number | null;
}

const LIBELLE: Record<ReseauApercu, string> = {
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  slack: "Slack",
};

function domaineDe(url: string): string {
  try {
    return new URL(url, "https://axion-ia.com").hostname.replace(/^www\./, "");
  } catch {
    return "axion-ia.com";
  }
}

/** Ce que le réseau affiche à la place de l'image quand il n'y en a pas. */
function CadreVide({ hauteur }: { hauteur: string }) {
  return (
    <div
      className={`flex ${hauteur} w-full items-center justify-center border-b border-neutral-200 bg-neutral-100 text-center text-xs text-neutral-500`}
    >
      Aucune image — le lien se partagera nu
    </div>
  );
}

export function ApercuPartage({ reseau, image, titre, description, url, largeurReelle }: Props) {
  const domaine = domaineDe(url);
  const titreAffiche = titre?.trim() || "(aucun titre de partage)";
  const descriptionAffichee = description?.trim() || "(aucune description)";

  // Le seul endroit où la mesure change le RENDU, et non un simple libellé.
  const grandeCarte = largeurReelle === null || largeurReelle >= OG_LARGEUR_MINIMALE_GRANDE_CARTE;

  if (reseau === "linkedin") {
    return (
      <figure className="w-full max-w-[520px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
        {grandeCarte ? (
          <>
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                className="aspect-[1200/675] w-full border-b border-neutral-200 object-cover"
              />
            ) : (
              <CadreVide hauteur="h-[240px]" />
            )}
            <figcaption className="px-3 py-2">
              <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{titreAffiche}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{domaine}</p>
            </figcaption>
          </>
        ) : (
          // Sous 1200 px : LinkedIn abandonne la grande carte.
          <figcaption className="flex gap-3 p-3">
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                className="h-20 w-20 flex-none rounded border border-neutral-200 object-cover"
              />
            ) : (
              <div className="h-20 w-20 flex-none rounded bg-neutral-100" />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{titreAffiche}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{domaine}</p>
            </div>
          </figcaption>
        )}
      </figure>
    );
  }

  if (reseau === "whatsapp") {
    return (
      <figure
        className="w-full max-w-[340px] overflow-hidden rounded-lg p-1 shadow-sm"
        style={{ background: WHATSAPP_BULLE }}
      >
        <div className="overflow-hidden rounded-md bg-white">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="aspect-[1200/675] w-full object-cover"
            />
          ) : (
            <CadreVide hauteur="h-[160px]" />
          )}
          <figcaption className="px-2.5 py-2">
            <p className="line-clamp-2 text-[13px] font-medium text-neutral-900">{titreAffiche}</p>
            <p className="line-clamp-2 text-[12px] text-neutral-600">{descriptionAffichee}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">{domaine}</p>
          </figcaption>
        </div>
      </figure>
    );
  }

  return (
    <figure className="w-full max-w-[460px] border-l-4 border-neutral-300 bg-white py-1 pl-3">
      <figcaption>
        <p className="text-xs font-semibold text-neutral-500">{domaine}</p>
        <p className="line-clamp-2 text-sm font-semibold" style={{ color: SLACK_LIEN }}>
          {titreAffiche}
        </p>
        <p className="line-clamp-3 text-[13px] text-neutral-700">{descriptionAffichee}</p>
      </figcaption>
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="mt-1.5 aspect-[1200/675] w-[360px] max-w-full rounded border border-neutral-200 object-cover"
        />
      ) : (
        <div className="mt-1.5 w-[360px] max-w-full">
          <CadreVide hauteur="h-[120px]" />
        </div>
      )}
    </figure>
  );
}

/** Les trois rendus côte à côte, avec leur nom au-dessus. */
export function ApercuPartageTrio(props: Omit<Props, "reseau">) {
  const reseaux: ReseauApercu[] = ["linkedin", "whatsapp", "slack"];
  return (
    <div className="flex flex-wrap items-start gap-6">
      {reseaux.map((r) => (
        <div key={r} className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {LIBELLE[r]}
          </p>
          <ApercuPartage reseau={r} {...props} />
        </div>
      ))}
    </div>
  );
}
