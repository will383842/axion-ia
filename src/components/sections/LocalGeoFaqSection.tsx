// Server Component — FAQ géolocalisée des pages services canoniques.
// Sprint 14.9 levier 4 (cf. mémoire `axionia_pseo_villes_pilote_paris_plan.md`).
//
// 4 questions par service pointant vers les pages /implantations.
// ⚠️ Google n'accepte QU'UNE seule FAQPage par URL — deux blocs FAQPage sur la
// même page = erreur « Champ FAQPage en double » (GSC 2026-06). L'ancienne
// croyance « Google merge plusieurs FAQPages » est fausse depuis la validation
// stricte 2026. Sur une page qui émet DÉJÀ une FAQPage (ex. `SitesWebFaq` via
// `FaqAccordion`), passer `emitJsonLd={false}` ici — la FAQ géo reste rendue
// visuellement, sans second JSON-LD. Émet aussi des liens ancrés
// `/implantations/{region}` pour le maillage interne services ↔ régions.

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
// — sans « frais inclus » (aucune mention de frais : CGV uniquement)
// — vocabulaire accessible, blocs courts.
const FAQS_BY_SERVICE: Record<
  "audit" | "interventions" | "implementation" | "sites-web-augmentes" | "un-a-un",
  FaqGeoEntry[]
