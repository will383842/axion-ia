import {
  ArrowRight,
  Compass,
  GraduationCap,
  Sparkles,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ContenuFiche } from "@/lib/equipe";
import { SectionFiche, HALO_TERRACOTTA } from "./visuels/SectionFiche";
import type { EnteteProp } from "./BlocsTransformation";

/** Icônes des services, par clé (`icone`) ; à défaut, l'ordre des cartes. */
const ICONES_SERVICES: Record<string, LucideIcon> = {
  "mise-en-place": Wrench,
  automatisation: Workflow,
  formation: GraduationCap,
  coaching: Compass,
  transformation: Sparkles,
};
const ORDRE: ReadonlyArray<LucideIcon> = [Sparkles, Wrench, Workflow, GraduationCap, Compass];

type Service = NonNullable<ContenuFiche["services"]>["items"][number] & {
  icone?: string;
  enAvant?: boolean;
};

function Pictogramme({
  service,
  rang,
  className,
}: {
  service: Service;
  rang: number;
  className: string;
}) {
  const Icone =
    (service.icone ? ICONES_SERVICES[service.icone] : undefined) ?? ORDRE[rang % ORDRE.length]!;
  return <Icone aria-hidden="true" className={className} />;
}

function Liens({ liens, clair }: { liens: Service["liens"]; clair?: boolean }) {
  return (
    <p className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 pt-6">
      {liens.map((l) => (
        <Link
          key={l.href}
          href={l.href as never}
          className={`group inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 ${
            clair
              ? "text-mocha-fg focus-visible:outline-mocha-fg focus-visible:outline-2 focus-visible:outline-offset-2"
              : "text-terracotta hover:text-terracotta-deep focus-visible:outline-terracotta focus-visible:outline-2 focus-visible:outline-offset-2"
          }`}
        >
          {l.libelle}
          <ArrowRight
            className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      ))}
    </p>
  );
}

/** Services : le nom en H3, une carte mise en avant (la première), icônes, liens en bas. */
export function MetiersCollaborateur({
  donnees,
  entete,
  id = "services",
}: {
  donnees: NonNullable<ContenuFiche["services"]>;
  entete?: EnteteProp;
  id?: string;
}) {
  const items = [...(donnees.items as ReadonlyArray<Service>)];
  // Carte mise en avant : celle qui la demande (`enAvant`) ou la « transformation » ;
  // aucune des deux : aucune carte n'est mise en avant.
  const rang = items.findIndex((s) => s.enAvant || s.id === "transformation");
  const vedette = rang >= 0 ? items.splice(rang, 1)[0] : undefined;
  const autres = items;
  const grille =
    autres.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : autres.length === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";
  return (
    <SectionFiche
      id={id}
      ton="ivoire"
      entete={entete ?? { surTitre: "Services", question: donnees.titre, reponse: donnees.intro }}
    >
      <div className="grid gap-5">
        {vedette ? (
          <article
            id={vedette.id}
            data-service-vedette=""
            style={HALO_TERRACOTTA}
            className="bg-mocha text-mocha-fg flex flex-col rounded-2xl p-8 sm:p-10"
          >
            <Pictogramme service={vedette} rang={0} className="text-terracotta-on-mocha size-10" />
            <h3 className="mt-4 font-serif text-3xl leading-snug">{vedette.nom}</h3>
            <p className="text-mocha-fg mt-4 max-w-3xl text-lg leading-relaxed">{vedette.texte}</p>
            <Liens liens={vedette.liens} clair />
          </article>
        ) : null}
        {autres.length > 0 ? (
          <div className={`grid gap-5 ${grille}`}>
            {autres.map((s, i) => {
              return (
                <article
                  key={s.id}
                  id={s.id}
                  className="border-border bg-paper flex flex-col rounded-2xl border p-6"
                >
                  <span className="bg-terracotta-soft text-terracotta-deep flex size-11 items-center justify-center rounded-xl">
                    <Pictogramme service={s} rang={i + 1} className="size-5" />
                  </span>
                  <h3 className="text-fg mt-4 font-serif text-xl leading-snug">{s.nom}</h3>
                  <p className="text-fg-soft mt-3 text-base leading-relaxed">{s.texte}</p>
                  <Liens liens={s.liens} />
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </SectionFiche>
  );
}
