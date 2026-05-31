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
  // Titres en voix « on » (Axion-IA) et descriptions librement reformulées —
  // volontairement distincts des intitulés génériques du marché (anti-plagiat).
  const steps: ReadonlyArray<Step> = [
    {
      n: "01",
      icon: Compass,
      title: isFr ? "On cadre la mission avec vous" : "We scope the mission with you",
      desc: isFr
        ? "Premier temps fort avec vos dirigeants : on s'imprègne de votre activité, de votre organisation et de vos contraintes, puis on aligne précisément ce que l'audit doit vous apporter. Ensemble, on choisit les processus prioritaires — ceux où l'IA peut vraiment peser. Le tout sous NDA."
        : "First key moment with your leadership: we soak up your business, your organisation and your constraints, then pin down exactly what the audit must deliver. Together we pick the priority processes — those where AI can truly move the needle. All under NDA.",
      deliverable: isFr ? "Périmètre & objectifs validés" : "Scope & objectives validated",
    },
    {
      n: "02",
      icon: Users,
      title: isFr ? "On va sur le terrain" : "We go into the field",
      desc: isFr
        ? "On rencontre les directions et les collaborateurs qui font tourner l'entreprise, chez vous ou en visio. On regarde comment ça se passe vraiment : gestes métier, irritants du quotidien, outils réellement utilisés. De quoi obtenir une photo fidèle et partagée, loin des slides."
        : "We meet the managers and the people who run the company day to day, on site or by video. We watch how things really work: hands-on tasks, daily irritants, the tools actually used — for a faithful, shared picture, far from slideware.",
      deliverable: isFr ? "Cartographie des usages & frictions" : "Map of uses & friction points",
    },
    {
      n: "03",
      icon: Search,
      title: isFr ? "On consolide et on analyse" : "We consolidate and analyse",
      desc: isFr
        ? "On prend de la hauteur sur la matière collectée : panorama des technologies du moment, comparaison avec ce qui marche ailleurs, étude de situations proches de la vôtre. On en sort une série de pistes solides, réalistes au regard de vos contraintes métier et techniques."
        : "We step back from the collected material: a scan of today's technologies, comparison with what works elsewhere, study of situations close to yours. Out comes a set of solid leads, realistic against your business and technical constraints.",
      deliverable: isFr ? "Pistes IA qualifiées" : "Qualified AI leads",
    },
    {
      n: "04",
      icon: ListFilter,
      title: isFr ? "On filtre les options" : "We filter the options",
      desc: isFr
        ? "Chaque piste passe le test du réel : ce qu'elle exige, ses limites, ses risques. On garde celles qui combinent impact fort et faisabilité, on écarte sans détour ce qui est trop lourd, trop cher ou hors-sujet. Résultat : une short-list resserrée et défendable."
        : "Every lead faces the reality test: what it requires, its limits, its risks. We keep those that pair strong impact with feasibility, and bluntly drop what is too heavy, too costly or off-topic. The result: a tight, defensible shortlist.",
      deliverable: isFr ? "Short-list priorisée" : "Prioritised shortlist",
    },
    {
      n: "05",
      icon: Scale,
      title: isFr ? "On évalue et on chiffre" : "We assess and we cost",
      desc: isFr
        ? "Pour les finalistes, on entre dans le concret : faisabilité technique, performance attendue, coûts, valeur pour chaque service concerné. On vous remet des recommandations comparables et argumentées, avec un ordre de grandeur de ROI et les conditions à réunir pour réussir."
        : "For the finalists, we get concrete: technical feasibility, expected performance, costs, value for each department involved. You get comparable, argued recommendations, with a ballpark ROI and the conditions to meet for success.",
      deliverable: isFr ? "Recommandations chiffrées (ROI)" : "Costed recommendations (ROI)",
    },
    {
      n: "06",
      icon: MapIcon,
      title: isFr ? "On restitue et on trace la route" : "We report and map the route",
      desc: isFr
        ? "Place aux livrables : un rapport structuré (ce qu'on a vu, nos hypothèses, les risques, nos recommandations) et une cartographie des opportunités IA service par service, outils et technos conseillés à l'appui. Puis une feuille de route limpide : par quoi commencer, quand, avec quelles ressources."
        : "Now the deliverables: a structured report (what we saw, our assumptions, the risks, our recommendations) and a department-by-department map of AI opportunities, with suggested tools and tech. Then a crisp roadmap: where to start, when, with which resources.",
      deliverable: isFr
        ? "Rapport + cartographie + roadmap priorisée"
        : "Report + map + prioritised roadmap",
    },
    {
      n: "07",
      icon: Rocket,
      title: isFr ? "On met en œuvre, par étapes" : "We implement, step by step",
      desc: isFr
        ? "Si vous le voulez, on ne s'arrête pas au PDF : la même équipe construit. On déploie les solutions par paliers, dans l'ordre des priorités, en s'intégrant à vos outils existants — sans tout casser, en visant des résultats utiles dès les premières semaines."
        : "If you want, we don't stop at the PDF: the same team builds. We roll out solutions in stages, in priority order, fitting into your existing tools — no big bang, aiming for useful results within the first weeks.",
      deliverable: isFr ? "Solutions intégrées, par priorité" : "Solutions integrated, by priority",
    },
    {
      n: "08",
      icon: TrendingUp,
      title: isFr ? "On ancre dans la durée" : "We anchor it for the long run",
      desc: isFr
        ? "Une techno adoptée vaut mieux qu'une techno déployée : on forme vos équipes et on accompagne le changement. On pose une gouvernance et une trajectoire à 3 ans — rôles, principes, KPIs — pour mesurer la valeur, ajuster en continu et préparer la suite."
        : "An adopted technology beats a deployed one: we train your teams and support the change. We set up governance and a 3-year trajectory — roles, principles, KPIs — to measure value, adjust continuously and prepare what comes next.",
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

      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-2xl p-6 sm:p-8">
        <div className="pr-10">
          <p className="text-terracotta-deep mb-2 text-[12px] font-bold tracking-[0.18em] uppercase">
            {isFr ? "Notre méthodologie d'audit" : "Our audit methodology"}
          </p>
          <DialogTitle
            className="text-fg text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Un audit IA rigoureux, " : "A rigorous AI audit, "}
            <span className="text-terracotta italic">{isFr ? "en 8 étapes" : "in 8 steps"}</span>
          </DialogTitle>
          <DialogDescription className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
            {isFr
              ? "Du cadrage terrain à l'adoption dans la durée — voici exactement ce qu'il se passe à chaque étape, et ce que vous obtenez à la clé."
              : "From field scoping to lasting adoption — here is exactly what happens at each step, and what you get."}
          </DialogDescription>
        </div>

        {/* Grille 2 colonnes de cartes visuelles */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.n}
                className="bg-paper border-border shadow-subtle hover:border-terracotta/50 relative overflow-hidden rounded-2xl border p-5 transition-colors"
              >
                {/* Filigrane numéro */}
                <span
                  aria-hidden="true"
                  className="text-terracotta/10 absolute -top-5 -right-1 text-[5.5rem] leading-none font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.n}
                </span>
                <div className="relative">
                  <span className="bg-terracotta text-mocha-fg mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-fg text-[16px] leading-snug font-semibold tracking-tight">
                    <span className="text-terracotta-deep tabular-nums">{s.n}.</span> {s.title}
                  </h3>
                  <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">{s.desc}</p>
                  <p className="text-terracotta-deep bg-terracotta-soft/50 mt-3.5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {s.deliverable}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
