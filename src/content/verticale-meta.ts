/**
 * VERTICALE_META — Configuration éditoriale par verticale ville pour landing pages
 * visuellement riches (Sprint Quality 2026 perfection — Will 2026-05-25).
 *
 * Pour chaque verticale (interventions/audits/implementations/un-a-un/sites-web-ia) :
 *   - benefits : 4 cards visuels icon + chiffre + label (preuve sociale immédiate)
 *   - beforeAfter : 4 metrics comparatives "Avant / Après Axion-IA" (impact concret)
 *   - methodStepIcons : 1 lucide icon par étape methodology (visuel timeline)
 *   - heroIllustration : path d'illustration optionnelle (à droite du hero)
 *
 * Tous ces éléments sont HARDCODÉS au template (cohérence brand toutes villes),
 * complémentés par le contenu LLM unique par ville (whyHere/body/faq).
 */

import type { LucideIcon } from "lucide-react";
import {
  Clock,
  TrendingUp,
  Users,
  Target,
  Zap,
  Shield,
  CheckCircle2,
  Search,
  Settings,
  Code2,
  Globe,
  MessageSquare,
  GraduationCap,
  ClipboardCheck,
  Lightbulb,
  BarChart3,
  Rocket,
  Award,
  Heart,
  Handshake,
  Building2,
  FileSearch,
  Workflow,
  Sparkles,
} from "lucide-react";

const HandshakeIcon = Handshake;

