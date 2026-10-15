// V2-S02 — Le lien de connexion à l'espace formateur, REJOUÉ.
//
// Chaque lien est fabriqué par le code du dépôt (`createFormateurMagicLink`) et
// présenté à la VRAIE route de connexion. On rejoue : le même lien deux fois,
// deux clics simultanés, un lien échu, un lien altéré, un lien émis avant un
// changement d'adresse fait en console, un lien d'une fiche désactivée depuis.
// Témoin : le premier clic d'un lien neuf ouvre l'espace (cookie posé).

import { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { GET as connexion } from "@/app/[locale]/espace-formateur/connexion/[token]/route";
import { updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { consumeFormateurMagicLink, createFormateurMagicLink } from "@/server/formateur/magic-link";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";

import {
  adresse,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
  seConnecter,
} from "../donnees";
import { reponse } from "../v2s-outils";
import {
  lireCookiesPoses,
  poserCookie,
} from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";

async function cliquer(jeton: string): Promise<{ location: string | null; cookie: boolean }> {
  poserCookie(FORMATEUR_COOKIE_NAME, null);
  const r = await reponse(
    await connexion(
      new NextRequest(`https://axion-ia.com/fr/espace-formateur/connexion/${jeton}`),
      { params: Promise.resolve({ token: jeton, locale: "fr" }) },
    ),
  );
  const cookie = lireCookiesPoses().has(FORMATEUR_COOKIE_NAME);
  poserCookie(FORMATEUR_COOKIE_NAME, null);
  return { location: r.location, cookie };
}

export default async function v2s02(): Promise<unknown> {
  try {
    // Le changement d'adresse passe par la console : le verrou garde ses réglages.
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const t = await creerIndependant({ actif: true });

      const neuf = await createFormateurMagicLink(t.id);
      const premier = await cliquer(neuf);
      const second = await cliquer(neuf);

      const double = await createFormateurMagicLink(t.id);
      const simultanes = await Promise.all([
        consumeFormateurMagicLink(double),
        consumeFormateurMagicLink(double),
      ]);

      const echu = await createFormateurMagicLink(t.id);
      await prisma.formateurMagicLink.updateMany({
        where: { trainerId: t.id, usedAt: null },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      const apresEcheance = await cliquer(echu);

      const altere = await cliquer(`${neuf.slice(0, -3)}${neuf.endsWith("A") ? "BBB" : "AAA"}`);

      const avantChangement = await createFormateurMagicLink(t.id);
      seConnecter(direction);
      const changement = await updateTrainerAction({ id: t.id, email: adresse("nouvelle") });
      seConnecter(null);
      const apresChangement = await cliquer(avantChangement);

      const avantDesactivation = await createFormateurMagicLink(t.id);
      await prisma.trainer.update({ where: { id: t.id }, data: { actif: false } });
      const apresDesactivation = await cliquer(avantDesactivation);
      const encoreVivants = await prisma.formateurMagicLink.count({
        where: { trainerId: t.id, usedAt: null, expiresAt: { gt: new Date() } },
      });

      return {
        premier,
        second,
        simultanes: simultanes.filter((x) => x !== null).length,
        apresEcheance,
        altere,
        changement: "error" in changement ? changement.error : "ok",
        apresChangement,
        apresDesactivation,
        encoreVivants,
      };
    });
  } finally {
    await menage();
  }
}
