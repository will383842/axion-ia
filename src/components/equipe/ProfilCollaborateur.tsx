import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { villesPhares, nomsRegions } from "@/lib/equipe/villes-phares";
import { jetonsDe } from "./couleurs-categorie";
import { ActionsFiche } from "./ActionsFiche";
import { AvantApres, PorteEntree, Rassurance } from "./BlocsTransformation";
import { CitationsTerrain } from "./CitationsTerrain";
import { FaqFiche } from "./FaqFiche";
import { HeroCollaborateur } from "./HeroCollaborateur";
import { MethodeCollaborateur } from "./MethodeCollaborateur";
import { MetiersCollaborateur } from "./MetiersCollaborateur";
import { ParcoursSection } from "./ParcoursSection";
import { PiedFiche } from "./PiedFiche";
import { SectionsCategorie } from "./SectionsCategorie";
import { BandeauAppel } from "./visuels/BandeauAppel";
import { GrilleEnBref } from "./visuels/GrilleEnBref";
import { PartoutEnFrance } from "./visuels/PartoutEnFrance";
import { SectionFiche } from "./visuels/SectionFiche";
import { VousEtes, type CarteVousEtes as CarteVue, type TonCarte } from "./visuels/VousEtes";

/** Silhouettes des trois tailles d'entreprise de la fiche de Williams (clé de carte → nombre). */
const SILHOUETTES: Readonly<Record<string, 1 | 2 | 3>> = {
  "dirigeant-seul": 1,
  tpe: 2,
  pme: 3,
};

const REASSURANCE_APPEL = ["45 minutes", "Sans engagement", "En visio ou par téléphone"] as const;

function enteteDe(contenu: ContenuFiche, id: string) {
  const e = contenu.entetes?.[id];
  if (!e) return undefined;
  return {
    surTitre: e.surTitre,
    question: e.question,
    ...(e.reponse ? { reponse: e.reponse } : {}),
  };
}

/** `{ entete }` si la fiche porte l'en-tête de cette section, sinon rien (titre de la donnée). */
function avec(contenu: ContenuFiche, id: string) {
  const entete = enteteDe(contenu, id);
  return entete ? { entete } : {};
}

function carteVue(
  c: NonNullable<ContenuFiche["vousEtes"]>[number],
  ton: TonCarte,
  avecSilhouettes: boolean,
): CarteVue {
  const silhouettes = avecSilhouettes ? SILHOUETTES[c.cle] : undefined;
  return {
    id: c.cle,
    titre: c.titre,
    cout: c.cout,
    action: c.action,
    gain: c.gain,
    icone: c.icone,
    ton,
    ...(silhouettes ? { silhouettes } : {}),
  };
}

/**
 * Fiche d'un collaborateur — gabarit unique, Server Component pur.
 *
 * Plan des titres : un H1 (le nom, dans le héros), un H2 par section (en question), des H3 pour
 * les cartes, les étapes et les questions. Une section sans données n'est PAS rendue (jamais de
 * H2 vide). Rythme des fonds : foncé → clair → crème → … → terracotta, jamais deux fonds foncés
 * qui se touchent (`data-fond`). Le fil d'Ariane et le JSON-LD sont posés par la route.
 *
 * Les blocs communs à une catégorie (« Vous êtes… », réponse de présence, villes) ne sont rendus
 * que sur une fiche indexable qui porte une réponse personnelle (ou pour le dirigeant principal) :
 * partout ailleurs ils créeraient des pages presque identiques.
 */
