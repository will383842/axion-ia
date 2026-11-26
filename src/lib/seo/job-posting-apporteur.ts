// JobPosting PRUDENT de la page principale des apporteurs d'affaires, et d'elle seule.
//
// B5 levée pour CETTE SEULE page par décision de Will du 25/11/2026 : les risques juridique
// (salariat déguisé) et Google (règle affiliate) sont assumés. `/memo-isere` reste exclue.
//
// Construit ici, HORS des dossiers apporteurs : la garde `jur-copy-indicative` refuse ce
// balisage dans `src/content/recrutement` et `src/components/recrutement`, et elle ne doit pas
// être affaiblie. Ce que ce balisage NE porte jamais : salaire, commission balisée, avantages,
// horaires, date de fin. Le texte reprend des phrases VISIBLES sur la page.
import { APPORTEUR_JOB_POSTING_DATE_POSTED } from "@/content/recrutement/dates";
import { SITE_URL } from "@/lib/seo";
import { HIRING_ORG } from "@/lib/seo/job-posting";

const DESCRIPTION = [
  "<p>Vous connaissez des dirigeants de PME : présentez-leur la Journée IA. Axion-IA prend le rendez-vous, fait le devis, anime la journée et facture.</p>",
  "<p>Vous intervenez comme indépendant, avec un SIREN actif, dans le cadre d’un contrat d’apport d’affaires. Ce n’est pas un contrat de travail : pas d’horaires, pas de quota ni d’objectif, pas d’exclusivité, pas de reporting, pas de frais d’entrée.</p>",
  "<p>Une commission est due sur chaque Journée IA payée : elle vous est due quand l’entreprise a réglé sa facture ; elle est réduite au prorata en cas de remise et reprise en cas d’avoir. Le montant perçu dépend uniquement des Journées IA payées : aucun revenu n’est promis.</p>",
  "<p>La suite : un échange de 15 minutes en visio, puis le contrat à lire avant de signer.</p>",
].join("");

export function buildApporteurJobPostingJsonLd(locale: string): Record<string, unknown> | null {
  if (locale !== "fr") return null;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Apporteur d'affaires indépendant",
    description: DESCRIPTION,
    identifier: {
      "@type": "PropertyValue",
      name: "Axion-IA",
      value: "apporteur-affaires-independant",
    },
    datePosted: APPORTEUR_JOB_POSTING_DATE_POSTED,
    employmentType: "CONTRACTOR",
    hiringOrganization: HIRING_ORG,
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "France", identifier: "FR" },
    directApply: true,
    url: `${SITE_URL}/fr/devenir-commercial-ia`,
  };
}
