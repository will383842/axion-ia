import { CATEGORIES, HAUTEUR_CARTE, LARGEUR_CARTE } from "@/lib/equipe";
import type { FichePublique } from "@/lib/equipe";
import type { VilleConnue } from "@/lib/equipe";
import { ENCART, ENCART_HAUT, preparerCarte, type Amas } from "./carte-donnees";
import { jetonsDe, varCss } from "./couleurs-categorie";
import { FOND_FRANCE_PATH } from "./fond-france";
import { FormeCategorie } from "./FormeCategorie";
import { PastilleCategorie } from "./PastilleCategorie";

const TAILLE_FORME = 16;
const RAYON_CIBLE = 12;
const IVOIRE = "var(--color-bg)";
const MOCHA = "var(--color-mocha)";

const hrefParDefaut = (slug: string) => `/fr/equipe/${slug}`;

const classePoint =
  "group [transform-box:fill-box] origin-center cursor-pointer transition-transform duration-150 hover:scale-125 focus-visible:scale-125 motion-reduce:transition-none focus:outline-none";

function Anneau() {
  // Anneau de focus (l'outline natif d'un lien SVG n'est pas fiable partout) : mocha, 2,5 unités.
  return (
    <circle
      r={RAYON_CIBLE + 2}
      fill="none"
      stroke={MOCHA}
      strokeWidth="2.5"
      className="opacity-0 group-focus-visible:opacity-100"
    />
  );
}

function intitule(f: FichePublique, amas: Amas): string {
  const lieu = amas.lieux[f.slug] ?? amas.libelle;
  return `${f.nom}, ${CATEGORIES[f.categorie].libelleSingulier}, ${lieu}`;
}

function PointsDeAmas({ amas, href }: { amas: Amas; href: (slug: string) => string }) {
  const { centre, decalages, personnes } = amas;
  if (decalages === null) {
    const texte = `${personnes.length} collaborateurs à ${amas.libelle} : voir la liste`;
    return (
      <a href={`#${amas.ancre}`} aria-label={texte} className={classePoint}>
        <title>{texte}</title>
        <g transform={`translate(${centre.x} ${centre.y})`}>
          <circle r={RAYON_CIBLE} fill="transparent" />
          <circle r="10" fill={IVOIRE} stroke={MOCHA} strokeWidth="2" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9.5"
            fontWeight="700"
            fill={MOCHA}
            aria-hidden="true"
          >
            {`+${personnes.length}`}
          </text>
          <Anneau />
        </g>
      </a>
    );
  }
  return (
    <>
      {personnes.map((f, i) => {
        const d = decalages[i] ?? { x: 0, y: 0 };
        const j = jetonsDe(f.categorie);
        const nom = intitule(f, amas);
        return (
          <a key={f.slug} href={href(f.slug)} aria-label={nom} className={classePoint}>
            <title>{nom}</title>
            <g transform={`translate(${centre.x + d.x} ${centre.y + d.y})`}>
              <circle r={RAYON_CIBLE} fill="transparent" />
              <g transform={`translate(${-TAILLE_FORME / 2} ${-TAILLE_FORME / 2})`}>
                <FormeCategorie
                  forme={CATEGORIES[f.categorie].forme}
                  couleur={varCss(j.forme)}
                  taille={TAILLE_FORME}
                  contour={IVOIRE}
                />
              </g>
              <Anneau />
            </g>
          </a>
        );
      })}
    </>
  );
}

/**
 * Carte de France des collaborateurs : SVG inline, zéro JavaScript, aucune bibliothèque.
 * Reçoit des fiches DÉJÀ filtrées (publiées ET `afficherSurCarte`) ; le dirigeant principal
 * n'a jamais de point, même passé en entrée. Le titre H2 est rendu par la page : `idTitre`
 * en est l'identifiant. La liste groupée par région puis ville est l'équivalent texte.
 */
export function CarteFrance({
  fiches,
  idTitre = "equipe-carte-titre",
  villes = [],
  hrefFiche = hrefParDefaut,
  avecDirigeant = false,
}: {
  /** Vrai seulement si la ligne facultative du dirigeant porte un lieu (le dirigeant n'a sinon jamais de point). */
  avecDirigeant?: boolean;
  fiches: ReadonlyArray<FichePublique>;
  idTitre?: string;
  villes?: ReadonlyArray<VilleConnue>;
  hrefFiche?: (slug: string) => string;
}) {
  const d = preparerCarte(fiches, villes, { avecDirigeant });
  if (d.total === 0) return null;
  const metropole = d.amas.filter((a) => a.outreMer === null);
  const outreMer = d.amas.filter((a) => a.outreMer !== null);
  const nbFentes = outreMer.length;

  return (
    <div>
      <div
        className="border-border bg-bg mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border"
        style={{ aspectRatio: `${LARGEUR_CARTE} / ${HAUTEUR_CARTE}` }}
      >
        <svg
          viewBox={`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`}
          width="100%"
          height="100%"
          role="group"
          aria-labelledby={idTitre}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d={FOND_FRANCE_PATH}
            fill="var(--color-sage-soft)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            aria-hidden="true"
          />
          {nbFentes > 0 ? (
            <g>
              <rect
                x={ENCART.x - 6}
                y={ENCART_HAUT}
                width={ENCART.largeurFente * nbFentes + 12}
                height={ENCART.hauteur}
                rx="8"
                fill="var(--color-paper)"
                stroke="var(--color-border)"
                aria-hidden="true"
              />
              {outreMer.map((a) => (
                <text
                  key={a.ancre}
                  x={a.centre.x}
                  y={ENCART_HAUT + ENCART.hauteur - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-fg-soft)"
                  aria-hidden="true"
                >
                  {a.libelle}
                </text>
              ))}
            </g>
          ) : null}
          {[...metropole, ...outreMer].map((a) => (
            <PointsDeAmas key={a.ancre + (a.outreMer ?? "")} amas={a} href={hrefFiche} />
          ))}
        </svg>
      </div>

      <ul
        className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2"
        aria-label="Légende de la carte"
      >
        {d.parCategorie
          .slice()
          .sort((a, b) => CATEGORIES[a.categorie].ordreHub - CATEGORIES[b.categorie].ordreHub)
          .map(({ categorie, nombre }) => (
            <li key={categorie} className="text-fg flex items-center gap-2 text-sm">
              <PastilleCategorie categorie={categorie} pluriel />
              <span className="text-fg-soft">({nombre})</span>
            </li>
          ))}
      </ul>

      <div id="equipe-liste" className="mx-auto mt-8 max-w-3xl scroll-mt-24">
        {d.regions.map((r) => (
          <div key={r.cle} id={r.ancre} className="mt-4 scroll-mt-24">
            <h3 className="text-fg text-base font-semibold">{r.libelle}</h3>
            <ul className="mt-1 space-y-1">
              {r.villes.map((v) => (
                <li key={v.ancre} id={v.ancre} className="text-fg-soft scroll-mt-24 text-[15px]">
                  <span className="text-fg">{v.libelle}</span>
                  {" : "}
                  {v.personnes.map((f, i) => (
                    <span key={f.slug}>
                      {i > 0 ? ", " : ""}
                      <a href={hrefFiche(f.slug)} className="text-fg underline underline-offset-2">
                        {f.nom}
                      </a>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
