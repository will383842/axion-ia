/**
 * La ligne « Salutation des e-mails » de la fiche client : montre ce que le
 * gabarit écrira (« Bonjour Madame Dupont, », « Bonjour Léa, » ou « Bonjour, »).
 * Module PUR ; même règle que le gabarit (`salutation`), donc aucune dérive.
 */
import { salutation } from "@/lib/email/salutation";

export interface ClientPourLibelleSalutation {
  readonly contactCivilite?: unknown;
  readonly contactPrenom?: unknown;
  readonly contactNomFamille?: unknown;
}

export function libelleSalutationEmails(client: ClientPourLibelleSalutation): string {
  return salutation(
    {
      civilite: client.contactCivilite,
      prenom: client.contactPrenom,
      nomFamille: client.contactNomFamille,
    },
    "fr",
  );
}
