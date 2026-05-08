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

// FAQ génériques services × géographie (Sprint 14.10.2 refonte) :
// — sans prix hardcodés (tarifs depuis pricing.ts via les pages services)
// — sans délais concrets (durées variables selon mission)
// — sans « frais inclus » (frais de déplacement facturés à part)
// — vocabulaire accessible, blocs courts.
const FAQS_BY_SERVICE: Record<"audit" | "interventions" | "implementation", FaqGeoEntry[]> = {
  audit: [
    {
      id: "audit-paris",
      fr: {
        q: "Réalisez-vous des audits IA à Paris et en Île-de-France ?",
        a: "Oui. Paris et toute l'Île-de-France font partie de nos premiers pôles d'intervention. Quatre niveaux d'audit sont disponibles selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Tarifs publics affichés sur la page Audit, sans surcoût géographique.",
      },
      en: {
        q: "Do you run AI audits in Paris and Greater Paris?",
        a: "Yes. Paris and all of Greater Paris are among our top engagement hubs. Four audit tiers are available based on your size (micro-business, SME, mid-cap, large enterprise) and scope. Public pricing on the Audit page, with no geographic surcharge.",
      },
    },
    {
      id: "audit-metropoles",
      fr: {
        q: "Et dans les autres métropoles ? Lyon, Marseille, Toulouse, Bordeaux ?",
        a: "Toutes les métropoles régionales sont couvertes au même tarif public que Paris. Sélectionnez votre région sur la page Implantations pour voir le tissu B2B local et les éventuels cas clients à proximité.",
      },
      en: {
        q: "What about other metropolitan areas? Lyon, Marseille, Toulouse, Bordeaux?",
        a: "All regional metropolitan areas are covered at the same public pricing as Paris. Pick your region on the Locations page to see the local B2B fabric and any nearby case studies.",
      },
    },
    {
      id: "audit-province",
      fr: {
        q: "Intervenez-vous en province et dans les zones rurales ?",
        a: "Oui. Toute commune française métropolitaine de plus de 5 000 habitants est éligible. Pour les communes plus petites ou les cas particuliers, un devis sur mesure est possible.",
      },
      en: {
        q: "Do you cover provincial and rural areas?",
        a: "Yes. Any French metropolitan commune with more than 5,000 inhabitants is eligible. For smaller communes or special cases, a custom quote is possible.",
      },
    },
    {
      id: "audit-distance",
      fr: {
        q: "Pouvez-vous réaliser l'audit à distance ou faut-il être sur site ?",
        a: "Les deux modalités sont possibles. Les audits courts se déroulent idéalement sur site, les audits stratégiques peuvent combiner site (kick-off + restitution) et distance (analyse documentaire, entretiens). Vous choisissez selon votre contrainte.",
      },
      en: {
        q: "Can the audit be done remotely or does it require on-site presence?",
        a: "Both modes are possible. Short audits ideally take place on site; strategic audits can combine on-site (kick-off + read-out) and remote (document analysis, interviews). You choose based on your constraints.",
      },
    },
  ],
  interventions: [
    {
      id: "interventions-paris",
      fr: {
        q: "Vos interventions IA sont-elles disponibles à Paris ?",
        a: "Oui. Paris est notre premier terrain d'intervention. Cinq formats sont disponibles, d'une journée à plusieurs semaines selon vos équipes : Essentielle, Équipes, Managers, Conférence, Dirigeants. Tous accessibles dans les arrondissements parisiens et la première couronne.",
      },
      en: {
        q: "Are your AI sessions available in Paris?",
        a: "Yes. Paris is our top engagement ground. Five formats are available, from one day to several weeks depending on your teams: Essential, Teams, Managers, Talk, Executives. All accessible in Paris arrondissements and inner suburbs.",
      },
    },
    {
      id: "interventions-region",
      fr: {
        q: "Intervenez-vous dans toute la France métropolitaine ?",
        a: "Oui. Douze régions métropolitaines couvertes, plus de 2 100 communes éligibles. Nos consultants sont mobiles : Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.",
      },
      en: {
        q: "Do you cover all metropolitan France?",
        a: "Yes. Twelve metropolitan regions covered, 2,100+ eligible communes. Our consultants are mobile: Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.",
      },
    },
    {
      id: "interventions-formation",
      fr: {
        q: "Vos interventions sont-elles des formations IA ?",
        a: "Chaque format intègre une dimension pédagogique : démos sur vos données réelles, cas concrets, méthode de prompting, prise en main des outils IA. La différence avec un organisme de formation classique : vos collaborateurs repartent avec des outils opérationnels installés et configurés sur leur poste, pas seulement de la théorie.",
      },
      en: {
        q: "Are your sessions AI training programs?",
        a: "Every format includes a pedagogical dimension: demos on your real data, concrete cases, prompting methodology, hands-on AI tools. The difference with a classic training organization: your staff leave with operational tools installed and configured on their workstations, not just theory.",
      },
    },
    {
      id: "interventions-international",
      fr: {
        q: "Intervenez-vous à l'international ou seulement en France ?",
        a: "Pour les sièges français de groupes internationaux, oui systématiquement. Pour les filiales hors France (Belgique, Suisse, Luxembourg, Allemagne, etc.), c'est possible au cas par cas avec un devis sur mesure. Anglais opérationnel.",
      },
      en: {
        q: "Do you intervene internationally or only in France?",
        a: "For French headquarters of international groups, yes systematically. For non-French subsidiaries (Belgium, Switzerland, Luxembourg, Germany, etc.), it's possible case-by-case with a custom quote. Operational English.",
      },
    },
  ],
  implementation: [
    {
      id: "implementation-paris",
      fr: {
        q: "Implémentez-vous des solutions IA à Paris ?",
        a: "Oui. Paris concentre une part importante de nos missions d'implémentation IA opérationnelle : lecture de factures, automatisation back-office, agents conversationnels, intégration CRM/ERP. Nos consultants sont mobiles dans toute l'Île-de-France, La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
      en: {
        q: "Do you deploy AI solutions in Paris?",
        a: "Yes. Paris hosts a significant share of our operational AI implementation missions: invoice reading, back-office automation, conversational agents, CRM/ERP integration. Our consultants are mobile across all of Greater Paris, La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
    },
    {
      id: "implementation-onsite",
      fr: {
        q: "L'implémentation IA peut-elle se faire à distance ou faut-il être sur site ?",
        a: "Hybride dans la majorité des cas : kick-off et déploiement initial sur site, itérations à distance, recette finale sur site. Pour les cabinets et PME en région, nous nous déplaçons systématiquement aux jalons clés.",
      },
      en: {
        q: "Can AI implementation be done remotely or does it require on-site presence?",
        a: "Hybrid in most cases: on-site kick-off and initial deployment, remote iterations, on-site final acceptance. For regional firms and SMEs, we systematically travel for key milestones.",
      },
    },
    {
      id: "implementation-coverage",
      fr: {
        q: "Quelles régions sont les plus actives en implémentation IA ?",
        a: "Île-de-France (sièges grandes entreprises, scale-ups), Auvergne-Rhône-Alpes (industrie Lyon-Grenoble), Hauts-de-France (logistique Lille), Pays de la Loire (ETI familiales Nantes-Cholet), Occitanie (aéronautique Toulouse). Toute région métropolitaine reste éligible.",
      },
      en: {
        q: "Which regions are most active in AI implementation?",
        a: "Île-de-France (large-enterprise HQs, scale-ups), Auvergne-Rhône-Alpes (Lyon-Grenoble industry), Hauts-de-France (Lille logistics), Pays de la Loire (Nantes-Cholet family mid-caps), Occitanie (Toulouse aerospace). Every metropolitan region remains eligible.",
      },
    },
    {
      id: "implementation-international",
      fr: {
        q: "Implémentez-vous chez des filiales internationales ?",
        a: "Pour les sièges français de groupes pilotant leurs filiales depuis Paris, oui — c'est un de nos cas typiques. Pour des déploiements purement à l'étranger, un partenariat local est étudié au cas par cas.",
      },
      en: {
        q: "Do you deploy at international subsidiaries?",
        a: "For French headquarters of groups steering their subsidiaries from Paris, yes — it's one of our typical cases. For purely abroad deployments, local partnerships are studied case-by-case.",
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
