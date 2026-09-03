/**
 * Le jeu de donnees d'exemple qui alimente l'apercu des gabarits d'e-mail.
 *
 * ## UN SEUL OBJET POUR LES 42 GABARITS — et pourquoi
 *
 * L'evidence serait un jeu de donnees par gabarit : 42 objets a ecrire, a
 * relire, et a corriger un par un le jour ou un champ change de nom. C'est
 * exactement le motif qui a produit les trois oranges divergents de ce depot.
 *
 * A la place : un seul objet qui porte les 118 champs declares par l'ensemble
 * des gabarits. Chaque composant lit `payload as Payload` et ne touche qu'aux
 * siens — il rend donc complet, et ignore les autres.
 *
 * Consequence heureuse : un gabarit neuf dont les champs portent des noms deja
 * connus s'apercoit sans rien ecrire ici.
 *
 * Et quand il introduit un champ inconnu, `payloads-exemple.spec.ts` rougit :
 * il relit les interfaces `Payload` des 42 fichiers et verifie que chaque champ
 * NON optionnel figure ci-dessous. La garde est donc DERIVEE du code, pas une
 * liste recopiee qui vieillirait en silence.
 *
 * ## Aucune donnee reelle
 *
 * Noms fictifs, domaine `.invalid` (reserve par la RFC 2606, donc non
 * routable), liens vers `exemple.invalid`. Un apercu ne doit jamais afficher un
 * vrai prospect, ni un lien qui pointe vers la production — un clic depuis la
 * console ouvrirait une page reelle au nom de quelqu'un.
 */

