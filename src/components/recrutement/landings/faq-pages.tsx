// FAQ propres aux pages « annonce » (Le Mémo de l'Isère) et « dossier » : chacune est visible ET
// reprise à l'identique dans le JSON-LD FAQPage (builder `faqApporteurs`). Écrites à la main, hors
// des fichiers générés depuis les maquettes : la régénération ne les touche pas. Aucun montant en
// dur : la commission vient de `Chiffres` et garde « à titre indicatif ».
import type { Chiffres, QuestionReponse } from "./chiffres";
import { ListeFaq } from "./faq";

function reponseGain(p: Chiffres): string {
  return p.commissionPublique
    ? `À titre indicatif, ${p.commission} HT par Journée IA payée, selon le contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : sans exclusivité, sans frais d’entrée, à votre rythme.`
    : `Une commission sur chaque Journée IA payée, détaillée dans votre contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : sans exclusivité, sans frais d’entrée, à votre rythme.`;
}

export function faqMemoIsere(p: Chiffres): QuestionReponse[] {
  return [
    {
      question: `Je viens de lire l’annonce du Mémo de l’Isère : par où commencer ?`,
      reponse: `Par le dossier de 3 minutes, sans CV, une question par écran. Vous recevez ensuite un e-mail de confirmation ; si nous poursuivons ensemble, une invitation à un échange de 15 minutes en visio.`,
    },
    {
      question: `Faut-il habiter en Isère ?`,
      reponse: `Non. Les apporteurs d’affaires d’Axion-IA présentent la Journée IA à des dirigeants qu’ils connaissent, partout en France ; la journée a lieu dans les locaux de l’entreprise.`,
    },
    {
      question: `Faut-il connaître l’IA ?`,
      reponse: `Non. Vous présentez ; nous nous occupons des explications, de la démonstration et de la journée elle-même.`,
    },
    {
      question: `Faut-il un statut ?`,
      reponse: `Oui : vous intervenez comme indépendant (micro-entreprise ou société) avec un SIREN actif. Vous n’êtes pas salarié d’Axion-IA. Sans SIREN, nous vous expliquons comment créer une micro-entreprise en quelques jours.`,
    },
    {
      question: `Combien puis-je gagner ?`,
      reponse: reponseGain(p),
    },
  ];
}

export function faqDossier(p: Chiffres): QuestionReponse[] {
  return [
    {
      question: `Que demande le dossier ?`,
      reponse: `Huit questions, une par écran, en 3 minutes environ, à commencer par la façon dont vous connaissez des dirigeants. Aucun CV à fournir.`,
    },
    {
      question: `Puis-je m’arrêter et reprendre plus tard ?`,
      reponse: `Oui. Vos réponses sont enregistrées au fur et à mesure, et nous vous envoyons un lien pour reprendre là où vous vous êtes arrêté.`,
    },
    {
      question: `Que se passe-t-il après l’envoi ?`,
      reponse: `Vous recevez un e-mail de confirmation avec la Journée IA en une page. Si nous poursuivons ensemble, une invitation à un échange de 15 minutes en visio, puis un contrat écrit à lire avant de signer. Nous répondons à tous.`,
    },
    {
      question: `Faut-il un SIREN pour remplir le dossier ?`,
      reponse: `Le dossier peut être rempli sans SIREN. Pour signer le contrat, un statut d’indépendant avec un SIREN actif est nécessaire ; sans SIREN, nous vous expliquons comment créer une micro-entreprise en quelques jours.`,
    },
    {
      question: `Combien puis-je gagner ?`,
      reponse: reponseGain(p),
    },
  ];
}

/** Section FAQ visible, même gabarit que celle de la page principale. */
export function SectionFaq({ items, id }: { items: QuestionReponse[]; id: string }) {
  return (
    <section className="fd-sable" id={id} aria-labelledby={`${id}-titre`}>
      <div className="wrap faq-grille">
        <div className="faq-tete">
          <p className="st">Vos questions</p>
          <h2 id={`${id}-titre`}>Avant de vous lancer</h2>
        </div>
        <div className="faq-liste">
          <ListeFaq items={items} />
        </div>
      </div>
    </section>
  );
}