export interface VerticaleBenefit {
  readonly icon: LucideIcon;
  readonly number: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

export interface VerticaleBeforeAfter {
  readonly labelFr: string;
  readonly labelEn: string;
  readonly before: string;
  readonly after: string;
}

export interface VerticaleMeta {
  readonly benefits: ReadonlyArray<VerticaleBenefit>;
  readonly beforeAfter: ReadonlyArray<VerticaleBeforeAfter>;
  readonly methodStepIcons: ReadonlyArray<LucideIcon>;
}

export type VerticaleSlug =
  | "interventions"
  | "audits"
  | "implementations"
  | "un-a-un"
  | "sites-web-ia";

export const VERTICALE_META: Record<VerticaleSlug, VerticaleMeta> = {
  interventions: {
    benefits: [
      {
        icon: GraduationCap,
        number: "Top 1 %",
        labelFr: "formateurs IA B2B France",
        labelEn: "AI B2B trainers in France",
      },
      {
        icon: Users,
        number: "5 à 50",
        labelFr: "collaborateurs par session",
        labelEn: "team members per session",
      },
      {
        icon: Clock,
        number: "½ à 2 j",
        labelFr: "format flexible sur site",
        labelEn: "flexible on-site format",
      },
      {
        icon: Zap,
        number: "Dès J+1",
        labelFr: "premier livrable opérationnel",
        labelEn: "first operational deliverable",
      },
    ],
    beforeAfter: [
      { labelFr: "Maîtrise IA équipe", labelEn: "Team AI mastery", before: "5 %", after: "85 %" },
      {
        labelFr: "Temps tâches admin",
        labelEn: "Admin task time",
        before: "8 h/sem",
        after: "2 h/sem",
      },
      { labelFr: "Outils IA utilisés", labelEn: "AI tools used", before: "0-1", after: "4-6" },
      {
        labelFr: "Autonomie post-formation",
        labelEn: "Post-training autonomy",
        before: "Faible",
        after: "Totale",
      },
    ],
    methodStepIcons: [ClipboardCheck, Lightbulb, GraduationCap, Rocket, CheckCircle2],
  },

  audits: {
    benefits: [
      {
        icon: Search,
        number: "4 h à 8 sem",
        labelFr: "périmètre adapté",
        labelEn: "adapted scope",
      },
      {
        icon: Target,
        number: "3",
        labelFr: "chantiers prioritaires chiffrés",
        labelEn: "costed priority projects",
      },
      {
        icon: Users,
        number: "100 %",
        labelFr: "entretiens collaborateurs métier",
        labelEn: "team member interviews",
      },
      {
        icon: Shield,
        number: "AI Act",
        labelFr: "conformité européenne incluse",
        labelEn: "EU compliance included",
      },
    ],
    beforeAfter: [
      {
        labelFr: "Vision processus IA",
        labelEn: "AI process vision",
        before: "Floue",
        after: "Cartographiée",
      },
      {
        labelFr: "Heures perdues/sem",
        labelEn: "Hours lost/week",
        before: "4-9 h",
        after: "0-2 h",
      },
      { labelFr: "Outils SaaS doublons", labelEn: "Duplicate SaaS", before: "6-12", after: "3-5" },
      {
        labelFr: "Plan d'action IA",
        labelEn: "AI action plan",
        before: "Aucun",
        after: "Roadmap chiffrée",
      },
    ],
    methodStepIcons: [ClipboardCheck, FileSearch, Lightbulb, BarChart3, Award],
  },

  implementations: {
    benefits: [
      {
        icon: Settings,
        number: "100 %",
        labelFr: "livré en production",
        labelEn: "delivered to production",
      },
      {
        icon: TrendingUp,
        number: "ROI < 30j",
        labelFr: "premier process rentable",
        labelEn: "first profitable process",
      },
      {
        icon: Zap,
        number: "Agents IA",
        labelFr: "sur mesure métier",
        labelEn: "custom business agents",
      },
      {
        icon: Shield,
        number: "90 jours",
        labelFr: "support post-livraison inclus",
        labelEn: "post-delivery support",
      },
    ],
    beforeAfter: [
      { labelFr: "Tâches automatisées", labelEn: "Automated tasks", before: "10 %", after: "80 %" },
      {
        labelFr: "Délai traitement",
        labelEn: "Processing time",
        before: "Jours",
        after: "Minutes",
      },
      { labelFr: "Saisie manuelle", labelEn: "Manual entry", before: "100 %", after: "0 %" },
      { labelFr: "Vendor lock-in", labelEn: "Vendor lock-in", before: "Élevé", after: "Zéro" },
    ],
    methodStepIcons: [ClipboardCheck, Lightbulb, Code2, Workflow, CheckCircle2],
  },

  "un-a-un": {
    benefits: [
      {
        icon: HandshakeIcon,
        number: "1-to-1",
        labelFr: "TPE dirigeants + cadres décisionnaires PME/ETI",
        labelEn: "Micro execs + decision-maker managers SMB/Mid",
      },
      {
        icon: Sparkles,
        number: "Sur mesure",
        labelFr: "adapté à votre poste et métier",
        labelEn: "tailored to your role and business",
      },
      {
        icon: Heart,
        number: "Confidentiel",
        labelFr: "discrétion absolue garantie",
        labelEn: "absolute discretion guaranteed",
      },
      {
        icon: Award,
        number: "Top 1 %",
        labelFr: "coachs IA seniors France",
        labelEn: "senior AI coaches France",
      },
    ],
    beforeAfter: [
      {
        labelFr: "Vision IA dirigeant",
        labelEn: "Executive AI vision",
        before: "Théorique",
        after: "Opérationnelle",
      },
      { labelFr: "Outils IA quotidien", labelEn: "Daily AI tools", before: "0", after: "5+" },
      {
        labelFr: "Décisions data-driven",
        labelEn: "Data-driven decisions",
        before: "Faible",
        after: "Standard",
      },
      {
        labelFr: "Confiance équipe IA",
        labelEn: "Team AI confidence",
        before: "Limitée",
        after: "Forte",
      },
    ],
    methodStepIcons: [HandshakeIcon, Lightbulb, MessageSquare, TrendingUp, Award],
  },

  "sites-web-ia": {
    benefits: [
      {
        icon: Globe,
        number: "Next.js",
        labelFr: "stack moderne IA-native",
        labelEn: "modern AI-native stack",
      },
      {
        icon: MessageSquare,
        number: "RAG",
        labelFr: "chatbots métier intégrés",
        labelEn: "integrated business chatbots",
      },
      {
        icon: Search,
        number: "Search IA",
        labelFr: "recherche sémantique",
        labelEn: "semantic search",
      },
      { icon: Shield, number: "RGPD UE", labelFr: "hébergement européen", labelEn: "EU hosting" },
    ],
    beforeAfter: [
      {
        labelFr: "Search interne site",
        labelEn: "Internal search",
        before: "Mots-clés",
        after: "Sémantique IA",
      },
      {
        labelFr: "Support client web",
        labelEn: "Web customer support",
        before: "Manuel",
        after: "Chatbot RAG",
      },
      {
        labelFr: "Personnalisation",
        labelEn: "Personalization",
        before: "Aucune",
        after: "IA temps réel",
      },
      {
        labelFr: "Conversion landing",
        labelEn: "Landing conversion",
        before: "Baseline",
        after: "+20 à +40 %",
      },
    ],
    methodStepIcons: [ClipboardCheck, Lightbulb, Code2, Building2, CheckCircle2],
  },
};
