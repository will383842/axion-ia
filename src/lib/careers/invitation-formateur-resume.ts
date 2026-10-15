// L-INV (S-UX-16) — ce que la candidature d'un formateur indépendant dit de son
// invitation, en une phrase pour Will. Pur.

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Silence au-delà duquel une personne invitée est « à décider » (celui de la campagne S1). */
export const SEUIL_A_DECIDER_MS = 14 * JOUR_MS;

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

/**
 * Les motifs pour lesquels une candidature NON invitée attend, dits en clair (V1-A-1,
 * V1-A-2). Les autres motifs (pas freelance, déjà réservé…) ne s'affichent pas ici.
 */
const LIBELLE_MOTIF_ATTENTE: Readonly<Record<string, string>> = {
  opposition:
    "En attente : la personne s'est opposée aux sollicitations, aucune invitation ne part.",
  "siret-ferme":
    "En attente : l'entreprise indiquée au formulaire est fermée au registre, aucune invitation ne part.",
  "registre-muet":
    "En attente : le registre des entreprises n'a pas répondu, aucune invitation ne part tant que l'entreprise n'est pas contrôlée.",
  "registre-rouge":
    "En attente : le registre des entreprises signale une entreprise fermée, aucune invitation ne part.",
  "adresse-morte": "En attente : l'adresse de la personne a rebondi, aucune invitation ne part.",
  efface: "En attente : la candidature a été effacée, aucune invitation ne part.",
};

export function resumeInvitationFormateur(
  e: {
    readonly invitationFormateurAt: Date | null;
    readonly rattrapageAt: Date | null;
    readonly clotureSansSuiteAt: Date | null;
  },
  maintenant: Date = new Date(),
  faits: {
    /** Le motif (de `motifNePasInviter` ou du contrôle du SIRET) qui retient l'invitation. */
    readonly motifAttente?: string | null;
    /** Invitée, ni réservée ni répondue, au-delà du silence de la campagne. */
    readonly aDecider?: boolean;
  } = {},
): string {
  if (e.clotureSansSuiteAt)
    return `Close « sans suite » le ${jour(e.clotureSansSuiteAt)}, sans e-mail.`;
  if (e.rattrapageAt)
    return `Invitation de rattrapage envoyée le ${jour(e.rattrapageAt)} (sans rappel).`;
  if (!e.invitationFormateurAt) {
    const motif = faits.motifAttente ? LIBELLE_MOTIF_ATTENTE[faits.motifAttente] : undefined;
    return motif ?? "Pas encore invitée.";
  }
  const t = e.invitationFormateurAt.getTime();
  if (faits.aDecider) {
    return `Invitation envoyée le ${jour(e.invitationFormateurAt)}. À décider : sans réservation ni réponse depuis plus de 14 jours, plus aucun rappel prévu.`;
  }
  const prochain = [3, 7].map((j) => new Date(t + j * JOUR_MS)).find((d) => d > maintenant);
  const suite = prochain
    ? ` Prochain rappel le ${jour(prochain)} · il s'arrête dès que la personne réserve, répond ou que vous décidez.`
    : " Plus aucun rappel prévu.";
  return `Invitation envoyée le ${jour(e.invitationFormateurAt)}.${suite}`;
}
