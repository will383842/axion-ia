import { createElement } from "react";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { iconeDe } from "./icones";
import { Silhouettes } from "./Silhouettes";

/**
 * Bloc « Vous êtes… » : le dirigeant se reconnaît (par taille, puis par métier).
 * Composant serveur, props typées localement (aucun import de `ContenuFiche`).
 * Chaque carte suit trois temps : ce qui coûte → ce que l'on met en place → ce que l'on y gagne.
 */
export type IconeMetier =
  | "btp"
  | "commerce"
  | "industrie"
  | "transport"
  | "cabinet"
  | "immobilier"
  | "restauration"
  | "services";

export type TonCarte = "terracotta" | "ochre" | "sage" | "plum" | "mocha";

export interface CarteVousEtes {
  id: string;
  titre: string;
  cout: string;
  action: string;
  gain: string;
  /** Métiers : icône lucide. */
  icone?: IconeMetier | string;
  /** Tailles : nombre de silhouettes. */
  silhouettes?: 1 | 2 | 3;
  ton?: TonCarte;
}

export interface VousEtesProps {
  id?: string;
  surTitre: string;
  question: string;
  /** Réponse directe de 40 à 60 mots. */
  reponse?: string;
  titreTailles?: string;
  titreMetiers?: string;
  tailles: ReadonlyArray<CarteVousEtes>;
  metiers: ReadonlyArray<CarteVousEtes>;
  /** Pastilles « Et tous les autres secteurs… » (texte seul). */
  autresSecteurs?: ReadonlyArray<string>;
  phraseAutres?: string;
  /** Lien sous les pastilles (ex. « Les formations par secteur »). */
  lien?: { href: string; libelle: string };
}

/** Classes statiques (Tailwind) : jetons existants, tons chauds, jamais de bleu. */
const TONS: Record<TonCarte, string> = {
  terracotta: "bg-terracotta-soft text-terracotta-deep",
  ochre: "bg-ochre-soft text-ochre-deep",
  sage: "bg-sage-soft text-sage",
  plum: "bg-plum-soft text-plum-deep",
  mocha: "bg-sand text-fg",
};

const ETIQUETTE =
  "shrink-0 w-14 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted";

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="text-terracotta ml-5 h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 5l5 5 5-5" />
    </svg>
  );
}

function Carte({ carte }: { carte: CarteVousEtes }) {
  const ton = TONS[carte.ton ?? "terracotta"];
  return (
    <li className="border-border bg-paper flex flex-col rounded-2xl border p-5 hover:shadow-sm motion-safe:transition motion-safe:hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ton}`}
          aria-hidden="true"
        >
          {carte.silhouettes ? (
            <Silhouettes nombre={carte.silhouettes} className="h-6 w-8" />
          ) : (
            createElement(iconeDe(carte.icone ?? "BriefcaseBusiness"), {
              className: "h-5 w-5",
              "aria-hidden": true,
              focusable: "false",
            })
          )}
        </span>
        <h3 className="text-fg font-serif text-xl leading-snug">{carte.titre}</h3>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-fg-soft flex gap-3 text-[15px] leading-snug">
          <span className={ETIQUETTE}>Coût</span>
          <span>{carte.cout}</span>
        </p>
        <Chevron />
        <p className="text-fg-soft flex gap-3 text-[15px] leading-snug">
          <span className={ETIQUETTE}>Action</span>
          <span>{carte.action}</span>
        </p>
        <Chevron />
        <p className="text-terracotta-deep flex gap-3 text-[15px] leading-snug font-bold">
          <span className={ETIQUETTE}>Gain</span>
          <span>{carte.gain}</span>
        </p>
      </div>
    </li>
  );
}

function Grille({
  cartes,
  colonnes,
  titre,
  idTitre,
}: {
  cartes: ReadonlyArray<CarteVousEtes>;
  colonnes: string;
  titre?: string;
  idTitre: string;
}) {
  if (cartes.length === 0) return null;
  return (
    <div className="mt-10 first:mt-0">
      {titre ? (
        <p
          id={idTitre}
          className="text-fg-muted mb-4 text-sm font-semibold tracking-[0.12em] uppercase"
        >
          {titre}
        </p>
      ) : null}
      <ul aria-labelledby={titre ? idTitre : undefined} className={`grid gap-4 ${colonnes}`}>
        {cartes.map((c) => (
          <Carte key={c.id} carte={c} />
        ))}
      </ul>
    </div>
  );
}

export function VousEtes({
  id = "vous-etes",
  surTitre,
  question,
  reponse,
  titreTailles = "Par taille d'entreprise",
  titreMetiers = "Par métier",
  tailles,
  metiers,
  autresSecteurs,
  phraseAutres,
  lien,
}: VousEtesProps) {
  // Masqué s'il n'y a aucune donnée (jamais de titre vide).
  if (tailles.length === 0 && metiers.length === 0) return null;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      data-fond="creme"
      className="bg-sand py-16 lg:py-24"
    >
      <Container>
        <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
          {surTitre}
        </p>
        <h2
          id={`${id}-titre`}
          className="text-fg mt-2 max-w-3xl font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight tracking-tight"
        >
          {question}
        </h2>
        {reponse ? (
          <p
            data-reponse-section=""
            className="text-fg-soft mt-4 max-w-3xl text-lg leading-relaxed sm:text-xl"
          >
            {reponse}
          </p>
        ) : null}
        <div className="mt-10 lg:mt-14">
          <Grille
            cartes={tailles}
            colonnes="sm:grid-cols-2 lg:grid-cols-3"
            titre={titreTailles}
            idTitre={`${id}-tailles`}
          />
          <Grille
            cartes={metiers}
            colonnes="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            titre={titreMetiers}
            idTitre={`${id}-metiers`}
          />
        </div>
        {autresSecteurs && autresSecteurs.length > 0 ? (
          <div className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {autresSecteurs.map((s) => (
                <li
                  key={s}
                  className="border-border-strong bg-paper text-fg rounded-full border px-4 py-2 text-[15px] font-medium"
                >
                  {s}
                </li>
              ))}
            </ul>
            {phraseAutres ? <p className="text-fg-soft mt-4 max-w-3xl">{phraseAutres}</p> : null}
            {lien ? (
              <p className="mt-2">
                <Link
                  href={lien.href as never}
                  className="text-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {lien.libelle}
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
