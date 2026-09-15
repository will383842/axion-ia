/**
 * Positionnement du portail — la réponse au besoin d'adaptation est EXPLICITE.
 *
 * 🔴 2026-09-15 (relecture #1095, D6) — le oui/non obligatoire n'était exigé que
 * par le formulaire. L'ancien formulaire (une case à cocher) envoyait `false` pour
 * une case jamais lue ; resté en cache dans un navigateur, il pouvait encore le
 * faire, et le serveur l'aurait enregistré comme un « non » réfléchi.
 *
 * Un `false` ne se distingue pas d'un autre `false`. Le formulaire actuel joint
 * donc ce marqueur, que l'ancien ne connaît pas ; le serveur refuse un
 * positionnement qui ne le porte pas, puis le RETIRE avant d'écrire : la forme
 * des réponses en base ne change pas.
 *
 * ⚠️ Module PUR, sans import : il est tiré par un composant client du portail.
 */
export const CLE_BESOIN_ADAPTATION_REPONDU = "besoinAdaptationRepondu";

export const MESSAGE_BESOIN_ADAPTATION_SANS_REPONSE =
  "Indiquez si vous avez besoin d'un aménagement pour suivre la formation (oui ou non). " +
  "Si la question ne s'affiche pas, rechargez la page.";
