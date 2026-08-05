/**
 * ETL São Roque - Versão 2.0
 * Código para consolidação, validação, tratamento e normalização da Planilha Operacional.
 * Deve ser colado no editor de Apps Script (Extensões > Apps Script) do Google Sheets.
 */

const SOURCE_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTz-JkZhBDtC5rYVXhdKnaebtsBbOlY2Aj9jCjU-QdIHMjnPexh767DSWKru7LePHNJ_xdDw5R5octf/pub?output=xlsx";
const DESTINATION_SHEET_NAME = "Ocorrências São Roque";

// Executado na abertura da planilha destino
function onOpen() {
  criarMenu();
  configurarTrigger();
}

// Cria o menu personalizado
function criarMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ETL São Roque')
    .addItem('Atualizar Dados (Executar ETL)', 'executarETL')
    .addItem('Recalcular Distâncias', 'recalcularDistanciasMenu')
    .addItem('Recalcular Tempo Total', 'recalcularTempoTotalMenu')
    .addItem('Ver Log', 'verLogMenu')
    .addItem('Recriar Planilha Consolidada', 'recriarPlanilhaConsolidada')
    .addToUi();
}

// Configura o trigger para executar de 10 em 10 minutos
function configurarTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let triggerExiste = false;
  
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'executarETL') {
      triggerExiste = true;
      break;
    }
  }
  
  if (!triggerExiste) {
    ScriptApp.newTrigger('executarETL')
      .timeBased()
      .everyMinutes(10)
      .create();
  }
}

// Execução Principal do ETL
function executarETL() {
  const startTime = new Date();
  let logInfo = {
    dataHora: startTime,
    abasProcessadas: 0,
    linhasLidas: 0,
    linhasDescartadas: 0,
    linhasConsolidadas: 0,
    tempoTotal: 0,
    erros: []
  };

  try {
    // 1. Busca e processa a planilha de origem (somente leitura via Fetch)
    const response = UrlFetchApp.fetch(SOURCE_SPREADSHEET_URL);
    const blob = response.getBlob();
    
    // Como o Apps Script nativamente não processa XLSX de forma simples direta,
    // nós usaremos um arquivo temporário no Drive para converter e ler se necessário, 
    // ou se o Apps Script estiver rodando na própria planilha destino, 
    // assumimos que a planilha destino é onde gravamos os dados consolidados.
    
    // IMPORTANTE: Para o Apps Script ler o XLSX do fetch, nós o criamos temporariamente no Drive como planilha do Google.
    const resource = {
      title: 'Temp_ETL_Source',
      mimeType: MimeType.GOOGLE_SHEETS
    };
    
    // Utiliza a Drive API avançada para fazer a conversão
    const tempFile = Drive.Files.insert(resource, blob);
    const sourceSpreadsheet = SpreadsheetApp.openById(tempFile.id);
    const sheets = sourceSpreadsheet.getSheets();
    
    let dadosConsolidados = [];
    
    // 2. Itera por todas as abas
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      if (sheetName.toLowerCase().includes('log') || sheetName.toLowerCase().includes('config')) {
        return; // Ignora abas técnicas/administrativas
      }
      
      logInfo.abasProcessadas++;
      const lastRow = sheet.getLastRow();
      if (lastRow < 3) return; // Aba vazia
      
      const range = sheet.getRange(3, 1, lastRow - 2, 19); // Colunas A a S
      const values = range.getValues();
      
      // A primeira linha do range é a linha 3 (Cabeçalho)
      const dataRows = values.slice(1); // Linha 4 em diante
      
      dataRows.forEach(row => {
        logInfo.linhasLidas++;
        if (validarRegistro(row)) {
          const normalizado = normalizarRegistro(row);
          dadosConsolidados.push(normalizado);
        } else {
          logInfo.linhasDescartadas++;
        }
      });
    });
    
    // Remove o arquivo temporário do Drive
    Drive.Files.remove(tempFile.id);
    
    // 3. Ordena os dados consolidados (Data e depois Talão)
    dadosConsolidados.sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      if (dateA - dateB !== 0) return dateA - dateB;
      return parseInt(a[2]) - parseInt(b[2]); // Talão
    });
    
    // Formata a data para a escrita
    const dadosParaGravar = dadosConsolidados.map(row => {
      const formatada = row.slice();
      if (row[0] instanceof Date) {
        formatada[0] = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      return formatada;
    });

    // 4. Escreve os dados na planilha destino
    const destSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let destSheet = destSpreadsheet.getSheetByName(DESTINATION_SHEET_NAME);
    if (!destSheet) {
      destSheet = destSpreadsheet.insertSheet(DESTINATION_SHEET_NAME);
    }
    
    // Limpa os dados anteriores mantendo a estrutura
    destSheet.clearContents();
    
    // Escreve o Cabeçalho Oficial
    const cabecalho = [
      "DATA", "PRONTIDÃO", "TALÃO", "VTR", "QTR SAÍDA", "QTR CHEGADA", 
      "TEMPO TOTAL", "RESULTADO", "KM SAÍDA", "KM CHEGADA", "DISTÂNCIA (KM)", 
      "CMT VTR", "NATUREZA", "VÍTIMAS", "VÍTIMAS FATAIS", "ENDEREÇO", 
      "CIDADE", "TELEGRAFISTA", "OBSERVAÇÕES"
    ];
    destSheet.getRange(1, 1, 1, 19).setValues([cabecalho]);
    
    if (dadosParaGravar.length > 0) {
      destSheet.getRange(2, 1, dadosParaGravar.length, 19).setValues(dadosParaGravar);
      logInfo.linhasConsolidadas = dadosParaGravar.length;
    }
    
    logInfo.tempoTotal = (new Date() - startTime) / 1000;
    registrarLog(logInfo);
    
  } catch (err) {
    logInfo.erros.push(err.toString());
    logInfo.tempoTotal = (new Date() - startTime) / 1000;
    registrarLog(logInfo);
    throw err;
  }
}

