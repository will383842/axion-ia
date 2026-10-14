// E-D7 — Le jeton de réservation de l'échange (F1 / F7) ne sert qu'AVANT la
// réservation : réutilisé après, il ne livre plus ni nom ni e-mail.
//
// Le jeton est fabriqué par `jetonReservationFormateur`, lu par
// `identiteDuJetonReservation` — ce que la page de réservation appelle. La
// réservation est posée comme la chaîne Calendly la rattache : un rendez-vous
// lié à la candidature (`linkedJobApplicationId`).

import { encryptPii } from "@/lib/pii-crypto";
import { identiteDuJetonReservation } from "@/server/qualiopi/formateurs-independants/identite-reservation";
import { jetonReservationFormateur } from "@/server/qualiopi/formateurs-independants/jeton-reservation";

import { aNettoyer, adresse, CLE, menage, prisma } from "../donnees";

async function candidature(email: string) {
  const c = await prisma.jobApplication.create({
    data: {
      offerTitleSnap: "Formateur IA freelance",
      firstName: encryptPii("Hortense") ?? "",
      lastName: encryptPii(`Banc-Sécu-${CLE}`) ?? "",
      email: encryptPii(email) ?? "",
      phone: encryptPii("0600000000") ?? "",
      consentVersion: "banc",
    } as never,
    select: { id: true },
  });
  aNettoyer(async () => {
    await prisma.calendlyEvent.deleteMany({ where: { linkedJobApplicationId: c.id } });
    await prisma.jobApplication.delete({ where: { id: c.id } });
  });
  return c.id;
}

export default async function ed7(): Promise<unknown> {
  try {
    const maintenant = new Date();
    const email = adresse("candidat");
    const id = await candidature(email);
    const jeton = jetonReservationFormateur(id, maintenant) ?? "";

    const avant = await identiteDuJetonReservation(jeton, maintenant);

    await prisma.calendlyEvent.create({
      data: {
        eventTypeName: "Échange formateur indépendant",
        eventTypeSlug: "echange-formateur",
        status: "scheduled",
        startTime: new Date(maintenant.getTime() + 3 * 86_400_000),
        inviteeEmail: email,
        eventUri: `https://api.calendly.com/scheduled_events/BANC-SECU-${CLE}`,
        inviteeUri: `https://api.calendly.com/scheduled_events/BANC-SECU-${CLE}/invitees/1`,
        rawPayload: {},
        linkedJobApplicationId: id,
      } as never,
    });
    const apresReservation = await identiteDuJetonReservation(jeton, maintenant);
    // Même rendez-vous annulé : le jeton a servi, il ne resservira pas.
    await prisma.calendlyEvent.updateMany({
      where: { linkedJobApplicationId: id },
      data: { status: "canceled" } as never,
    });
    const apresAnnulation = await identiteDuJetonReservation(jeton, maintenant);

    // Réponses neutres de référence : jeton altéré, jeton échu.
    const altere = await identiteDuJetonReservation(`${jeton.slice(0, -2)}xx`, maintenant);
    const echu = await identiteDuJetonReservation(
      jeton,
      new Date(maintenant.getTime() + 31 * 86_400_000),
    );
    return { emailCandidat: email, avant, apresReservation, apresAnnulation, altere, echu };
  } finally {
    await menage();
  }
}
