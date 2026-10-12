// L-INV (S-UX-16) — ce que la candidature d'un formateur indépendant dit de son
// invitation, en une phrase pour Will. Pur.

const JOUR_MS = 24 * 60 * 60 * 1000;

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

export function resumeInvitationFormateur(
  e: {
    readonly invitationFormateurAt: Date | null;
    readonly rattrapageAt: Date | null;
    readonly clotureSansSuiteAt: Date | null;
  },
  maintenant: Date = new Date(),
): string {
  if (e.clotureSansSuiteAt)
    return `Close « sans suite » le ${jour(e.clotureSansSuiteAt)}, sans e-mail.`;
  if (e.rattrapageAt)
    return `Invitation de rattrapage envoyée le ${jour(e.rattrapageAt)} (sans rappel).`;
  if (!e.invitationFormateurAt) return "Pas encore invitée.";
  const t = e.invitationFormateurAt.getTime();
  const prochain = [3, 7].map((j) => new Date(t + j * JOUR_MS)).find((d) => d > maintenant);
  const suite = prochain
    ? ` Prochain rappel le ${jour(prochain)} · il s'arrête dès que la personne réserve, répond ou que vous décidez.`
    : " Plus aucun rappel prévu.";
  return `Invitation envoyée le ${jour(e.invitationFormateurAt)}.${suite}`;
}
