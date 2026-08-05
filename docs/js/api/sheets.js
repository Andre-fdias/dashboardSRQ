/**
 * sheets.js
 * Responsável por buscar e fazer o parse da planilha Google (V2.0 com 19 colunas A-S)
 */

const BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTz-JkZhBDtC5rYVXhdKnaebtsBbOlY2Aj9jCjU-QdIHMjnPexh767DSWKru7LePHNJ_xdDw5R5octf/pub?output=xlsx';
const DEJEM_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQU7P_JQZtrnFFHFkI8HDIAMnM9cK2TZBL_TBUn2GdTvTV2a3aEs9qCm--6DOfRSQ/pub?output=xlsx';
const ABASTECIMENTO_URL = 'https://docs.google.com/spreadsheets/d/1Yddf9EORz6izjuYQhYBPN23edWIaJgxcb1qIXwu35A4/pub?output=xlsx';

export async function fetchSpreadsheetData() {
    const proxies = [
        BASE_URL,
        'https://corsproxy.io/?' + encodeURIComponent(BASE_URL),
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(BASE_URL)
    ];

    let allData = null;
    let lastError = null;

    for (const url of proxies) {
        try {
            console.log("Tentando baixar de:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength < 100) {
                throw new Error("Arquivo muito pequeno");
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            
            allData = [];
            console.log("Abas encontradas no arquivo Excel:", workbook.SheetNames);
            workbook.SheetNames.forEach(sheetName => {
                if (sheetName.toUpperCase() === 'LOG' || sheetName.toUpperCase().includes('RESUMO')) {
                    console.log(`Ignorando planilha de sistema/resumo: ${sheetName}`);
                    return;
                }

                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                // Novo Padrão ETL: Cabeçalho na linha 1 (index 0). Dados a partir da linha 2 (index 1).
                if (rawData.length > 1) {
                    const sheetData = processSheetData(rawData.slice(1), sheetName);
                    console.log(`Planilha ${sheetName} parseou ${sheetData.length} linhas de dados válidas.`);
                    allData = allData.concat(sheetData);
                } else {
                    console.warn(`Planilha ${sheetName} ignorada: Menos de 2 linhas encontradas.`);
                }
            });
            
            console.log("Sucesso no download e parse via:", url);
            break;
            
        } catch (error) {
            console.warn("Falha no proxy ou arquivo corrompido:", url, error.message);
            lastError = error;
        }
    }

    if (allData === null) {
        throw new Error("Todas as tentativas de baixar a planilha falharam: " + (lastError ? lastError.message : ""));
    }

    return allData;
}

/**
 * Processamento das 19 colunas (A a S) + Colunas técnicas calculadas em memória.
 */
function processSheetData(rows, sheetName) {
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const mesesNomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    return rows.map((row, index) => {
        // Ignora linhas totalmente vazias ou sem data/talão
        if (!row || row.length === 0 || !row[0] || !row[2]) return null;

        // Tratar a data
        let rawDate = row[0];
        let dateObj = null;
        if (rawDate instanceof Date) {
            dateObj = rawDate;
        } else if (typeof rawDate === 'string') {
            // Tenta dar parse (formato esperado dd/mm/yyyy)
            const parts = rawDate.split('/');
            if (parts.length === 3) {
                dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                dateObj = new Date(rawDate);
            }
        } else if (typeof rawDate === 'number') {
            dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        }

        if (!dateObj || isNaN(dateObj.getTime())) {
            console.warn("Linha rejeitada por data inválida:", row);
            return null;
        }

        // Cálculo de horas para Tempo Médio (G: TEMPO TOTAL em minutos)
        let tempoTotal = row[6] ? String(row[6]).trim().toLowerCase() : '';
        let tempoMinutos = 0;
        if (tempoTotal) {
            let hrs = 0;
            let mins = 0;
            const hMatch = tempoTotal.match(/(\d+)\s*h/);
            if (hMatch) hrs = parseInt(hMatch[1], 10);
            const mMatch = tempoTotal.match(/(\d+)\s*min/);
            if (mMatch) mins = parseInt(mMatch[1], 10);
            tempoMinutos = (hrs * 60) + mins;
        }

        // KM
        const kmSaida = parseFloat(row[8]) || 0;
        const kmChegada = parseFloat(row[9]) || 0;
        const distancia = parseFloat(row[10]) || (kmChegada >= kmSaida ? (kmChegada - kmSaida) : 0);

        // Colunas Calculadas
        const ano = dateObj.getFullYear();
        const mesIndex = dateObj.getMonth();
        const nomeMes = mesesNomes[mesIndex];
        const diaSemana = diasSemana[dateObj.getDay()];
        const talao = String(row[2]).trim();
        const idOcorrencia = `${ano}-${talao}`;

        // Extrai hora de saída (ex: "18:25" -> "18")
        const qtrSaida = row[4] ? String(row[4]).trim() : '';
        const horaSaida = qtrSaida.includes(':') ? qtrSaida.split(':')[0] : '';

        return {
            id: idOcorrencia,
            mes: sheetName,
            data: dateObj,
            prontidao: row[1] ? String(row[1]).toUpperCase().trim() : '',
            talao: talao,
            viatura: row[3] ? String(row[3]).toUpperCase().trim() : '',
            qtrSaida: qtrSaida,
            qtrChegada: row[5] ? String(row[5]).trim() : '',
            tempoTotal: tempoTotal,
            tempoMinutos: tempoMinutos,
            resultado: row[7] ? String(row[7]).toUpperCase().trim() : 'ATENDIDA',
            kmSaida: kmSaida,
            kmChegada: kmChegada,
            distancia: Math.round(distancia * 100) / 100,
            cmtVtr: row[11] ? String(row[11]).trim() : '', // L = CMT VTR
            natureza: row[12] ? String(row[12]).trim() : '', // M = NATUREZA
            vitimas: parseInt(row[13]) || 0, // N = VÍTIMAS
            vitimasFatais: parseInt(row[14]) || 0, // O = VÍTIMAS FATAIS
            endereco: row[15] ? String(row[15]).trim() : '', // P = ENDEREÇO
            cidade: row[16] ? String(row[16]).trim().toUpperCase() : '', // Q = CIDADE
            telegrafista: row[17] ? String(row[17]).trim() : '', // R = TELEGRAFISTA
            observacoes: row[18] ? String(row[18]).trim() : '', // S = OBSERVAÇÕES
            
            // Campos técnicas de apoio
            ano: ano,
            nomeMes: nomeMes,
            diaSemana: diaSemana,
            horaSaida: horaSaida
        };
    }).filter(row => row !== null);
}

// ==========================================
// DEJEM - Nova Lógica de Integração
// ==========================================

export async function fetchDejemData() {
    const proxies = [
        DEJEM_URL,
        'https://corsproxy.io/?' + encodeURIComponent(DEJEM_URL),
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(DEJEM_URL)
    ];

    let allData = null;
    let lastError = null;

    for (const url of proxies) {
        try {
            console.log("Tentando baixar DEJEM de:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength < 100) {
                throw new Error("Arquivo muito pequeno");
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const sheetName = 'Controle de ID DEJEM';
            
            if (workbook.SheetNames.includes(sheetName)) {
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
                // Dados começam na linha 3 (índice 2). Cabeçalhos na linha B3..
                if (rawData.length > 2) {
                    allData = processDejemSheetData(rawData.slice(2));
                    console.log(`DEJEM parseou ${allData.length} linhas de dados válidas.`);
                } else {
                    console.warn(`Planilha DEJEM ignorada: Sem dados suficientes.`);
                    allData = [];
                }
            } else {
                throw new Error("Aba 'Controle de ID DEJEM' não encontrada no arquivo.");
            }
            
            break;
            
        } catch (error) {
            console.warn("Falha no proxy DEJEM:", url, error.message);
            lastError = error;
        }
    }

    if (allData === null) {
        throw new Error("Todas as tentativas de baixar a planilha DEJEM falharam: " + (lastError ? lastError.message : ""));
    }

    return allData;
}

function processDejemSheetData(rows) {
    return rows.map((row) => {
        // Ignora linhas sem ID (coluna B = index 1)
        if (!row || !row[1]) return null;

        // Tratar a data (coluna E = index 4)
        let rawDate = row[4];
        let dateObj = null;
        if (rawDate instanceof Date) {
            dateObj = rawDate;
        } else if (typeof rawDate === 'string') {
            const parts = rawDate.split('/');
            if (parts.length === 3) dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            else dateObj = new Date(rawDate);
        } else if (typeof rawDate === 'number') {
            dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        }

        // B(1)=ID, C(2)=NOME, D(3)=ESCALADO, E(4)=DATA, F(5)=INICIO, G(6)=FIM, H(7)=EB
        
        // Parse seguro para hora
        const formatHora = (val) => {
            if (!val) return '';
            if (val instanceof Date) return val.getHours().toString().padStart(2,'0') + ':' + val.getMinutes().toString().padStart(2,'0');
            if (typeof val === 'number') {
                const totalMins = Math.round(val * 24 * 60);
                return Math.floor(totalMins / 60).toString().padStart(2,'0') + ':' + (totalMins % 60).toString().padStart(2,'0');
            }
            const s = String(val).trim();
            if (s.includes('1899') || s.includes('GMT')) {
                const d = new Date(s);
                if (!isNaN(d.getTime())) return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
            }
            return s;
        };

        return {
            id: String(row[1]).trim(),
            nome: row[2] ? String(row[2]).trim().toUpperCase() : '',
            escalado: row[3] ? String(row[3]).trim().toUpperCase() : '',
            data: dateObj && !isNaN(dateObj.getTime()) ? dateObj : null,
            horaInicio: formatHora(row[5]),
            horaFim: formatHora(row[6]),
            eb: row[7] ? String(row[7]).trim().toUpperCase() : ''
        };
    }).filter(row => row !== null);
}

// ==========================================
// ABASTECIMENTO - Nova Lógica de Integração
// ==========================================

export async function fetchAbastecimentoData() {
    const proxies = [
        ABASTECIMENTO_URL,
        'https://corsproxy.io/?' + encodeURIComponent(ABASTECIMENTO_URL),
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(ABASTECIMENTO_URL)
    ];

    let allData = null;
    let lastError = null;

    for (const url of proxies) {
        try {
            console.log("Tentando baixar ABASTECIMENTO de:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength < 100) {
                throw new Error("Arquivo muito pequeno");
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            
            // Tenta pegar a primeira aba
            if (workbook.SheetNames.length > 0) {
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
                // Dados começam na linha 2 (índice 1). Cabeçalhos na linha 1 (índice 0).
                if (rawData.length > 1) {
                    allData = processAbastecimentoSheetData(rawData.slice(1));
                    console.log(`ABASTECIMENTO parseou ${allData.length} linhas válidas de EB SÃO ROQUE.`);
                } else {
                    console.warn(`Planilha ABASTECIMENTO ignorada: Sem dados suficientes.`);
                    allData = [];
                }
            } else {
                throw new Error("Nenhuma aba encontrada na planilha de Abastecimento.");
            }
            
            break;
            
        } catch (error) {
            console.warn("Falha no proxy ABASTECIMENTO:", url, error.message);
            lastError = error;
        }
    }

    if (allData === null) {
        throw new Error("Todas as tentativas de baixar a planilha ABASTECIMENTO falharam: " + (lastError ? lastError.message : ""));
    }

    return allData;
}

function processAbastecimentoSheetData(rows) {
    return rows.map((row) => {
        // Ignorar linhas em branco ou que não sejam EB SÃO ROQUE (Coluna J = index 9)
        if (!row || !row[0]) return null;
        
        const pelotao = row[9] ? String(row[9]).trim().toUpperCase() : '';
        if (pelotao !== 'EB SÃO ROQUE') return null;

        // Tratar a data (coluna D = index 3)
        let rawDate = row[3];
        let dateObj = null;
        if (rawDate instanceof Date) {
            dateObj = rawDate;
        } else if (typeof rawDate === 'string') {
            const parts = rawDate.split('/');
            if (parts.length === 3) dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            else dateObj = new Date(rawDate);
        } else if (typeof rawDate === 'number') {
            dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        }

        // A(0)=Prefixo, B(1)=Responsável, C(2)=Placa, D(3)=Data, E(4)=Km, F(5)=Volume_L, G(6)=Valor, H(7)=Combustível, I(8)=Aditivo, J(9)=Pelotão, K(10)=POSTO
        
        // Parse de números
        const parseValor = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const clean = String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : n;
        };

        const parseVol = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const clean = String(val).replace(',', '.').trim();
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : n;
        };

        return {
            prefixo: String(row[0]).trim(),
            responsavel: row[1] ? String(row[1]).trim().toUpperCase() : '',
            placa: row[2] ? String(row[2]).trim().toUpperCase() : '',
            data: dateObj && !isNaN(dateObj.getTime()) ? dateObj : null,
            km: row[4] ? String(row[4]).trim() : '',
            volume: parseVol(row[5]),
            valor: parseValor(row[6]),
            combustivel: row[7] ? String(row[7]).trim().toUpperCase() : '',
            posto: row[10] ? String(row[10]).trim().toUpperCase() : ''
        };
    }).filter(row => row !== null);
}