export function ProfilCollaborateur({
  fiche,
  contenu,
  indexable = false,
}: {
  fiche: FichePublique;
  contenu: ContenuFiche;
  /** Règle d'indexation de la fiche (posée par la route) ; sans effet pour le dirigeant principal. */
  indexable?: boolean;
}) {
  const jeton = jetonsDe(fiche.categorie).forme;
  const reponsePersonnelle = Boolean(contenu.entetes?.["en-bref"]?.reponse);
  const blocsCommuns = fiche.estDirigeantPrincipal || (indexable && reponsePersonnelle);
  const chiffres = contenu.chiffresCles ?? [];
  const actionsAppel = contenu.appelFinal.actions;
  const versAppel =
    !actionsAppel || actionsAppel.length === 0 || actionsAppel.some((a) => a.href === "/appel");
  const cartesTailles = contenu.vousEtes ?? [];
  const cartesMetiers = contenu.vousEtesMetiers ?? [];
  const afficherVousEtes = blocsCommuns && cartesTailles.length + cartesMetiers.length > 0;
  const pourQui = contenu.pourQui;
  const enteteVousEtes =
    enteteDe(contenu, "pour-qui") ??
    (pourQui?.question
      ? { surTitre: "Pour qui", question: pourQui.question }
      : {
          surTitre: "Pour qui",
          question: `Votre entreprise ressemble-t-elle à celles qu'accompagne ${fiche.nom} ?`,
        });
  const presence = contenu.presence;
  const villes = blocsCommuns && presence ? villesPhares() : [];
  const faqEntete = enteteDe(contenu, "faq") ?? {
    surTitre: "Questions",
    question: `Questions fréquentes sur ${fiche.nom}`,
  };
  const enteteBref = enteteDe(contenu, "en-bref") ?? {
    surTitre: "En bref",
    question: `${fiche.nom} en bref`,
  };

  return (
    <>
      <HeroCollaborateur
        fiche={fiche}
        contenu={contenu}
        {...(chiffres.length >= 2 ? { chiffres } : {})}
        {...(contenu.pastillesDetaillees
          ? { pastillesDetaillees: contenu.pastillesDetaillees }
          : {})}
      />

      <SectionFiche id="en-bref" ton="ivoire" entete={enteteBref}>
        <GrilleEnBref
          lignes={contenu.identite}
          jeton={jeton}
          {...(contenu.liens.linkedin
            ? {
                lien: {
                  href: contenu.liens.linkedin,
                  libelle: `LinkedIn de ${fiche.nom}`,
                  rel: fiche.estDirigeantPrincipal
                    ? "me noopener noreferrer"
                    : "noopener noreferrer",
                },
              }
            : {})}
        />
      </SectionFiche>

      {afficherVousEtes ? (
        <VousEtes
          surTitre={enteteVousEtes.surTitre}
          question={enteteVousEtes.question}
          {...("reponse" in enteteVousEtes && enteteVousEtes.reponse
            ? { reponse: enteteVousEtes.reponse }
            : {})}
          {...(fiche.estDirigeantPrincipal ? {} : { titreTailles: "Votre situation" })}
          tailles={cartesTailles.map((c) =>
            carteVue(c, jeton as TonCarte, fiche.estDirigeantPrincipal),
          )}
          metiers={cartesMetiers.map((c) => carteVue(c, jeton as TonCarte, false))}
          {...(pourQui && pourQui.secteurs.length > 0
            ? { autresSecteurs: pourQui.secteurs.map((s) => s.libelle) }
            : {})}
          {...(pourQui?.phrase ? { phraseAutres: pourQui.phrase } : {})}
          {...(pourQui?.lien ? { lien: pourQui.lien } : {})}
        />
      ) : null}

      {contenu.avantApres ? (
        <AvantApres donnees={contenu.avantApres} {...avec(contenu, "avant-apres")} />
      ) : null}
      {contenu.rassurance ? (
        <Rassurance donnees={contenu.rassurance} {...avec(contenu, "rassurance")} />
      ) : null}
      {contenu.methode ? (
        <MethodeCollaborateur donnees={contenu.methode} {...avec(contenu, "methode")} />
      ) : null}
      {contenu.porteEntree ? (
        <PorteEntree
          donnees={contenu.porteEntree}
          {...avec(contenu, "journee-ia")}
          {...(contenu.porteEntree.moments ? { moments: contenu.porteEntree.moments } : {})}
          {...(contenu.porteEntree.chiffres ? { chiffres: contenu.porteEntree.chiffres } : {})}
        />
      ) : null}
      {contenu.sectionsCategorie ? (
        <SectionsCategorie
          fiche={fiche}
          sections={contenu.sectionsCategorie}
          {...(contenu.entetes ? { entetes: contenu.entetes } : {})}
        />
      ) : null}
      {contenu.services ? (
        <MetiersCollaborateur donnees={contenu.services} {...avec(contenu, "services")} />
      ) : null}
      {contenu.parcours ? (
        <ParcoursSection donnees={contenu.parcours} {...avec(contenu, "parcours")} />
      ) : null}
      {contenu.citations ? (
        <CitationsTerrain
          donnees={contenu.citations}
          auteur={fiche.nom}
          {...avec(contenu, "constats")}
        />
      ) : null}

      {blocsCommuns && presence && villes.length > 0 ? (
        <PartoutEnFrance
          surTitre={presence.surTitre}
          question={presence.question}
          reponse={presence.reponse}
          regions={nomsRegions()}
          villes={villes}
          {...(presence.phraseLieu ? { phraseLieu: presence.phraseLieu } : {})}
          lienIndex={{ href: "/implantations", libelle: "Toutes les implantations d'Axion-IA" }}
        />
      ) : null}

      {contenu.faq.length > 0 ? (
        <SectionFiche id="faq" ton="ivoire" entete={faqEntete}>
          <FaqFiche items={contenu.faq} />
        </SectionFiche>
      ) : null}

      <BandeauAppel
        titre={contenu.appelFinal.titre}
        texte={contenu.appelFinal.texte}
        {...(versAppel ? { reassurance: REASSURANCE_APPEL } : {})}
      >
        <ActionsFiche fiche={fiche} contenu={contenu} emplacement="cta" fond="terracotta" />
      </BandeauAppel>

      <PiedFiche liens={contenu.liensInternes} />
    </>
  );
}
