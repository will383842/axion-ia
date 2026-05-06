// Minimal Sprint 0 home page. Sprint 2 introduces the locale-aware [locale]/
// layout and the real Header/Footer; Sprint 5 ships the conversion-grade home.
export default function Home() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-8"
    >
      <h1 className="text-4xl font-semibold tracking-tight">AxionIA</h1>
      <p className="text-base text-zinc-600">
        Cabinet IA opérationnel · Sprint 0 — toolchain ready, content lands at Sprint 5.
      </p>
      <p className="text-sm text-zinc-500">
        Source de vérité : <code>../AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md</code> v6.
      </p>
    </main>
  );
}
