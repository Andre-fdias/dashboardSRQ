// Frota API - Integração completa e robusta com a planilha do controle_frota
// Fonte de dados: https://docs.google.com/spreadsheets/d/1LvqrPR_KCD7WpZ-zr9Ow2YXIqIUYrh3dtKlGiBXX4FQ

const SPREADSHEET_ID = '1LvqrPR_KCD7WpZ-zr9Ow2YXIqIUYrh3dtKlGiBXX4FQ';

function normalizePrefix(val) {
    if (!val) return '';
    const s = String(val).toUpperCase().trim().replace(/\s+/g, '-');
    const m = s.match(/^([A-Z]+)[-_]?(\d+)$/);
    if (m) return `${m[1]}-${m[2]}`;
    return s;
}

function parseSheetDate(val) {
    if (!val) return '';
    if (typeof val === 'string' && val.startsWith('Date(')) {
        const parts = val.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/);
        if (parts) {
            const year = parts[1];
            const month = String(Number(parts[2]) + 1).padStart(2, '0');
            const day = parts[3].padStart(2, '0');
            if (parts[4] !== undefined) {
                const hour = parts[4].padStart(2, '0');
                const min = (parts[5] || '0').padStart(2, '0');
                if (year === '1899') {
                    return `${hour}:${min}`;
                }
                return `${day}/${month}/${year} ${hour}:${min}`;
            }
            if (year === '1899') return '';
            return `${day}/${month}/${year}`;
        }
    }
    return String(val).trim();
}

function parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim().replace(/[R$\s]/g, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function dateToSortKey(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    // 1. DD/MM/YYYY HH:mm ou DD/MM/YYYY
    const mDmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (mDmy) {
        const day = parseInt(mDmy[1], 10);
        const month = parseInt(mDmy[2], 10) - 1;
        const year = parseInt(mDmy[3], 10);
        const hour = mDmy[4] ? parseInt(mDmy[4], 10) : 0;
        const min = mDmy[5] ? parseInt(mDmy[5], 10) : 0;
        const sec = mDmy[6] ? parseInt(mDmy[6], 10) : 0;
        return new Date(year, month, day, hour, min, sec).getTime();
    }
    // 2. YYYY-MM-DD HH:mm ou YYYY-MM-DD
    const mYmd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (mYmd) {
        const year = parseInt(mYmd[1], 10);
        const month = parseInt(mYmd[2], 10) - 1;
        const day = parseInt(mYmd[3], 10);
        const hour = mYmd[4] ? parseInt(mYmd[4], 10) : 0;
        const min = mYmd[5] ? parseInt(mYmd[5], 10) : 0;
        const sec = mYmd[6] ? parseInt(mYmd[6], 10) : 0;
        return new Date(year, month, day, hour, min, sec).getTime();
    }
    const t = Date.parse(s);
    return isNaN(t) ? 0 : t;
}

function getSheetUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchSheet(sheetName) {
    const url = getSheetUrl(sheetName);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar ${sheetName}`);
        
        const text = await response.text();
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (!jsonMatch || jsonMatch.length < 2) throw new Error("Formato inválido do Google Sheets GViz");
        
        const data = JSON.parse(jsonMatch[1]);
        if (data.status === 'error') throw new Error(data.errors?.[0]?.message || 'Erro GViz');
        
        const table = data.table;
        const rows = table.rows || [];
        const cols = table.cols || [];
        
        let headers = cols.map(c => (c.label || '').trim());
        let dataStartIndex = 0;
        
        // Verifica se os cabeçalhos estão nas primeiras linhas de dados
        const hasPrefixo = headers.some(h => /prefixo|viatura/i.test(h));
        if (!hasPrefixo) {
            for (let i = 0; i < Math.min(5, rows.length); i++) {
                const rowVals = (rows[i].c || []).map(cell => cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : '');
                if (rowVals.some(v => /prefixo|viatura/i.test(v))) {
                    headers = rowVals.map((val, idx) => val || headers[idx] || `COL_${idx}`);
                    dataStartIndex = i + 1;
                    break;
                }
            }
        }
        
        const records = [];
        for (let i = dataStartIndex; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.c) continue;
            
            const item = {};
            let hasContent = false;
            
            row.c.forEach((cell, colIdx) => {
                const header = headers[colIdx] || `COL_${colIdx}`;
                if (header) {
                    let val = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
                    val = parseSheetDate(val);
                    item[header] = val;
                    if (val !== '') hasContent = true;
                }
            });
            
            if (hasContent) {
                records.push(item);
            }
        }
        
        return records;
    } catch (err) {
        console.warn(`[FrotaAPI] Falha ao carregar sheet "${sheetName}":`, err.message);
        return [];
    }
}

// Objeto de dados centralizado
window.frotaData = {
    loading: false,
    loaded: false,
    error: null,
    
    // Matrizes brutas
    rawCadastro: [],
    rawChecklists: [],
    rawAbastecimentos: [],
    rawRevisoes: [],
    
    // Estruturas processadas
    vehiclesMap: new Map(),
    vehiclesList: [],
    checklistsList: [],
    avariasList: [],
    abastecimentosList: [],
    
    // Métodos utilitários
    getVehicle(prefixo) {
        const norm = normalizePrefix(prefixo);
        return this.vehiclesMap.get(norm) || null;
    },
    
    getAllVehicles() {
        return this.vehiclesList;
    },
    
    getAllChecklists() {
        return this.checklistsList;
    },
    
    getAllAvarias() {
        return this.avariasList;
    },

    getAllAbastecimentos() {
        return this.abastecimentosList;
    }
};

window.loadFrotaData = async function() {
    if (window.frotaData.loading) return;
    window.frotaData.loading = true;
    console.log("[FrotaAPI] Carregando planilhas da frota...");
    
    try {
        const [cadastros, checklists, abastecimentos, revisoes] = await Promise.all([
            fetchSheet('Detalhamento_Viaturas'),
            fetchSheet('Checklist_Diario'),
            fetchSheet('Abastecimentos'),
            fetchSheet('Controle_Revisoes')
        ]);
        
        window.frotaData.rawCadastro = cadastros;
        window.frotaData.rawChecklists = checklists;
        window.frotaData.rawAbastecimentos = abastecimentos;
        window.frotaData.rawRevisoes = revisoes;
        
        processFrotaData(cadastros, checklists, abastecimentos, revisoes);
        
        window.frotaData.loaded = true;
        window.frotaData.loading = false;
        console.log(`[FrotaAPI] Sucesso! ${window.frotaData.vehiclesList.length} viaturas, ${window.frotaData.checklistsList.length} checklists, ${window.frotaData.avariasList.length} avarias, ${window.frotaData.abastecimentosList.length} abastecimentos.`);
        
        window.dispatchEvent(new CustomEvent('frotaDataLoaded'));
        
        // Atualiza a página atual se for uma das abas de frota
        const currentRoute = (window.location.hash || '').replace('#', '').split('?')[0];
        if (currentRoute === 'viaturas' && window.updateViaturasTab) window.updateViaturasTab();
        else if (currentRoute === 'detalhamento' && window.updateDetalhamentoTab) window.updateDetalhamentoTab();
        else if (currentRoute === 'checklist' && window.updateChecklistTab) window.updateChecklistTab();
        else if (currentRoute === 'avarias' && window.updateAvariasTab) window.updateAvariasTab();
        else if (currentRoute === 'abastecimento' && window.updateAbastecimentoTab) window.updateAbastecimentoTab();
        
    } catch (err) {
        console.error("[FrotaAPI] Erro ao carregar frota:", err);
        window.frotaData.loading = false;
        window.frotaData.error = err.message;
    }
};

function processFrotaData(cadastros, checklists, abastecimentos, revisoes) {
    const vehiclesMap = new Map();
    const checklistsList = [];
    const avariasList = [];
    const abastecimentosList = [];
    
    // 1. Cria os registros de Viaturas com base em Detalhamento_Viaturas (apenas São Roque)
    cadastros.forEach(row => {
        // Encontra o prefixo
        let rawPrefix = row['PREFIXO'] || row['Prefixo'] || row['Viatura'] || row['VIATURA'] || '';
        if (!rawPrefix) {
            // Tenta achar qualquer coluna com 'prefix'
            const key = Object.keys(row).find(k => /prefixo/i.test(k));
            if (key) rawPrefix = row[key];
        }
        
        const prefixo = normalizePrefix(rawPrefix);
        if (!prefixo) return;
        
        const pertenceEstacao = (row['PERTENCE A QUAL ESTAÇÃO?'] || '').trim().toUpperCase();
        const estaEstacao = (row['ESTÁ EM QUAL ESTAÇÃO?'] || '').trim().toUpperCase();
        const opmcbRaw = (row['OPMCB'] || row['OPM/CB'] || row['Município / Unidade'] || '').trim();
        
        // Filtra estritamente viaturas pertencentes a São Roque ou que estejam em São Roque
        const isSaoRoque = pertenceEstacao.includes('ROQUE') || estaEstacao.includes('ROQUE') || opmcbRaw.toUpperCase().includes('ROQUE');
        if (!isSaoRoque) return;
        
        const status = (row['STATUS'] || row['Status'] || row['Status Atual'] || 'OPERANDO').trim();
        const placa = (row['PLACA'] || row['Placa'] || '').trim();
        const modelo = (row['Modelo'] || row['MODELO'] || '').trim();
        const fabricante = (row['Fabricante'] || row['FABRICANTE'] || '').trim();
        const tipo = (row['Tipo'] || row['TIPO'] || '').trim();
        const baseEstacao = estaEstacao || pertenceEstacao || 'SÃO ROQUE';
        const sgb = (row['SGB'] || row['sgb'] || '2º SGB').trim();
        const garagem = (row['GARAGEM'] || row['Garagem'] || '').trim();
        const ano = (row['Ano Mod.'] || row['Ano Fabr.'] || row['ANO'] || row['Ano'] || '').trim();
        const chassi = (row['Chassi'] || row['CHASSI'] || '').trim();
        const combustivel = (row['Combustível'] || row['COMBUSTÍVEL'] || '').trim();
        
        const vtrObj = {
            prefixo,
            cadastro: {
                prefixo,
                placa,
                modelo,
                fabricante,
                tipo,
                opmcb: baseEstacao,
                sgb,
                status,
                garagem,
                ano,
                chassi,
                renavam: '-',
                combustivel
            },
            checklists: [],
            abastecimentos: [],
            revisoes: [],
            alertas: [],
            metricas: {
                kmAtual: 0,
                gastoTotal: 0,
                litrosTotal: 0,
                consumoMedio: 0,
                totalChecklists: 0,
                totalAvarias: 0
            }
        };
        
        vehiclesMap.set(prefixo, vtrObj);
    });
    
    // 2. Processa Abastecimentos
    abastecimentos.forEach(row => {
        let rawPrefix = row['Prefixo'] || row['PREFIXO'] || row['Viatura'] || '';
        if (!rawPrefix) {
            const key = Object.keys(row).find(k => /prefixo/i.test(k));
            if (key) rawPrefix = row[key];
        }
        const prefixo = normalizePrefix(rawPrefix);
        if (!prefixo) return;
        
        const pelotaoEstacao = (row['Pelotão / Estação'] || '').trim().toUpperCase();
        // Inclui abastecimento se a viatura pertencer a São Roque OU se o abastecimento foi feito no pelotão de São Roque
        const isVtrSR = vehiclesMap.has(prefixo);
        const isPelotaoSR = pelotaoEstacao.includes('ROQUE');
        if (!isVtrSR && !isPelotaoSR) return;
        
        const km = parseNumber(row['KM'] || row['Km'] || row['Hodômetro'] || row['Hodometro']);
        const litros = parseNumber(row['Volume (L)'] || row['Volume'] || row['Litros'] || row['LITROS'] || row['Quantidade (Litros)'] || row['Qtd']);
        const valorTotal = parseNumber(row['Valor (R$)'] || row['Valor Total (R$)'] || row['Valor Total'] || row['VALOR TOTAL'] || row['Valor'] || row['VALOR']);
        const data = row['Data'] || row['DATA'] || '';
        const responsavel = row['Responsável pelo Abastecimento'] || row['Responsável'] || row['Motorista'] || '-';
        const posto = row['Posto de Combustível'] || row['Posto / Estabelecimento'] || row['Posto'] || '-';
        const tipoCombustivel = row['Combustível'] || row['Tipo de Combustível'] || '-';
        const consumoKmL = parseNumber(row['Consumo (Km/L)'] || row['Consumo'] || row['Km/L']);
        const placa = row['Placa'] || row['PLACA'] || '-';
        
        const item = {
            prefixo,
            placa,
            data,
            km,
            litros,
            valorTotal,
            responsavel,
            posto,
            tipoCombustivel,
            consumoKmL,
            pelotao: pelotaoEstacao,
            sortKey: dateToSortKey(data),
            raw: row
        };
        
        abastecimentosList.push(item);
        
        if (vehiclesMap.has(prefixo)) {
            vehiclesMap.get(prefixo).abastecimentos.push(item);
        }
    });
    
    // 3. Processa Checklists Diários
    checklists.forEach(row => {
        let rawPrefix = row['PREFIXO'] || row['Prefixo'] || row['Viatura'] || '';
        if (!rawPrefix) {
            const key = Object.keys(row).find(k => /prefixo/i.test(k));
            if (key) rawPrefix = row[key];
        }
        const prefixo = normalizePrefix(rawPrefix);
        if (!prefixo) return;
        
        const estacaoChecklist = (row['Informe Estação de Bombeiros'] || '').trim().toUpperCase();
        // Inclui checklist se a viatura é de São Roque OU se o preenchimento foi na estação de São Roque
        const isVtrSR = vehiclesMap.has(prefixo);
        const isEstacaoSR = estacaoChecklist.includes('ROQUE');
        if (!isVtrSR && !isEstacaoSR) return;
        
        const dataPreenchimento = row['Data Preenchimento'] || row['Carimbo de data/hora'] || row['Data'] || '';
        const horaPreenchimento = row['Hora Preenchimento'] || '';
        const dataHora = horaPreenchimento ? `${dataPreenchimento} ${horaPreenchimento}` : dataPreenchimento;
        
        const hodometro = parseNumber(row['ODOMETRO'] || row['Odômetro'] || row['KM Atual'] || row['Km Atual']);
        const responsavel = row['RE DIG Militar (Graduação RE-DIG Nome Completo)'] || row['Motorista'] || row['Responsável'] || '-';
        const equipe = (row['Equipe de Serviço'] || row['EQUIPE / PRONTIDÃO'] || row['Equipe'] || row['Prontidão'] || '-').trim();
        
        // Formata Dia da Prontidão (se vier em formato GMT longo, converte para dd/mm/aaaa)
        let diaProntidaoRaw = row['Dia da Prontidão'] || '';
        let diaProntidao = diaProntidaoRaw;
        if (diaProntidaoRaw) {
            const dObj = new Date(diaProntidaoRaw);
            if (!isNaN(dObj.getTime())) {
                diaProntidao = dObj.toLocaleDateString('pt-BR');
            }
        }
        
        const novidades = (row['RELATAR AS NOVIDADES QUANDO HOUVER'] || row['Novidades'] || row['Anomalias'] || '').trim();
        
        // Verifica itens avaliados (tudo que não for cabeçalho fixo)
        const itensInspecao = [];
        let temAvaria = false;
        
        const fixedCols = [
            'PREFIXO', 'Prefixo', 'Data Preenchimento', 'Hora Preenchimento', 
            'ODOMETRO', 'RE DIG Militar (Graduação RE-DIG Nome Completo)', 
            'EQUIPE / PRONTIDÃO', 'Equipe de Serviço', 'Dia da Prontidão',
            'RELATAR AS NOVIDADES QUANDO HOUVER', 'Carimbo de data/hora', 'Informe Estação de Bombeiros'
        ];
        
        Object.keys(row).forEach(key => {
            const keyClean = key.trim();
            const keyLower = keyClean.toLowerCase();
            const isFixed = fixedCols.some(fc => fc.trim().toLowerCase() === keyLower) ||
                            keyClean.startsWith('COL_') ||
                            /^(prefixo|odometro|odômetro|carimbo|equipe|prontid[aã]o|dia da prontid|relatar as novidades|informe esta)/i.test(keyClean);
            
            if (!isFixed) {
                const val = String(row[key] || '').trim();
                if (val) {
                    const norm = val.toUpperCase();
                    // Perguntas cujo default/esperado é 'NÃO' (ex: check up longo e engraxamento)
                    const normalizedKey = keyClean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const isDefaultNao = /check[\s_-]*up[\s_-]*longo|engraxamento/i.test(normalizedKey);
                    
                    let isOk = false;
                    if (isDefaultNao) {
                        // Para estas perguntas, default é NÃO. Somente fica vermelho (avaria/alerta) se for SIM
                        const isSim = (norm === 'SIM' || norm === 'S' || norm === 'TRUE' || norm === '1');
                        isOk = !isSim;
                    } else {
                        // Perguntas normais: considera OK apenas respostas explicitamente conformes
                        isOk = (norm === 'OK' || norm === 'CONFORME' || norm === 'C/N' || norm === 'C' || norm === 'NORMAL');
                    }

                    if (!isOk) temAvaria = true;
                    itensInspecao.push({ item: keyClean, valor: val, ok: isOk });
                }
            }
        });
        
        const benignRegex = /^(ok|tudo ok|sem novidades|s\/n|s\/a|sem alteração|sem alteracao|sem alteracoes|nada a relatar|nada consta|não há|nao ha|nenhuma|nil|-|conforme|normal)$/i;
        const hasRealNovidade = novidades && !benignRegex.test(novidades);
        if (hasRealNovidade) {
            temAvaria = true;
        }
        
        const chkItem = {
            id: `chk_${prefixo}_${checklistsList.length + 1}`,
            prefixo,
            dataHora,
            data: dataPreenchimento,
            hora: horaPreenchimento,
            diaProntidao,
            hodometro,
            responsavel,
            equipe,
            estacao: estacaoChecklist,
            novidades,
            temAvaria,
            itensInspecao,
            sortKey: dateToSortKey(dataHora || dataPreenchimento),
            raw: row
        };
        
        checklistsList.push(chkItem);
        
        // Se houver avarias reais, registra na lista geral de avarias
        if (temAvaria) {
            const desc = hasRealNovidade ? novidades : (itensInspecao.filter(i => !i.ok).map(i => `${i.item}: ${i.valor}`).join('; ') || 'Anomalia reportada no checklist');
            avariasList.push({
                prefixo,
                data: dataHora || dataPreenchimento,
                sortKey: chkItem.sortKey,
                responsavel,
                base: vehiclesMap.get(prefixo)?.cadastro?.opmcb || 'SÃO ROQUE',
                descricao: desc,
                checklistId: chkItem.id
            });
        }
        
        if (vehiclesMap.has(prefixo)) {
            vehiclesMap.get(prefixo).checklists.push(chkItem);
        }
    });
    
    // 4. Processa Revisões
    revisoes.forEach(row => {
        let rawPrefix = row['Prefixo'] || row['PREFIXO'] || row['Viatura'] || '';
        const prefixo = normalizePrefix(rawPrefix);
        if (!prefixo) return;
        if (!vehiclesMap.has(prefixo)) return;
        
        const dataStr = row['Data'] || row['DATA'] || '';
        const item = {
            prefixo,
            data: dataStr,
            sortKey: dateToSortKey(dataStr),
            km: parseNumber(row['KM'] || row['Km']),
            tipo: row['Tipo de Manutenção / Revisão'] || row['Tipo'] || 'Revisão Preventiva',
            descricao: row['Descrição / Peças Trocadas'] || row['Descrição'] || '-',
            status: row['Status'] || 'Concluída',
            raw: row
        };
        
        vehiclesMap.get(prefixo).revisoes.push(item);
    });
    
    // 5. Calcula métricas consolidadas por viatura e ordena eventos cronologicamente em ordem decrescente
    vehiclesMap.forEach((vtr, pfx) => {
        // Ordena checklists por data decrescente (timestamp mais recente primeiro)
        vtr.checklists.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
        // Ordena abastecimentos por data decrescente
        vtr.abastecimentos.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
        // Ordena revisões por data decrescente
        vtr.revisoes.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
        
        // KM Atual (maior valor entre último checklist ou abastecimento)
        const lastChkKm = vtr.checklists.length > 0 ? (vtr.checklists[0].hodometro || 0) : 0;
        const lastAbsKm = vtr.abastecimentos.length > 0 ? (vtr.abastecimentos[0].km || 0) : 0;
        vtr.metricas.kmAtual = Math.max(lastChkKm, lastAbsKm);
        
        // Abastecimento acumulado
        let gastoTotal = 0;
        let litrosTotal = 0;
        vtr.abastecimentos.forEach(a => {
            gastoTotal += a.valorTotal;
            litrosTotal += a.litros;
        });
        vtr.metricas.gastoTotal = gastoTotal;
        vtr.metricas.litrosTotal = litrosTotal;
        
        // Consumo médio (se tiver pelo menos 2 abastecimentos com km)
        if (vtr.abastecimentos.length >= 2 && litrosTotal > 0) {
            const sortedAsc = [...vtr.abastecimentos].sort((a, b) => a.km - b.km);
            const kmDelta = sortedAsc[sortedAsc.length - 1].km - sortedAsc[0].km;
            if (kmDelta > 0 && litrosTotal > 0) {
                vtr.metricas.consumoMedio = kmDelta / litrosTotal;
            }
        }
        
        vtr.metricas.totalChecklists = vtr.checklists.length;
        const avariasVtr = vtr.checklists.filter(c => c.temAvaria);
        vtr.metricas.totalAvarias = avariasVtr.length;
        
        // Alertas
        if (avariasVtr.length > 0) {
            vtr.alertas.push({
                tipo: 'Avaria Reportada',
                mensagem: `${avariasVtr.length} checklist(s) com anomalias registradas.`
            });
        }
        
        const statusUp = (vtr.cadastro.status || '').toUpperCase();
        if (statusUp.includes('BAIXAD')) {
            vtr.alertas.push({
                tipo: 'Viatura Baixada',
                mensagem: 'Viatura indisponível para operação no momento.'
            });
        }
    });
    
    // Atualiza listas globais ordenadas estritamente em ordem decrescente de data
    window.frotaData.vehiclesMap = vehiclesMap;
    window.frotaData.vehiclesList = Array.from(vehiclesMap.values()).sort((a, b) => a.prefixo.localeCompare(b.prefixo));
    window.frotaData.checklistsList = checklistsList.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
    window.frotaData.avariasList = avariasList.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
    window.frotaData.abastecimentosList = abastecimentosList.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
}

// Inicia imediatamente o carregamento assíncrono dos dados da Frota
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.loadFrotaData());
} else {
    window.loadFrotaData();
}