// Lógica de Validação
function validarRegistro(row) {
  const data = row[0];
  const prontidao = row[1];
  const talao = row[2];
  const vtr = row[3];
  
  if (!data || !(data instanceof Date) || isNaN(data.getTime())) return false;
  if (!talao || isNaN(Number(talao)) || String(talao).trim() === '') return false;
  if (!vtr || String(vtr).trim() === '' || /^[-/.=]+$/.test(String(vtr))) return false;
  
  return true;
}

// Normalização dos registros
function normalizarRegistro(row) {
  let normal = new Array(19);
  
  // A - DATA
  normal[0] = row[0]; // Mantido como objeto Date para a ordenação
  
  // B - PRONTIDÃO
  const p = String(row[1]).toUpperCase().trim();
  if (p.includes("AMARELA")) normal[1] = "AMARELA";
  else if (p.includes("AZUL")) normal[1] = "AZUL";
  else if (p.includes("VERDE")) normal[1] = "VERDE";
  else normal[1] = p;

  // C - TALÃO
  normal[2] = Number(row[2]);

  // D - VTR
  normal[3] = String(row[3]).trim().replace(/\s+/g, ' ');

  // E - QTR SAÍDA e F - QTR CHEGADA
  const qtrSaida = formatarHorario(row[4]);
  normal[4] = qtrSaida;
  
  let qtrChegada = String(row[5]).trim();
  if (qtrChegada.toUpperCase().includes("QTA")) {
    normal[5] = "QTA";
  } else {
    normal[5] = formatarHorario(row[5]);
  }

  // H - RESULTADO
  if (normal[5] === "QTA") {
    normal[7] = "QTA";
  } else if (normal[5] !== '') {
    normal[7] = "ATENDIDA";
  } else {
    normal[7] = '';
  }

  // G - TEMPO TOTAL
  normal[6] = calcularTempoTotal(normal[4], normal[5]);

  // I - KM SAÍDA e J - KM CHEGADA
  const kmSaida = Number(row[8]);
  const kmChegada = Number(row[9]);
  normal[8] = isNaN(kmSaida) ? '' : kmSaida;
  normal[9] = isNaN(kmChegada) ? '' : kmChegada;

  // K - DISTÂNCIA
  if (!isNaN(kmSaida) && !isNaN(kmChegada) && kmChegada >= kmSaida) {
    normal[10] = Math.round((kmChegada - kmSaida) * 100) / 100;
  } else {
    normal[10] = '';
  }

  // L - CMT VTR, M - NATUREZA
  normal[11] = String(row[11]).trim().replace(/\s+/g, ' ');
  normal[12] = String(row[12]).trim();

  // N - VÍTIMAS, O - VÍTIMAS FATAIS
  normal[13] = isNaN(parseInt(row[13])) ? 0 : parseInt(row[13]);
  normal[14] = isNaN(parseInt(row[14])) ? 0 : parseInt(row[14]);

  // P - ENDEREÇO, Q - CIDADE, R - TELEGRAFISTA, S - OBSERVAÇÕES
  normal[15] = String(row[15]).trim().replace(/\s+/g, ' ');
  normal[16] = String(row[16]).trim().replace(/\s+/g, ' ').toUpperCase();
  normal[17] = String(row[17]).trim();
  normal[18] = row[18] ? String(row[18]).trim() : '';

  // Limpezas Gerais em todos os textos
  for (let i = 0; i < 19; i++) {
    if (typeof normal[i] === 'string') {
      normal[i] = normal[i]
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  return normal;
}

// Auxiliar: Formatar Horário
function formatarHorario(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  }
  const str = String(val).trim();
  const match = str.match(/^([0-1]?[0-9]|2[0-3])[:.hH]?([0-5][0-9])?$/);
  if (match) {
    const hr = match[1].padStart(2, '0');
    const min = (match[2] || '00').padStart(2, '0');
    return `${hr}:${min}`;
  }
  return '';
}

// Auxiliar: Calcular Tempo Total
function calcularTempoTotal(saida, chegada) {
  if (!saida || !chegada || chegada === "QTA") return '';
  try {
    const [hS, mS] = saida.split(':').map(Number);
    const [hC, mC] = chegada.split(':').map(Number);
    let minSaida = hS * 60 + mS;
    let minChegada = hC * 60 + mC;
    
    if (minChegada < minSaida) { // Virada do dia
      minChegada += 24 * 60;
    }
    
    const diff = minChegada - minSaida;
    const hDiff = Math.floor(diff / 60).toString().padStart(2, '0');
    const mDiff = (diff % 60).toString().padStart(2, '0');
    return `${hDiff}:${mDiff}`;
  } catch(e) {
    return '';
  }
}

// Gravação de Logs
function registrarLog(info) {
  const destSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = destSpreadsheet.getSheetByName("LOG");
  if (!logSheet) {
    logSheet = destSpreadsheet.insertSheet("LOG");
    logSheet.appendRow(["DATA/HORA", "ABAS PROCESSADAS", "LINHAS LIDAS", "LINHAS DESCARTADAS", "LINHAS CONSOLIDADAS", "TEMPO TOTAL (s)", "ERROS"]);
  }
  logSheet.appendRow([
    info.dataHora,
    info.abasProcessadas,
    info.linhasLidas,
    info.linhasDescartadas,
    info.linhasConsolidadas,
    info.tempoTotal,
    info.erros.join(" | ")
  ]);
}

// Funções de Ação do Menu (Placeholders que disparam o processamento)
function recalcularDistanciasMenu() { executarETL(); }
function recalcularTempoTotalMenu() { executarETL(); }
function verLogMenu() {
  const destSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = destSpreadsheet.getSheetByName("LOG");
  if (logSheet) logSheet.activate();
}
function recriarPlanilhaConsolidada() { executarETL(); }
