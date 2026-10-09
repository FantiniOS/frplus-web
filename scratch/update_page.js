const fs = require('fs');
let c = fs.readFileSync('src/app/dashboard/central-precos/page.tsx', 'utf8');

c = c.replace(
\    const [formClienteId, setFormClienteId] = useState('');\,
\    const [formClienteId, setFormClienteId] = useState('');
    const [formLocalNaoCadastrado, setFormLocalNaoCadastrado] = useState('');\
);

c = c.replace(
\    const resetFormPreco = () => {
        setEditRegistroId(null);
        setFormClienteId('');\,
\    const resetFormPreco = () => {
        setEditRegistroId(null);
        setFormClienteId('');
        setFormLocalNaoCadastrado('');\
);

c = c.replace(
\    const handleEditClick = (registro: RegistroPreco) => {
        setEditRegistroId(registro.id);
        setFormClienteId(registro.clienteId || '');\,
\    const handleEditClick = (registro: RegistroPreco) => {
        setEditRegistroId(registro.id);
        setFormClienteId(registro.clienteId || '');
        setFormLocalNaoCadastrado(registro.localNaoCadastrado || '');\
);

c = c.replace(
\                    clienteId: formClienteId || null,
                    produtoBase: formProdutoNome,\,
\                    clienteId: formClienteId || null,
                    localNaoCadastrado: formLocalNaoCadastrado || null,
                    produtoBase: formProdutoNome,\
);

c = c.replace(
\                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Cliente / PDV (opcional)</label>
                                    <select value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)} className={inputClass}>
                                        <option value="">Sem cliente vinculado</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
                                        ))}
                                    </select>
                                </div>\,
\                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Cliente / PDV (opcional)</label>
                                        <select value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)} className={inputClass}>
                                            <option value="">Nenhum (usar Local Avulso)</option>
                                            {clientes.map(c => (
                                                <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Local Avulso (se não cadastrado)</label>
                                        <input
                                            type="text"
                                            value={formLocalNaoCadastrado}
                                            onChange={(e) => setFormLocalNaoCadastrado(e.target.value)}
                                            placeholder="Ex: Supermercado Zezinho"
                                            className={inputClass}
                                            disabled={!!formClienteId}
                                        />
                                    </div>
                                </div>\
);

c = c.replace(
\            menorLocal: menorRegistro ? \\\\\\ no cliente \\\\\\ : ''\,
\            menorLocal: menorRegistro ? \\\\\\ no local \\\\\\ : ''\
);

// We need to fix the interface RegistroPreco in the top of the file
c = c.replace(
\    vendedorId: string | null;\,
\    vendedorId: string | null;
    localNaoCadastrado: string | null;\
);

// We need to fix the table rendering
c = c.replace(
\                                                    {r.cliente ? (r.cliente.nomeFantasia || r.cliente.razaoSocial) : '-'}
                                                </span>\,
\                                                    {r.cliente ? (r.cliente.nomeFantasia || r.cliente.razaoSocial) : (r.localNaoCadastrado || '-')}
                                                </span>\
);


fs.writeFileSync('src/app/dashboard/central-precos/page.tsx', c, 'utf8');
