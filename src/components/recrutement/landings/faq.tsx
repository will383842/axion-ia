// FAQ de la page principale : le MÊME texte alimente la liste visible et le JSON-LD FAQPage (généré).
import type { Chiffres, QuestionReponse } from "./chiffres";

export function faqPrincipale(p: Chiffres): QuestionReponse[] {
  return [
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
      reponse: `${p.commissionPublique ? `À titre indicatif, ${p.commission} HT par Journée IA payée, selon le contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : sans exclusivité, sans frais d’entrée, à votre rythme.` : `Une commission sur chaque Journée IA payée, détaillée dans votre contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : sans exclusivité, sans frais d’entrée, à votre rythme.`}`,
    },
    {
      question: `Dois-je négocier ou faire un devis ?`,
      reponse: `Non. Le prix est le même pour tous. Nous menons le rendez-vous, le devis et la facturation.`,
    },
    {
      question: `Y a-t-il des frais, un quota, une exclusivité ?`,
      reponse: `Non, aucun des trois. Vous gardez votre activité et votre rythme.`,
    },
    {
      question: `Que se passe-t-il après ma demande ?`,
      reponse: `Vous remplissez un dossier de 3 minutes, sans CV. Vous recevez un e-mail de confirmation, puis, si nous poursuivons ensemble, une invitation à un échange de 15 minutes en visio et un contrat à lire avant de signer. Nous répondons à tous.`,
    },
    {
      question: `Comment suis-je payé ?`,
      reponse: `Quand l’entreprise a réglé sa facture, la commission vous est due ; vous nous la facturez et nous la réglons. En cas de remise accordée à l’entreprise, elle est réduite au prorata ; en cas d’avoir, elle est reprise.`,
    },
    {
      question: `Puis-je en parler sur mes réseaux ?`,
      reponse: `Oui, en vous présentant comme apporteur d’affaires indépendant, sans annoncer de prix ni de promesse, sans utiliser notre logo comme avatar et sans envoi en masse. Le prix et la garantie, c’est nous qui les présentons.`,
    },
  ];
}

export function ListeFaq({ items }: { items: QuestionReponse[] }) {
  return (
    <>
      {items.map((f) => (
        <details className="faq" key={f.question}>
          <summary>
            <h3>{f.question}</h3>
            <svg className="ico" aria-hidden="true" focusable="false">
              <use href="#i-chev" />
            </svg>
          </summary>
          <p>{f.reponse}</p>
        </details>
      ))}
    </>
  );
}
