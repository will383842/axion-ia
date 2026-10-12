/**
 * Les textes de l'étape 4 quand le contrat se signe DANS le dossier (lot B, M3).
 *
 * À part de `textes.ts` : ce module n'est lu que par la page serveur, qui les passe au
 * composant en props. Ils ne pèsent donc pas dans le JavaScript du dossier, qui ne les
 * affiche que lorsque `contrat_auto` est allumé.
 */

export const TEXTES_CONTRAT = {
  contratRempli: "Votre contrat, rempli",
  contratResume: [
    "Un contrat-cadre de sous-traitance entre vous, formateur indépendant, et Axion-IA.",
    "Il fixe les règles des missions d'animation qu'Axion-IA peut vous proposer ; à lui seul, il ne crée aucune mission.",
    "Honoraires : 350 € HT la journée, 175 € HT la demi-journée.",
    "Chaque mission vous est proposée : vous l'acceptez ou la refusez librement. Aucun volume n'est garanti, aucune exclusivité.",
    "Durée indéterminée ; chacun peut y mettre fin à tout moment, avec un préavis de 30 à 90 jours.",
    "Axion-IA établit vos factures en votre nom (mandat d'autofacturation) : vous n'avez pas à les faire.",
  ],
  lireContrat: "Lire le contrat complet (PDF)",
  contratApresCode:
    "Le contrat complet, à votre nom, s'affiche ici dès que vous demandez votre code.",
  jaiLu: "J'ai lu le contrat et je l'accepte, en particulier :",
  jaiLuPoints: [
    "le mandat d'autofacturation : Axion-IA établit vos factures en votre nom ;",
    "la liberté d'accepter ou de refuser chaque mission.",
  ],
  signeEnTantQue: "Vous signez en tant que",
  recevoirCode: "Recevoir mon code",
  codeEnvoyeAvant: "Un code vient de partir à",
  codeEnvoyeApres: "Il est valable 15 minutes.",
  codeNonRecu: "Code non reçu ? Renvoyer",
  codeSignature: "Code reçu par e‑mail (6 chiffres)",
  codeSignatureInvalide: "Le code se compose de 6 chiffres.",
  signer: "Signer mon contrat",
  signature: "Signature…",
  contratDejaSigne: "Votre contrat est signé. Il ne reste qu'à envoyer votre dossier.",
  merciSigneTitre: "Merci, c'est signé",
  merciSigneLigne:
    "Nous vérifions votre dossier. Votre contrat contresigné et l'accès à votre espace vous arrivent par e‑mail.",
} as const;

export type TextesContrat = typeof TEXTES_CONTRAT;
