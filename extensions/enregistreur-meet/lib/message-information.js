// Les deux textes lus par le client (plan §3.7) — À RELIRE PAR WILL avant
// l'ouverture (point d'arrêt : tout texte lu par un client).
//
//   · la PHRASE D'ANNONCE, dite à voix haute par Will au début de l'appel ;
//   · le MESSAGE D'INFORMATION, copié dans le chat Meet (« Copier le message
//     d'information »), pour que l'information existe aussi par écrit.

/** Adresse publique de la liste des sous-traitants. */
export const PAGE_SOUS_TRAITANTS = "https://axion-ia.com/fr/sous-processeurs";

export function phraseAnnonce() {
  return (
    "Avant de commencer : avec votre accord, j'enregistre notre échange pour en faire le compte rendu. " +
    "Le son est transcrit et le compte rendu rédigé par OpenAI, puis le son est effacé sous 30 jours. " +
    "Êtes-vous d'accord ?"
  );
}

export function messageInformation() {
  return [
    "Pour information : avec votre accord, cet échange est enregistré afin d'en faire le compte rendu.",
    "Le son est transcrit et le compte rendu est rédigé par OpenAI (États-Unis, clauses contractuelles types), qui ne s'en sert pas pour entraîner ses modèles.",
    "Le son est effacé de nos serveurs au plus tard 30 jours après le rendez-vous.",
    "Vous pouvez refuser, ou retirer votre accord à tout moment, en me le disant ou en répondant à nos e-mails.",
    `Nos sous-traitants : ${PAGE_SOUS_TRAITANTS}`,
  ].join("\n");
}
