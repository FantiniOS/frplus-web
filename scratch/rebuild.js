const cp = require('child_process');
const fs = require('fs');

let content = cp.execSync('git show 72797a3:src/app/dashboard/central-precos/page.tsx').toString('utf8');

content = content.replace("BadgeDollarSign } from 'lucide-react';", "BadgeDollarSign, Edit2, Trash2, CheckCircle } from 'lucide-react';");

content = content.replace(
\    // Modal: Registrar Preço
    const [showRegistrar, setShowRegistrar] = useState(false);
    const [formClienteId, setFormClienteId] = useState('');\,
\    // Modal: Registrar Preço
    const [showRegistrar, setShowRegistrar] = useState(false);
    const [editRegistroId, setEditRegistroId] = useState<string | null>(null);
    const [formClienteId, setFormClienteId] = useState('');\
);

content = content.replace(
\    // Modal: Gerenciar Marcas
    const [showMarcas, setShowMarcas] = useState(false);
    const [novaMarca, setNovaMarca] = useState('');
    const [savingMarca, setSavingMarca] = useState(false);
    const [erroMarca, setErroMarca] = useState('');\,
\    // Modal: Gerenciar Marcas
    const [showMarcas, setShowMarcas] = useState(false);
    const [novaMarca, setNovaMarca] = useState('');
    const [savingMarca, setSavingMarca] = useState(false);
    const [erroMarca, setErroMarca] = useState('');
    
    // Edição de Marca inline
    const [editMarcaId, setEditMarcaId] = useState<string | null>(null);
    const [editMarcaNome, setEditMarcaNome] = useState('');\
);

content = content.replace(
\    const resetFormPreco = () => {
        setFormClienteId('');\,
\    const resetFormPreco = () => {
        setEditRegistroId(null);
        setFormClienteId('');\
);

content = content.replace(
\    const handleRegistrarPreco = async () => {\,
\    const handleEditClick = (registro: RegistroPreco) => {
        setEditRegistroId(registro.id);
        setFormClienteId(registro.clienteId || '');
        setFormProdutoNome(registro.produtoBase);
        setFormMarcaId(registro.marcaConcorrente?.id || '');
        setFormPreco(registro.precoPrateleira.toString().replace('.', ','));
        setErroPreco('');
        setShowRegistrar(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!confirm('Deseja realmente excluir este registro?')) return;
        try {
            const res = await fetch(\\\/api/central-precos/\\\\\\, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao excluir');
            fetchRegistros();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir registro');
        }
    };

    const handleRegistrarPreco = async () => {\
);

content = content.replace(
\        try {
            const res = await fetch('/api/central-precos', {
                method: 'POST',\,
\        try {
            const url = editRegistroId ? \\\/api/central-precos/\\\\\\ : '/api/central-precos';
            const method = editRegistroId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,\
);

content = content.replace(
\    const handleCriarMarca = async () => {\,
\    const handleSalvarMarcaEditada = async () => {
        if (!editMarcaNome.trim() || !editMarcaId) return;
        setSavingMarca(true);
        setErroMarca('');
        try {
            const res = await fetch(\\\/api/marcas-concorrentes/\\\\\\, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: editMarcaNome })
            });
            const data = await res.json();
            if (!res.ok) {
                setErroMarca(data.error || 'Erro ao editar marca.');
                return;
            }
            setEditMarcaId(null);
            fetchMarcas();
        } catch (e) {
            setErroMarca('Erro de conexão ao editar marca.');
        } finally {
            setSavingMarca(false);
        }
    };

    const handleDeleteMarca = async (id: string) => {
        if (!confirm('Deseja realmente excluir esta marca?')) return;
        setSavingMarca(true);
        setErroMarca('');
        try {
            const res = await fetch(\\\/api/marcas-concorrentes/\\\\\\, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) {
                setErroMarca(data.error || 'Erro ao excluir marca.');
                return;
            }
            fetchMarcas();
        } catch (e) {
            setErroMarca('Erro ao excluir marca.');
        } finally {
            setSavingMarca(false);
        }
    };

    const handleCriarMarca = async () => {\
);

content = content.replace(
\<th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Quem Coletou</th>
                            </tr>\,
\<th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Quem Coletou</th>
                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-2.5">Ações</th>
                            </tr>\
);

content = content.replace(\colSpan={6}\, \colSpan={7}\);
content = content.replace(\colSpan={6}\, \colSpan={7}\);

content = content.replace(
\                                                )}
                                            </td>
                                        </tr>\,
\                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEditClick(r)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors" title="Editar">
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(r.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Excluir">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>\
);

content = content.replace(
\<h3 className="text-xl font-bold text-white">Registrar Preço Coletado</h3>\,
\<h3 className="text-xl font-bold text-white">{editRegistroId ? 'Editar Preço' : 'Registrar Preço Coletado'}</h3>\
);

content = content.replace(
\{savingPreco ? 'Salvando...' : 'Salvar Coleta'}\,
\{savingPreco ? 'Salvando...' : (editRegistroId ? 'Salvar Alterações' : 'Salvar Coleta')}\
);

content = content.replace(
\                                        <div
                                            key={m.id}
                                            className={\\\lex items-center justify-between px-3 py-2 border-b border-white/[0.03] \\\\\\}
                                        >
                                            <span className="text-sm text-gray-200">{m.nome}</span>
                                            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                {m._count?.centralPrecos ?? 0} coletas
                                            </span>
                                        </div>\,
\                                        <div
                                            key={m.id}
                                            className={\\\lex items-center justify-between px-3 py-2 border-b border-white/[0.03] \\\\\\}
                                        >
                                            {editMarcaId === m.id ? (
                                                <div className="flex w-full items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editMarcaNome}
                                                        onChange={(e) => setEditMarcaNome(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarMarcaEditada(); }}
                                                        className="w-full rounded-lg bg-black/40 border border-white/10 p-1 px-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                    <button onClick={handleSalvarMarcaEditada} className="p-1 rounded text-emerald-400 hover:bg-emerald-400/10" title="Salvar">
                                                        <CheckCircle className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => setEditMarcaId(null)} className="p-1 rounded text-gray-400 hover:bg-white/10" title="Cancelar">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-sm text-gray-200">{m.nome}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                            {m._count?.centralPrecos ?? 0} coletas
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => { setEditMarcaId(m.id); setEditMarcaNome(m.nome); }} className="text-gray-500 hover:text-blue-400 p-1">
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={() => handleDeleteMarca(m.id)} className="text-gray-500 hover:text-red-400 p-1">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>\
);

fs.writeFileSync('src/app/dashboard/central-precos/page.tsx', content, 'utf8');
