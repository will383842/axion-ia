import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Footprints,
  Gavel,
  Settings2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import { GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import type { ContenuFiche } from "@/lib/equipe";
import { SectionFiche } from "./visuels/SectionFiche";
import { FriseEtapes } from "./visuels/FriseEtapes";

/** En-tête en question, facultatif : sans lui, le titre de la donnée sert de H2. */
export interface EnteteProp {
  surTitre: string;
  question: string;
  reponse?: string;
}

type Props<K extends keyof ContenuFiche> = {
  donnees: NonNullable<ContenuFiche[K]>;
  entete?: EnteteProp;
  id?: string;
};

/** Icônes de la rassurance, par clé ; à défaut, l'ordre des points décide. */
const ICONES_RASSURANCE: Record<string, LucideIcon> = {
  outils: Wrench,
  etape: Footprints,
  decision: Gavel,
  equipes: Users,
  pilotage: Settings2,
};
const ORDRE_RASSURANCE: ReadonlyArray<LucideIcon> = [Wrench, Footprints, Gavel, Users, Settings2];

/** Avant / après : un vrai tableau (lu par Google et les IA), habillé en schéma. */
export function AvantApres({ donnees, entete, id = "avant-apres" }: Props<"avantApres">) {
  return (
    <SectionFiche
      id={id}
      ton="ivoire"
      entete={entete ?? { surTitre: "Avant / après", question: donnees.titre }}
    >
      <table
        role="table"
        className="w-full table-fixed max-sm:block sm:-mx-12 sm:border-separate sm:border-spacing-x-12 sm:border-spacing-y-3"
      >
        <caption className="sr-only">Situations avant et après l&apos;IA</caption>
        <thead className="max-sm:sr-only">
          <tr role="row">
            <th
              role="columnheader"
              scope="col"
              className="text-fg-muted pb-2 text-left text-xs font-semibold tracking-[0.14em] uppercase"
            >
              Avant
            </th>
            <th
              role="columnheader"
              scope="col"
              className="text-terracotta-deep pb-2 text-left text-xs font-semibold tracking-[0.14em] uppercase"
            >
              Après
            </th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {donnees.lignes.map((l) => (
            <tr key={l.avant} role="row" className="group max-sm:mb-5 max-sm:block">
              <td
                role="cell"
                className="bg-sand/70 border-border-strong text-fg-soft sm:after:text-terracotta max-sm:after:text-terracotta relative rounded-2xl border border-dashed p-5 align-top max-sm:mb-8 max-sm:block max-sm:after:absolute max-sm:after:-bottom-8 max-sm:after:left-1/2 max-sm:after:-translate-x-1/2 max-sm:after:text-3xl max-sm:after:content-['↓'/''] sm:after:absolute sm:after:top-1/2 sm:after:-right-10 sm:after:-translate-y-1/2 sm:after:text-3xl sm:after:content-['→'/'']"
              >
                <span
                  aria-hidden="true"
                  className="text-fg-muted mb-1 block text-xs font-semibold tracking-[0.14em] uppercase sm:hidden"
                >
                  Avant
                </span>
                <span className="flex items-start gap-2.5">
                  <CircleAlert
                    aria-hidden="true"
                    className="text-fg-muted mt-0.5 size-[18px] shrink-0"
                  />
                  <span>{l.avant}</span>
                </span>
              </td>
              <td
                role="cell"
                className="bg-terracotta-soft border-terracotta/30 text-fg group-hover:bg-terracotta-deep group-hover:text-mocha-fg rounded-2xl border p-5 align-top font-medium motion-safe:transition-colors max-sm:block"
              >
                <span
                  aria-hidden="true"
                  className="text-terracotta-deep group-hover:text-mocha-fg mb-1 block text-xs font-semibold tracking-[0.14em] uppercase sm:hidden"
                >
                  Après
                </span>
                <span className="flex items-start gap-2.5">
                  <CircleCheck
                    aria-hidden="true"
                    className="text-terracotta-deep group-hover:text-mocha-fg mt-0.5 size-[18px] shrink-0"
                  />
                  <span>{l.apres}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-fg mt-10 max-w-3xl font-serif text-2xl leading-snug">{donnees.phrase}</p>
    </SectionFiche>
  );
}

/** Une transformation sans chamboulement : cinq tuiles sur fond foncé (halo terracotta seul). */
export function Rassurance({ donnees, entete, id = "rassurance" }: Props<"rassurance">) {
  return (
    <SectionFiche
      id={id}
      ton="fonce"
      entete={
        entete ?? {
          surTitre: "Sans chamboulement",
          question: donnees.titre,
          reponse: donnees.accroche,
        }
      }
    >
      <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {donnees.points.map((p, i) => {
          const cle = (p as { icone?: string }).icone;
          const Icone = (cle ? ICONES_RASSURANCE[cle] : undefined) ?? ORDRE_RASSURANCE[i % 5]!;
          return (
            <li
              key={p.titre}
              className="border-border-on-mocha bg-mocha-soft/50 rounded-2xl border p-6"
            >
              <Icone aria-hidden="true" className="text-terracotta-on-mocha size-7" />
              <h3 className="text-mocha-fg mt-4 text-lg font-semibold">{p.titre}</h3>
              <p className="text-mocha-fg mt-2 text-base leading-relaxed">{p.texte}</p>
            </li>
          );
        })}
      </ul>
    </SectionFiche>
  );
}

export interface ChiffreJournee {
  valeur: string;
  libelle: string;
}

/** La Journée IA : frise de la journée, chiffres réels et garantie injectée (jamais retapée). */
export function PorteEntree({
  donnees,
  entete,
  id = "journee-ia",
  moments,
  chiffres,
}: Props<"porteEntree"> & {
  moments?: ReadonlyArray<string>;
  chiffres?: ReadonlyArray<ChiffreJournee>;
}) {
  const etapes = donnees.points.map((p, i) => ({
    numero: String(i + 1),
    titre: p.titre,
    texte: p.texte,
    ...(moments?.[i] ? { moment: moments[i] } : {}),
  }));
  return (
    <SectionFiche
      id={id}
      ton="creme"
      entete={
        entete ?? {
          surTitre: "La Journée IA",
          question: donnees.titre,
          reponse: donnees.accroche,
        }
      }
    >
      <FriseEtapes etapes={etapes} ton="creme" />
      <p data-garantie="" className="text-fg mt-8 max-w-3xl text-lg leading-relaxed font-medium">
        {GARANTIE_PHRASE}
      </p>
      {chiffres && chiffres.length > 0 ? (
        <dl className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
          {chiffres.map((c) => (
            <div key={c.libelle}>
              <dt className="text-terracotta-deep font-serif text-3xl">{c.valeur}</dt>
              <dd className="text-fg-soft mt-1 text-base">{c.libelle}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Cta
          href="/appel"
          variant="terracotta"
          size="lg"
          track="equipe-journee-ia-appel"
          className="focus-visible:ring-terracotta"
        >
          {donnees.bouton}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
        <Link
          href={donnees.lien.href as never}
          className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          {donnees.lien.libelle}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </SectionFiche>
  );
}
