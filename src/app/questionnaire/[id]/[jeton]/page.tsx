// Questionnaire de cadrage EN LIGNE — la page du client (2026-10-01).
//
// `/questionnaire/<questionnaireId>/<jeton>` : le lien que Will met sous un
// bouton de son e-mail, un par projet (et par version du questionnaire).
//
//   · jeton invalide, questionnaire inconnu, clos ou pas en ligne → la MÊME
//     page neutre, statut 404 (`not-found.tsx`) : rien ne dit lequel ;
//   · réponses déjà envoyées → « Vos réponses sont bien arrivées » (ou
//     « Merci, c'est reçu » juste après l'envoi, `?envoye=1`) ;
//   · sinon : le questionnaire, une question par écran (JavaScript), ou un
//     formulaire d'un seul tenant (sans JavaScript).
//
// Rendu à la demande (`force-dynamic`), jamais au build : aucune requête à la
// base pendant `next build` (contrat `stub.invalid`, `AGENTS.md`), et
// `lireQuestionnairePublic` refuse lui-même la base factice.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { decouperQuestion } from "@/server/visio/questionnaire-en-ligne/decouper";
import { lireQuestionnairePublic } from "@/server/visio/questionnaire-en-ligne/reponses";
import { Coquille, EcranDeFin } from "./Coquille";
import { QuestionnaireComplet } from "./QuestionnaireComplet";
import { EffacerBrouillon } from "./QuestionnaireEnLigne";
import { insecable } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questionnaire — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const un = (v: string | string[] | undefined): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;

export default async function QuestionnairePage({ params, searchParams }: PageProps) {
  const { id, jeton } = await params;
  const sp = await searchParams;
  const etat = await lireQuestionnairePublic(prisma, id, jeton);
  if (etat.etat === "introuvable") notFound();
  const questionnaireId = id.toLowerCase();

  if (etat.etat === "deja_envoye") {
    return (
      <Coquille>
        {/* Les réponses sont en base : le brouillon local s'efface dès que la
            page le constate — après l'envoi (« Merci ») comme sur tout autre
            appareil ou onglet qui rouvre le lien (« Déjà envoyé »). */}
        <EffacerBrouillon questionnaireId={questionnaireId} />
        <EcranDeFin variante={un(sp["envoye"]) === "1" ? "merci" : "deja"} />
      </Coquille>
    );
  }

  const brut = un(sp["erreur"]);
  const erreur = brut === "vide" || brut === "trop" ? brut : null;
  const questions = etat.questions.map((q) => {
    const d = decouperQuestion(q.texte);
    return {
      id: q.id,
      titre: insecable(d.titre),
      aide: d.aide === null ? null : insecable(d.aide),
      puces: d.puces,
    };
  });
  return (
    <Coquille>
      <QuestionnaireComplet
        questionnaireId={questionnaireId}
        jeton={jeton}
        questions={questions}
        erreur={erreur}
      />
    </Coquille>
  );
}
