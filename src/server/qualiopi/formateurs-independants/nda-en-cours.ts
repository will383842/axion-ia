/**
 * Le numéro de déclaration d'activité saisi dit-il « en cours » ? Même lecture que le
 * contrôle du registre. Module neutre : lu par le passage des campagnes (F21) ET par le
 * filet du départ, sur le trajet du worker d'e-mails.
 */
export const ndaEstEnCours = (brut: string | null): boolean =>
  typeof brut === "string" && /en\s*cours/i.test(brut);
