// Server Component — FAQ géolocalisée des pages services canoniques.
// Sprint 14.9 levier 4 (cf. mémoire `axionia_pseo_villes_pilote_paris_plan.md`).
//
// 4 questions par service pointant vers les pages /implantations.
// Émet une FAQPage Speakable JSON-LD distincte de la FAQ principale du
// service (Google merge plusieurs FAQPages OK, c'est documenté côté
// Search Central). Émet aussi des liens ancrés `/implantations/{region}`
// pour booster le maillage interne services ↔ régions.

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { FaqBlock } from "@/components/sections/FaqBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Cta } from "@/components/marketing/Cta";
import { buildFaqSpeakableJsonLd } from "@/lib/seo";

interface FaqGeoEntry {
  id: string;
  fr: { q: string; a: string };
  en: { q: string; a: string };
}

const FAQS_BY_SERVICE: Record<"audit" | "interventions" | "implementation", FaqGeoEntry[]> = {
  audit: [
    {
      id: "audit-paris",
      fr: {
        q: "Réalisez-vous des audits IA à Paris et en Île-de-France ?",
        a: "Oui — Paris (75) et toute l'Île-de-France sont nos pôles d'intervention prioritaires. Audit Flash 490 € HT, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €. Aucun frais de déplacement intra-Paris ni petite couronne.",
      },
      en: {
        q: "Do you run AI audits in Paris and Greater Paris?",
        a: "Yes — Paris (75) and all of Greater Paris are our priority engagement hubs. Flash audit €490, Targeted €1,900-3,900, SME Strategic €4,900-9,900, Mid-cap Strategic from €12,000. No travel fees within inner Paris and inner suburbs.",
      },
    },
    {
      id: "audit-metropoles",
      fr: {
        q: "Et dans les autres métropoles ? Lyon, Marseille, Toulouse, Bordeaux ?",
        a: "Toutes les métropoles régionales sont couvertes au tarif public, frais de déplacement inclus. Sélectionnez votre région sur la page Implantations pour voir le tissu B2B local et les éventuels cas clients à proximité.",
      },
      en: {
        q: "What about other metropolitan areas? Lyon, Marseille, Toulouse, Bordeaux?",
        a: "All regional metropolitan areas are covered at public pricing, travel fees included. Pick your region on the Locations page to see the local B2B fabric and any nearby case studies.",
      },
    },
    {
      id: "audit-province",
      fr: {
        q: "Intervenez-vous en province et dans les zones rurales ?",
        a: "Oui — toute commune française métropolitaine de plus de 5 000 habitants est éligible (~2 150 communes). Pour les communes plus petites ou cas particuliers, un devis sur mesure est possible. Les DROM ne sont pas couverts en V1.",
      },
      en: {
        q: "Do you cover provincial and rural areas?",
        a: "Yes — any French metropolitan commune with more than 5,000 inhabitants is eligible (~2,150 communes). For smaller communes or special cases, a custom quote is possible. Overseas regions are not covered in V1.",
      },
    },
    {
      id: "audit-distance",
      fr: {
        q: "Pouvez-vous réaliser l'audit à distance ou faut-il être sur site ?",
        a: "Les deux modalités sont possibles. L'audit Flash 490 € se réalise idéalement sur site (1 journée + 12 entretiens). Les audits Stratégiques peuvent combiner sur site (kick-off + restitution) et distance (analyse documentaire, entretiens). Vous choisissez selon votre contrainte.",
      },
      en: {
        q: "Can the audit be done remotely or does it require on-site presence?",
        a: "Both modes are possible. The Flash €490 audit is ideally on site (1 day + 12 interviews). Strategic audits can combine on-site (kick-off + readout) and remote (document analysis, interviews). You choose based on your constraints.",
      },
    },
  ],
  interventions: [
    {
      id: "interventions-paris",
      fr: {
        q: "Vos interventions IA sont-elles disponibles à Paris ?",
        a: "Oui — Paris (75) est notre premier pôle d'intervention. Format Essentielle 490 € HT (1 journée, jusqu'à 100 personnes), équipes, managers, conférence et dirigeants disponibles intra-muros et en première couronne. Frais de déplacement IDF inclus.",
      },
      en: {
        q: "Are your AI sessions available in Paris?",
        a: "Yes — Paris (75) is our top engagement hub. Essential €490 format (1 day, up to 100 people), teams, managers, talks and executive sessions available within Paris and inner suburbs. Greater-Paris travel included.",
      },
    },
    {
      id: "interventions-region",
      fr: {
        q: "Intervenez-vous dans toute la France métropolitaine ?",
        a: "Oui — 12 régions métropolitaines couvertes, plus de 2 150 communes éligibles. Notre cabinet est mobile, frais de déplacement intégrés au forfait pour les capitales régionales (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.).",
      },
      en: {
        q: "Do you cover all metropolitan France?",
        a: "Yes — 12 metropolitan regions covered, 2,150+ eligible communes. Our consultancy is mobile, travel fees included for regional capitals (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.).",
      },
    },
    {
      id: "interventions-formation",
      fr: {
        q: "Vos interventions sont-elles des formations IA ?",
        a: "Oui — chaque format intègre une dimension pédagogique : démos sur vos données réelles, cas concrets, méthode de prompting, hands-on outils IA. La différence avec un organisme de formation classique : nous vous laissons des outils opérationnels, pas seulement de la théorie. Pas de QPC ni Qualiopi V1 (à voir).",
      },
      en: {
        q: "Are your sessions AI training programs?",
        a: "Yes — every format includes a pedagogical dimension: demos on your real data, concrete cases, prompting methodology, hands-on AI tools. The difference with a classic training organization: we leave you operational tools, not just theory. No QPC nor Qualiopi V1 (TBD).",
      },
    },
    {
      id: "interventions-international",
      fr: {
        q: "Intervenez-vous à l'international ou seulement en France ?",
        a: "Pour les sièges français de groupes internationaux, oui systématiquement. Pour les filiales hors France (Belgique, Suisse, Luxembourg, Allemagne, etc.), c'est possible au cas par cas, devis sur mesure intégrant les frais de déplacement. Anglais opérationnel.",
      },
      en: {
        q: "Do you intervene internationally or only in France?",
        a: "For French headquarters of international groups, yes systematically. For non-French subsidiaries (Belgium, Switzerland, Luxembourg, Germany, etc.), it's possible case-by-case, with a custom quote including travel fees. Operational English.",
      },
    },
  ],
  implementation: [
    {
      id: "implementation-paris",
      fr: {
        q: "Implémentez-vous des solutions IA à Paris ?",
        a: "Oui — Paris (75) concentre la majorité de nos missions d'implémentation IA opérationnelle (lecture de factures, automatisation back-office, agents conversationnels, intégration CRM/ERP). Nos consultants sont mobiles dans toute l'Île-de-France, La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
      en: {
        q: "Do you deploy AI solutions in Paris?",
        a: "Yes — Paris (75) hosts the majority of our operational AI implementation missions (invoice reading, back-office automation, conversational agents, CRM/ERP integration). Our consultants are mobile across all of Greater Paris, La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
    },
    {
      id: "implementation-onsite",
      fr: {
        q: "L'implémentation IA peut-elle se faire à distance ou faut-il être sur site ?",
        a: "Hybride dans 90 % des cas : kick-off et déploiement initial sur site (3-5 jours), itérations à distance (4-8 semaines), recette finale sur site. Pour les cabinets et PME en région (Lyon, Bordeaux, Toulouse, Marseille...), nous nous déplaçons systématiquement aux jalons clés.",
      },
      en: {
        q: "Can AI implementation be done remotely or does it require on-site presence?",
        a: "Hybrid in 90% of cases: kick-off and initial deployment on site (3-5 days), remote iterations (4-8 weeks), final acceptance on site. For regional firms and SMEs (Lyon, Bordeaux, Toulouse, Marseille...), we systematically travel for key milestones.",
      },
    },
    {
      id: "implementation-coverage",
      fr: {
        q: "Quelles régions sont les plus actives en implémentation IA ?",
        a: "Île-de-France (sièges grands-comptes, scale-ups), Auvergne-Rhône-Alpes (industrie Lyon-Grenoble), Hauts-de-France (logistique Lille), Pays de la Loire (ETI familiales Nantes-Cholet), Occitanie (aéronautique Toulouse). Mais toute région métropolitaine est éligible — voir la couverture complète.",
      },
      en: {
        q: "Which regions are most active in AI implementation?",
        a: "Île-de-France (large-corp HQs, scale-ups), Auvergne-Rhône-Alpes (Lyon-Grenoble industry), Hauts-de-France (Lille logistics), Pays de la Loire (Nantes-Cholet family mid-caps), Occitanie (Toulouse aerospace). But every metropolitan region is eligible — see full coverage.",
      },
    },
    {
      id: "implementation-international",
      fr: {
        q: "Implémentez-vous chez des filiales internationales ?",
        a: "Pour les sièges français de groupes pilotant leurs filiales depuis Paris, oui — c'est même un de nos cas typiques. Pour des déploiements purement à l'étranger (Belgique, Suisse, Luxembourg, Allemagne...), un partenariat local est étudié au cas par cas. Pas de DROM en V1.",
      },
      en: {
        q: "Do you deploy at international subsidiaries?",
        a: "For French headquarters of groups steering their subsidiaries from Paris, yes — that's actually one of our typical cases. For purely abroad deployments (Belgium, Switzerland, Luxembourg, Germany...), local partnerships are studied case-by-case. No overseas regions in V1.",
      },
    },
  ],
};

export interface LocalGeoFaqSectionProps {
  isFr: boolean;
  service: "audit" | "interventions" | "implementation";
  /** Tone éditorial — `sand` par défaut (ivoire chaud). */
  tone?: "canvas" | "paper" | "sand";
}

export function LocalGeoFaqSection({
  isFr,
  service,
  tone = "sand",
}: LocalGeoFaqSectionProps): ReactNode {
  const entries = FAQS_BY_SERVICE[service];
  const items = entries.map((e) => ({
    id: e.id,
    question: isFr ? e.fr.q : e.en.q,
    answer: isFr ? e.fr.a : e.en.a,
  }));

  // FAQ Speakable JSON-LD émis séparément (FaqBlock interne désactivé via
  // emitJsonLd=false). Speakable activé pour Google Assistant + Alexa + Bixby.
  const speakableJsonLd = buildFaqSpeakableJsonLd({
    items: items.map((i) => ({ question: i.question, answer: i.answer })),
  });

  const titlePartFr = "Couverture géographique";
  const titleEmFr = "France & international";
  const titlePartEn = "Geographic coverage";
  const titleEmEn = "France & international";

  return (
    <>
      <JsonLd data={speakableJsonLd} />
      <FaqBlock
        eyebrow={isFr ? "FAQ géolocalisée" : "Geolocalized FAQ"}
        title={
          <>
            {isFr ? titlePartFr : titlePartEn}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? titleEmFr : titleEmEn}
            </span>
          </>
        }
        description={
          isFr
            ? "Questions fréquentes sur la couverture géographique de ce service. Pour explorer le tissu B2B local et nos cas concrets à proximité, consultez notre carte des implantations."
            : "Frequently asked questions about the geographic coverage of this service. To explore the local B2B fabric and our nearby case studies, visit our locations map."
        }
        items={items}
        emitJsonLd={false}
        tone={tone}
      />
      <div className="bg-bg pb-16 lg:pb-20">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 sm:px-6 lg:px-10">
          <Cta
            href="/implantations"
            variant="outline"
            size="lg"
            shape="pill"
            track={`${service}_geo_faq_hub`}
            data-source-target="/implantations"
          >
            {isFr ? "Voir la carte des implantations" : "See the locations map"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
        </div>
      </div>
    </>
  );
}
