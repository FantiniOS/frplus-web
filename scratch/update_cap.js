const fs = require('fs');
let c = fs.readFileSync('src/app/captacao/central-precos/page.tsx', 'utf8');

c = c.replace(
    /<select value=\{clienteId\} onChange=\{\(e\) => setClienteId\(e.target.value\)\} className=\{inputClass\}>/,
    `<select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLocalNaoCadastrado(''); }} className={inputClass}>`
);

c = c.replace(
    /<option value="">-- Selecione --<\/option>/,
    `<option value="">-- Usar Local Avulso --</option>`
);

// We need to find the end of the div
c = c.replace(
    /<\/select>\s*\{clientes.length === 0 && \(\s*<p className="text-xs text-yellow-500 mt-2">.*<\/p>\s*\)\}\s*<\/div>/g,
    `</select>
                {clientes.length === 0 && (
                  <p className="text-xs text-yellow-500 mt-2">Você não possui clientes vinculados à sua carteira.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Local Avulso</label>
                <input
                  type="text"
                  value={localNaoCadastrado}
                  onChange={(e) => setLocalNaoCadastrado(e.target.value)}
                  placeholder="Ex: Supermercado Zezinho"
                  className={inputClass}
                  disabled={!!clienteId}
                />
              </div>`
);

fs.writeFileSync('src/app/captacao/central-precos/page.tsx', c, 'utf8');