export const PAYLOAD_EXEMPLE: Readonly<Record<string, unknown>> = {
  amountTtc: "1 450,00 €",
  appels: 12,
  auditType: "Audit IA",
  bodyMarkdown: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  bookingId: "demo-0000",
  budget: "10 000 – 25 000 €",
  cancelUrl: "https://exemple.invalid/lien-de-demonstration",
  creneauUrl: "https://exemple.invalid/lien-de-demonstration",
  dossierUrl: "https://exemple.invalid/lien-de-demonstration",
  etape: "j2",
  cancellationWindow: "14 jours",
  candidatures: 3,
  changeNote: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  checkoutUrl: "https://exemple.invalid/lien-de-demonstration",
  city: "Grenoble",
  clientNom: "Camille Dupont",
  companyName: "Atelier Lumen",
  confirmToken: "jeton-de-demonstration",
  consoleUrl: "https://exemple.invalid/lien-de-demonstration",
  contactName: "Camille Dupont",
  contactNom: "Camille Dupont",
  contexte: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  conversations: 38,
  dateCandidature: "28 août 2026",
  dateDebut: "lundi 15 septembre 2026",
  dateDebutFormation: "lundi 15 septembre 2026",
  dateEcheance: "30 septembre 2026",
  dateEcheanceLabel: "30 septembre 2026",
  dateFin: "mardi 16 septembre 2026",
  dateFinFormation: "mardi 16 septembre 2026",
  dateValiditeLabel: "30 septembre 2026",
  demandes: 7,
  deposeeLe: "28 août 2026",
  destinataireNom: "Camille Dupont",
  dureeMinutes: 45,
  effectueLe: "28 août 2026",
  estAvoir: false,
  experiences: 2,
  expiresAt: "28 août 2026 à 18:00",
  expiresHours: 48,
  expiresInMin: 30,
  exportUrl: "https://exemple.invalid/lien-de-demonstration",
  extrait: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  familleLabel: "Audit IA",
  formateurNom: "Camille Dupont",
  fteRecovered: 0.4,
  headcount: 24,
  heure: "11:00",
  implType: "Audit IA",
  industry: "Industrie",
  interventionLabel: "Audit IA",
  interventionType: "Audit IA",
  invoiceNumber: "F-2026-0142",
  joursOpposition: 30,
  joursRetard: 12,
  leaderName: "Camille Dupont",
  libelleQuestionnaire: "Questionnaire de positionnement",
  lienEmargement: "https://exemple.invalid/lien-de-demonstration",
  lienEnquete: "https://exemple.invalid/lien-de-demonstration",
  lienFacture: "https://exemple.invalid/lien-de-demonstration",
  lienPortail: "https://exemple.invalid/lien-de-demonstration",
  lienQuestionnaire: "https://exemple.invalid/lien-de-demonstration",
  lieu: "+33 7 00 00 00 00",
  magicLink: "https://exemple.invalid/lien-de-demonstration",
  messageLibre: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  messagePersonnalise: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  modalite: "Audit IA",
  montantDu: "1 450,00 €",
  montantLabel: "1 450,00 €",
  newsletter: 120,
  nom: "Dupont",
  notes: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  numero: "F-2026-0142",
  numeroFacture: "F-2026-0142",
  numeroSession: "SESS-2026-018",
  offerTitle: "Piloter son activité avec l'IA",
  offre: "Piloter son activité avec l'IA",
  oppositionUrl: "https://exemple.invalid/lien-de-demonstration",
  originalSubmissionExcerpt:
    "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  ouvertParOrganisme: true,
  paidAt: "28 août 2026",
  paymentType: "Audit IA",
  pdfUrl: "https://exemple.invalid/lien-de-demonstration",
  penalitesLabel: "40,00 € de pénalités",
  pitch: "Bonjour, voici le message d'exemple utilisé pour l'aperçu de ce gabarit.",
  portalUrl: "https://exemple.invalid/lien-de-demonstration",
  prenom: "Camille",
  questionnaireEnAttente: true,
  raisonSociale: "Atelier Lumen",
  reasonCode: "INDISPONIBLE",
  reference: "SESS-2026-018",
  refundPercentage: 50,
  reportUrl: "https://exemple.invalid/lien-de-demonstration",
  rescheduleUrl: "https://exemple.invalid/lien-de-demonstration",
  retryUrl: "https://exemple.invalid/lien-de-demonstration",
  rows: [{ label: "Ligne d'exemple", value: "1 450,00 €" }],
  savedEurHigh: 24000,
  savedEurLow: 12000,
  savedEurPerYear: 18000,
  savedHoursPerYear: 320,
  sectorLabel: "Industrie",
  signataireNom: "Camille Dupont",
  signature: "Williams\nAxion-IA",
  signatureUrl: "https://exemple.invalid/lien-de-demonstration",
  size: "24 salariés",
  slotTitre: "Créneau du 3 septembre à 13:00",
  soldePartiel: false,
  sourceFormat: "Audit IA",
  sourceUrl: "https://exemple.invalid/lien-de-demonstration",
  stagiairePrenomNom: "Camille Dupont",
  subject: "Votre demande",
  submissionId: "demo-0000",
  // Alerte interne : sans ces trois champs, l'apercu affichait
  // « [INFO] Alerte Qualiopi — undefined ».
  niveau: "critique",
  code: "FACTURE_IMPAYEE",
  titre: "Facture arrivée à échéance sans règlement",
  guichet: "Administration",
  telephone: "+33 7 00 00 00 00",
  titreFormation: "Piloter son activité avec l'IA",
  ton: "professionnel",
  // Les noms de champs suivent `TopTask` de `roi-report.tsx` : `hours` et
  // `eur`, pas `hoursPerYear`/`eurPerYear`. Un nom approchant rendait « NaN ».
  topTasks: [
    { label: "Devis et relances", hours: 120, eur: 6600, weeks: 3 },
    { label: "Comptes rendus d'entretien", hours: 90, eur: 4950, weeks: 2 },
  ],
  type: "Audit IA",
  typeDocument: "Audit IA",
  unsubscribeToken: "jeton-de-demonstration",
  version: "v2",
  ville: "Grenoble",
} as const;
