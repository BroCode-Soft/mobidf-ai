import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-600 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center text-white">
        <h1 className="text-5xl font-black tracking-tight">MobiDF AI</h1>
        <p className="mt-2 text-brand-50 text-lg">Mobilidade Inteligente para o Distrito Federal</p>
        <p className="mt-1 text-brand-50/70 text-sm">Sem obras. Só dados.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/gestor"
          className="flex-1 bg-white text-brand-700 font-bold text-center py-4 px-6 rounded-2xl shadow-lg hover:bg-brand-50 transition"
        >
          Dashboard Gestor
          <span className="block text-xs font-normal text-gray-500 mt-0.5">SEMOB / B2G</span>
        </Link>
        <Link
          href="/cidadao"
          className="flex-1 bg-brand-500 text-white font-bold text-center py-4 px-6 rounded-2xl shadow-lg hover:bg-brand-600 transition border border-brand-400"
        >
          App Cidadão
          <span className="block text-xs font-normal text-brand-100 mt-0.5">Reserve seu lugar</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl text-center text-white/80 text-xs">
        {[
          ["ODS 11", "Cidades Sustentáveis"],
          ["ODS 9", "Inovação"],
          ["ODS 10", "Menos Desigualdade"],
          ["ODS 13", "Ação Climática"],
        ].map(([ods, desc]) => (
          <div key={ods} className="bg-white/10 rounded-xl p-3">
            <div className="font-bold text-white text-sm">{ods}</div>
            <div>{desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