> = {
  audit: [
    {
      id: "audit-paris",
      fr: {
        q: "Réalisez-vous des audits IA à Paris et en Île-de-France ?",
        a: "Oui. Nous intervenons à Paris et dans toute l'Île-de-France, dans vos locaux. Quatre niveaux d'audit sont disponibles selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre, sur devis.",
      },
      en: {
        q: "Do you run AI audits in Paris and Greater Paris?",
        a: "Yes. We work in Paris and across Greater Paris, at your premises. Four audit tiers are available based on your size (micro-business, SME, mid-cap, large enterprise) and scope, on quote.",
      },
    },
    {
      id: "audit-metropoles",
      fr: {
        q: "Et dans les autres métropoles ? Lyon, Marseille, Toulouse, Bordeaux ?",
        a: "Nous intervenons dans toutes les métropoles régionales, dans vos locaux. Sélectionnez votre région sur la page Implantations pour voir le tissu B2B local.",
      },
      en: {
        q: "What about other metropolitan areas? Lyon, Marseille, Toulouse, Bordeaux?",
        a: "We work in all the large regional cities, at your premises. Pick your region on the Locations page to see the local B2B fabric.",
      },
    },
    {
      id: "audit-province",
      fr: {
        q: "Intervenez-vous en province et dans les zones rurales ?",
        a: "Oui, partout en France. Pour un cas particulier, un devis sur mesure est possible.",
      },
      en: {
        q: "Do you cover provincial and rural areas?",
        a: "Yes, anywhere in France. For a special case, a custom quote is possible.",
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
        a: "Oui, nous intervenons à Paris. Cinq formats sont disponibles, d'une journée à plusieurs semaines selon vos équipes : formation collective, Équipes, Managers, Conférence, Dirigeants. Tous réalisables dans vos locaux, à Paris comme en première couronne.",
      },
      en: {
        q: "Are your AI sessions available in Paris?",
        a: "Yes, we work in Paris. Five formats are available, from one day to several weeks depending on your teams: group training, Teams, Managers, Talk, Executives. All can be run at your premises, in Paris and the inner suburbs.",
      },
    },
    {
      id: "interventions-region",
      fr: {
        q: "Intervenez-vous dans toute la France métropolitaine ?",
        a: "Oui, partout en France, dans vos locaux : Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.",
      },
      en: {
        q: "Do you cover all metropolitan France?",
        a: "Yes, anywhere in France, at your premises: Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, etc.",
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
        a: "Pour les sièges français de groupes internationaux, oui, sur devis. Pour les filiales hors France (Belgique, Suisse, Luxembourg, Allemagne, etc.), c'est possible au cas par cas avec un devis sur mesure. Anglais possible.",
      },
      en: {
        q: "Do you intervene internationally or only in France?",
        a: "For French headquarters of international groups, yes, on quote. For non-French subsidiaries (Belgium, Switzerland, Luxembourg, Germany, etc.), it's possible case-by-case with a custom quote. English is possible.",
      },
    },
  ],
  implementation: [
    {
      id: "implementation-paris",
      fr: {
        q: "Implémentez-vous des solutions IA à Paris ?",
        a: "Oui. Nous menons des missions d'implémentation IA opérationnelle à Paris : lecture de factures, automatisation back-office, agents conversationnels, intégration CRM/ERP. Nous intervenons dans toute l'Île-de-France : La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
      en: {
        q: "Do you deploy AI solutions in Paris?",
        a: "Yes. We run operational AI implementation missions in Paris: invoice reading, back-office automation, conversational agents, CRM/ERP integration. We work across Greater Paris: La Défense, Issy, Boulogne, Levallois, Neuilly.",
      },
    },
    {
      id: "implementation-onsite",
      fr: {
        q: "L'implémentation IA peut-elle se faire à distance ou faut-il être sur site ?",
        a: "Hybride dans la majorité des cas : kick-off et déploiement initial sur site, itérations à distance, recette finale sur site. Pour les cabinets et PME en région, des jalons clés sur site sont possibles.",
      },
      en: {
        q: "Can AI implementation be done remotely or does it require on-site presence?",
        a: "Hybrid in most cases: on-site kick-off and initial deployment, remote iterations, on-site final acceptance. For regional firms and SMEs, key milestones on site are possible.",
      },
    },
    {
      id: "implementation-coverage",
      fr: {
        q: "Quelles régions sont les plus actives en implémentation IA ?",
        a: "Île-de-France (sièges grandes entreprises, scale-ups), Auvergne-Rhône-Alpes (industrie lyonnaise), Hauts-de-France (logistique Lille), Pays de la Loire (ETI familiales Nantes-Cholet), Occitanie (aéronautique Toulouse). Toute région métropolitaine reste éligible.",
      },
      en: {
        q: "Which regions are most active in AI implementation?",
        a: "Île-de-France (large-enterprise HQs, scale-ups), Auvergne-Rhône-Alpes (Lyon industry), Hauts-de-France (Lille logistics), Pays de la Loire (Nantes-Cholet family mid-caps), Occitanie (Toulouse aerospace). Every metropolitan region remains eligible.",
      },
    },
    {
      id: "implementation-international",
      fr: {
        q: "Implémentez-vous chez des filiales internationales ?",
        a: "Pour les sièges français de groupes pilotant leurs filiales depuis Paris, oui : oui, sur devis. Pour des déploiements purement à l'étranger, c'est étudié au cas par cas, sur devis.",
      },
      en: {
        q: "Do you deploy at international subsidiaries?",
        a: "For French headquarters of groups steering their subsidiaries from Paris, yes : yes, on quote. For purely abroad deployments, it is studied case by case, on quote.",
      },
    },
  ],
  "sites-web-augmentes": [
    {
      id: "codage-paris",
      fr: {
        q: "Développez-vous des plateformes IA à Paris et en Île-de-France ?",
        a: "Oui, nous développons pour des entreprises de Paris et de toute l'Île-de-France. Nous intervenons aussi bien pour des startups que pour des TPE, PME et ETI. Les projets se déroulent en mode hybride : kick-off et démos sur site, développement en sprint à distance.",
      },
      en: {
        q: "Do you build AI platforms in Paris and Greater Paris?",
        a: "Yes, we build for companies in Paris and across Greater Paris. We work with startups as well as SMEs and mid-caps. Projects run in hybrid mode: on-site kick-off and demos, remote sprint development.",
      },
    },
    {
      id: "codage-regions",
      fr: {
        q: "Travaillez-vous avec des entreprises hors d'Île-de-France ?",
        a: "Oui, partout en France métropolitaine. Le développement se fait principalement à distance (code, revues, démos en visio), avec des déplacements sur site pour le kick-off et la livraison.",
      },
      en: {
        q: "Do you work with companies outside Greater Paris?",
        a: "Yes, anywhere in mainland France. Development is primarily remote (code, reviews, video demos), with on-site travel for kick-off and delivery.",
      },
    },
    {
      id: "codage-remote",
      fr: {
        q: "Le développement peut-il se faire entièrement à distance ?",
        a: "Oui. Le développement peut être conduit en mode full-remote avec des sprints de 1 à 2 semaines et des démos hebdomadaires en visio. Un kick-off sur site est recommandé mais non obligatoire.",
      },
      en: {
        q: "Can the development be done entirely remotely?",
        a: "Yes. Development can run full-remote with 1 to 2-week sprints and weekly video demos. An on-site kick-off is recommended but not mandatory.",
      },
    },
    {
      id: "codage-coverage",
      fr: {
        q: "Quelles régions sont les plus actives pour le développement de plateformes IA ?",
        a: "Île-de-France (sièges et scale-ups), Auvergne-Rhône-Alpes (industrie tech Lyon), Occitanie (SaaS Toulouse), Bretagne (industrie navale et agri-tech), Pays de la Loire (ETI Nantes). Nous intervenons dans toutes les régions, sur devis.",
      },
      en: {
        q: "Which regions are most active for AI platform development?",
        a: "Île-de-France (HQs and scale-ups), Auvergne-Rhône-Alpes (Lyon tech industry), Occitanie (Toulouse SaaS), Brittany (naval and agri-tech), Pays de la Loire (Nantes mid-caps). We work in every region, on quote.",
      },
    },
  ],
  "un-a-un": [
    {
      id: "unauun-paris",
      fr: {
        q: "L'accompagnement 1-to-1 est-il disponible à Paris ?",
        a: "Oui, à Paris comme ailleurs. Les séances peuvent se dérouler sur site chez vous ou à distance selon votre préférence.",
      },
      en: {
        q: "Is the 1-to-1 coaching available in Paris?",
        a: "Yes, in Paris as elsewhere. Sessions can take place at your offices or remotely, according to your preference.",
      },
    },
    {
      id: "unauun-regions",
      fr: {
        q: "L'accompagnement 1-to-1 est-il disponible en régions ?",
        a: "Oui, partout en France métropolitaine. Les séances régulières sont conduites à distance ; des séances intensives sur site sont possibles dans toutes les régions, sur devis.",
      },
      en: {
        q: "Is 1-to-1 coaching available in regional areas?",
        a: "Yes, across mainland France. Regular sessions are conducted remotely; intensive on-site sessions are possible in all regions, on quote.",
      },
    },
    {
      id: "unauun-remote",
      fr: {
        q: "Les séances peuvent-elles se faire entièrement à distance ?",
        a: "Oui. Les accompagnements 1-to-1 peuvent se faire en visio. Cela permet une flexibilité maximale pour les dirigeants avec un agenda chargé.",
      },
      en: {
        q: "Can sessions be conducted entirely remotely?",
        a: "Yes. 1-to-1 coaching can be conducted by video. This allows maximum flexibility for busy executives.",
      },
    },
    {
      id: "unauun-international",
      fr: {
        q: "Accompagnez-vous des dirigeants basés à l'étranger ?",
        a: "Oui, pour des dirigeants de filiales françaises basés hors de France ou des entrepreneurs francophones en Europe. Les séances à distance effacent les frontières géographiques.",
      },
      en: {
        q: "Do you coach executives based abroad?",
        a: "Yes, for directors of French subsidiaries based outside France or francophone entrepreneurs in Europe. Remote sessions erase geographic boundaries.",
      },
    },
  ],
};

export interface LocalGeoFaqSectionProps {
  isFr: boolean;
  service: "audit" | "interventions" | "implementation" | "sites-web-augmentes" | "un-a-un";
  /** Tone éditorial — `sand` par défaut (ivoire chaud). */
  tone?: "canvas" | "paper" | "sand";
  /**
   * Émettre la FAQPage Speakable JSON-LD. Mettre `false` sur une page qui émet
   * déjà sa propre FAQPage (sinon « Champ FAQPage en double » dans GSC).
   * Default : true.
   */
  emitJsonLd?: boolean;
}

export function LocalGeoFaqSection({
  isFr,
  service,
  tone = "sand",
  emitJsonLd = true,
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
      {emitJsonLd ? <JsonLd data={speakableJsonLd} /> : null}
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
            ? "Questions fréquentes sur la couverture géographique de ce service. Pour explorer le tissu B2B local, consultez notre carte des implantations."
            : "Frequently asked questions about the geographic coverage of this service. To explore the local B2B fabric, visit our locations map."
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
