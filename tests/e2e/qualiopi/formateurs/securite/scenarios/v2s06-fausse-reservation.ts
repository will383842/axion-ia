// V2-S06 — Fausse réservation par la route PUBLIQUE `client-event`.
//
// Un script (pas Calendly) poste à la vraie route une « réservation » d'échange
// formateur au nom d'un candidat réel : son adresse, le marqueur de sa
// candidature dans `utm_content`, le type « échange formateur ». Attendu : rien
// n'est rattaché à la candidature (le rattachement ne lit que l'API Calendly),
// le lien de réservation du candidat n'est pas consommé, aucun e-mail ne part
// vers lui, et la réponse ne renvoie rien de personnel.
// Témoins de la garde : sans `Origin`, ou d'une autre origine, 403.
//
// ⚠️ La route est publique PAR CONCEPTION (l'intégration Calendly du navigateur
// la nourrit) : sa propre en-tête dit qu'un `Origin` forgé passe. On constate ici
// ce qu'une ligne forgée peut faire, pas qu'elle ne peut pas naître.

import { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { POST as clientEvent } from "@/app/api/calendly/client-event/route";
import { identiteDuJetonReservation } from "@/server/qualiopi/formateurs-independants/identite-reservation";
import { jetonReservationFormateur } from "@/server/qualiopi/formateurs-independants/jeton-reservation";

import { adresse, CLE, creerCandidatureFreelance, menage, prisma } from "../donnees";
import { reponse } from "../v2s-outils";

export default async function v2s06(): Promise<unknown> {
  const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const crees: string[] = [];
  try {
    const maintenant = new Date();
    const email = adresse("candidat");
    const candidature = await creerCandidatureFreelance(email);
    const jeton = jetonReservationFormateur(candidature, maintenant) ?? "";
    const avant = await identiteDuJetonReservation(jeton, maintenant);

    const corps = JSON.stringify({
      eventName: "calendly.event_scheduled",
      eventTypeSlug: "echange-formateur-independant",
      pageUrl: "https://axion-ia.com/fr/appel/reserver",
      utmContent: `formateur:fa-${candidature}`,
      payload: {
        invitee: {
          uri: `https://api.calendly.com/scheduled_events/BANC-V2S06-${CLE}/invitees/1`,
          email,
          name: "Hortense Banc",
        },
        event: { uri: `https://api.calendly.com/scheduled_events/BANC-V2S06-${CLE}` },
      },
    });
    const poster = async (entetes: Record<string, string>) =>
      reponse(
        await clientEvent(
          new NextRequest("https://axion-ia.com/api/calendly/client-event", {
            method: "POST",
            body: corps,
            headers: { "content-type": "application/json", "x-forwarded-for": ip, ...entetes },
          }),
        ),
      );
    const sansOrigine = await poster({});
    const autreOrigine = await poster({ origin: "https://evil.example" });
    const forgee = await poster({ origin: "https://axion-ia.com" });

    const lignes = await prisma.calendlyEvent.findMany({
      where: { inviteeEmail: email },
      select: { id: true, linkedJobApplicationId: true, status: true },
    });
    crees.push(...lignes.map((l) => l.id));
    const apres = await identiteDuJetonReservation(jeton, maintenant);
    const emails = await prisma.emailLog.count({ where: { recipient: email } });
    return {
      sansOrigine: { statut: sansOrigine.statut, corps: sansOrigine.corps },
      autreOrigine: { statut: autreOrigine.statut, corps: autreOrigine.corps },
      forgee: { statut: forgee.statut, corps: forgee.corps },
      email,
      lignes: lignes.map((l) => ({
        rattachee: l.linkedJobApplicationId !== null,
        statut: l.status,
      })),
      avant: avant !== null,
      apres: apres !== null,
      emails,
    };
  } finally {
    if (crees.length > 0) await prisma.calendlyEvent.deleteMany({ where: { id: { in: crees } } });
    await menage();
  }
}
