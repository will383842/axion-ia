"use client";
// use-client: Radix Dialog (popup méthodologie) — refs navigateur + portal + focus-trap.

import type { ReactNode } from "react";
import {
  ArrowRight,
  Compass,
  Users,
  Search,
  ListFilter,
  Scale,
  Map as MapIcon,
  Rocket,
  TrendingUp,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  readonly n: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly desc: string;
  readonly deliverable: string;
}

export interface AuditMethodologyDialogProps {
  readonly isFr: boolean;
}

export function AuditMethodologyDialog({ isFr }: AuditMethodologyDialogProps): ReactNode {
  const steps: ReadonlyArray<Step> = [
    {
      n: "01",
      icon: Compass,
      title: isFr ? "Cadrage de la mission et des objectifs" : "Mission and objectives scoping",
      desc: isFr
        ? "On démarre par un cadrage précis avec vos dirigeants : contexte de l'entreprise, organisation, clients, fournisseurs et contraintes métier. On aligne les objectifs, on clarifie les attentes et on définit ensemble un périmètre réaliste — les processus à analyser en priorité selon leur potentiel de valeur. Échanges sécurisés par NDA."
        : "We start with precise scoping with your leadership: company context, organisation, clients, suppliers and business constraints. We align objectives, clarify expectations and define a realistic scope together — the processes to analyse first by value potential. Exchanges secured by NDA.",
      deliverable: isFr ? "Périmètre & objectifs validés" : "Scope & objectives validated",
    },
    {
      n: "02",
      icon: Users,
      title: isFr ? "Entretiens métier et qualification" : "Business interviews and qualification",
      desc: isFr
        ? "Entretiens ciblés avec les directions et les collaborateurs concernés, dans vos locaux ou à distance. On comprend les pratiques actuelles, les contraintes opérationnelles et les points de friction concrets, en s'appuyant sur vos process, vos tâches clés et vos outils en place. Une base factuelle et partagée, avant toute recommandation."
        : "Targeted interviews with the departments and people involved, on site or remotely. We grasp current practices, operational constraints and concrete friction points, drawing on your processes, key tasks and existing tools. A factual, shared baseline before any recommendation.",
      deliverable: isFr ? "Cartographie des usages & frictions" : "Map of uses & friction points",
    },
    {
      n: "03",
      icon: Search,
      title: isFr ? "Consolidation et analyse approfondie" : "Consolidation and deep analysis",
      desc: isFr
        ? "À partir du terrain, on mène une recherche approfondie : veille structurée sur les technologies disponibles, retours d'expérience comparables, analyse de cas d'usage proches dans votre secteur. On fait émerger des pistes crédibles, réalistes et adaptées à vos contraintes métier et techniques."
        : "From the field, we run thorough research: structured tech scanning, comparable feedback, analysis of similar use cases in your sector. We surface credible, realistic leads fit to your business and technical constraints.",
      deliverable: isFr ? "Pistes IA qualifiées" : "Qualified AI leads",
    },
    {
      n: "04",
      icon: ListFilter,
      title: isFr
        ? "Pré-évaluation et filtrage des options"
        : "Pre-assessment and option filtering",
      desc: isFr
        ? "Chaque piste est confrontée à la réalité du terrain : limites, contraintes spécifiques, risques de mise en œuvre. On priorise selon l'impact potentiel et la faisabilité, on écarte rapidement ce qui est trop complexe, trop coûteux ou peu adapté, et on aboutit à une sélection restreinte d'options à fort potentiel."
        : "Each lead is tested against reality: limits, specific constraints, implementation risks. We prioritise by potential impact and feasibility, quickly drop what is too complex, too costly or poorly suited, and reach a shortlist of high-potential options.",
      deliverable: isFr ? "Short-list priorisée" : "Prioritised shortlist",
    },
    {
      n: "05",
      icon: Scale,
      title: isFr ? "Évaluation et recommandations" : "Evaluation and recommendations",
      desc: isFr
        ? "Les options retenues sont évaluées en détail : faisabilité technique et opérationnelle, performances attendues, coûts associés et valeur ajoutée pour chaque département concerné. On formule des recommandations claires, argumentées et comparables, avec une estimation du retour sur investissement et des conditions de succès."
        : "Shortlisted options are evaluated in detail: technical and operational feasibility, expected performance, costs and added value per department. We deliver clear, argued, comparable recommendations, with an ROI estimate and success conditions.",
      deliverable: isFr ? "Recommandations chiffrées (ROI)" : "Costed recommendations (ROI)",
    },
    {
      n: "06",
      icon: MapIcon,
      title: isFr ? "Restitution et feuille de route IA" : "Read-out and AI roadmap",
      desc: isFr
        ? "L'audit débouche sur des livrables directement exploitables : un rapport structuré (constats, hypothèses, risques, recommandations) et une cartographie des opportunités IA présentées par département, avec préconisations d'outils et de technologies. On formalise une feuille de route claire — priorités, calendrier, ressources et premières actions à engager."
        : "The audit yields directly usable deliverables: a structured report (findings, assumptions, risks, recommendations) and a per-department map of AI opportunities, with tool and technology guidance. We formalise a clear roadmap — priorities, timeline, resources and first actions to launch.",
      deliverable: isFr
        ? "Rapport + cartographie + roadmap priorisée"
        : "Report + map + prioritised roadmap",
    },
    {
      n: "07",
      icon: Rocket,
      title: isFr ? "Mise en œuvre des recommandations" : "Implementing the recommendations",
      desc: isFr
        ? "Si vous le souhaitez, la même équipe transforme les recommandations en réalisations concrètes. Les solutions sont conçues et intégrées progressivement, selon les priorités identifiées, dans vos outils et vos produits existants — sans big bang, avec un focus sur l'efficacité opérationnelle."
        : "If you wish, the same team turns the recommendations into concrete results. Solutions are designed and integrated step by step, by identified priority, into your existing tools and products — no big bang, with a focus on operational efficiency.",
      deliverable: isFr ? "Solutions intégrées, par priorité" : "Solutions integrated, by priority",
    },
    {
      n: "08",
      icon: TrendingUp,
      title: isFr
        ? "Adoption, formation et pilotage dans la durée"
        : "Adoption, training and long-term steering",
      desc: isFr
        ? "On embarque vos collaborateurs par la formation et l'accompagnement au changement, pour une adoption réelle et pas seulement des outils déployés. Un plan de gouvernance et une trajectoire à 3 ans — principes, organisation et KPIs — pilotent la valeur créée, mesurent les résultats et préparent les prochaines étapes."
        : "We bring your teams on board through training and change support, for real adoption — not just deployed tools. A governance plan and a 3-year trajectory — principles, organisation and KPIs — steer the value created, measure results and prepare the next steps.",
      deliverable: isFr
        ? "Adoption, KPIs & trajectoire 3 ans"
        : "Adoption, KPIs & 3-year trajectory",
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="terracotta" size="lg" shape="pill" data-cta="audit-methodology-open">
          {isFr ? "Voir la méthodologie détaillée" : "See the detailed methodology"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogTitle
          className="text-fg pr-10 text-[clamp(1.4rem,3vw,2rem)] leading-tight font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? "Un audit IA rigoureux, " : "A rigorous AI audit, "}
          <span className="text-terracotta italic">{isFr ? "en 8 étapes" : "in 8 steps"}</span>
        </DialogTitle>
        <DialogDescription className="text-fg-soft text-[14.5px] leading-relaxed">
          {isFr
            ? "Du cadrage terrain à l'adoption dans la durée — voici exactement ce qu'il se passe à chaque étape, et ce que vous obtenez."
            : "From field scoping to lasting adoption — here is exactly what happens at each step, and what you get."}
        </DialogDescription>

        <ol className="mt-2 list-none p-0">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const last = i === steps.length - 1;
            return (
              <li key={s.n} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                {/* Rail : nœud numéroté + connecteur vertical */}
                <div className="flex flex-col items-center">
                  <div className="bg-terracotta text-mocha-fg flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                    <span
                      className="text-[15px] font-bold tabular-nums"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {s.n}
                    </span>
                  </div>
                  {!last ? (
                    <span
                      aria-hidden="true"
                      className="bg-terracotta/25 my-1.5 w-0.5 flex-1 rounded-full"
                    />
                  ) : null}
                </div>

                {/* Contenu */}
                <div className={cn("pb-7", last && "pb-0")}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span className="bg-terracotta-soft text-terracotta-deep flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-fg text-[15.5px] leading-snug font-semibold tracking-tight">
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-fg-soft text-[13.5px] leading-relaxed">{s.desc}</p>
                  <p className="text-terracotta-deep bg-terracotta-soft/50 mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {s.deliverable}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
