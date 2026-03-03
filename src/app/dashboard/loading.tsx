export default function DashboardLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* ===== HEADER SKELETON ===== */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div className="space-y-3">
                    <div className="h-4 w-24 bg-white/10 rounded"></div>
                    <div className="h-8 w-64 bg-white/20 rounded"></div>
                    <div className="h-4 w-40 bg-white/10 rounded"></div>
                </div>
                <div className="h-10 w-48 bg-white/10 rounded-xl"></div>
            </div>

            {/* ===== KPI CARDS SKELETON (Opcional para dar a robustez visual do dashboard) ===== */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="h-3 w-20 bg-white/10 rounded"></div>
                            <div className="h-6 w-6 rounded-lg bg-white/10"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-6 w-32 bg-white/20 rounded"></div>
                            <div className="h-3 w-24 bg-white/10 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== GRID 3 COLUNAS SKELETON (Inativos, Oportunidades, Alavancagem) ===== */}
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((col) => (
                    <div key={col} className="rounded-xl border border-white/10 bg-white/5 p-4">

                        {/* Título da Coluna Falso */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 rounded bg-white/20"></div>
                                <div className="h-4 w-32 bg-white/20 rounded"></div>
                            </div>
                            <div className="h-5 w-8 bg-white/10 rounded-full"></div>
                        </div>

                        {/* 5 Blocos Retangulares (Clientes) */}
                        <div className="space-y-2.5">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <div key={item} className="p-3 rounded-lg bg-white/5 flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="h-3 w-2/3 bg-white/20 rounded"></div>
                                        <div className="h-4 w-6 bg-white/10 rounded"></div>
                                    </div>
                                    <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                                </div>
                            ))}
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
