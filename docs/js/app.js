/**
 * app.js - Versão 3.0
 * Controla os gráficos, filtros e KPIs com temas e paletas de alta fidelidade
 * Paleta de Cores: Tons de Azul, Roxo e Amarelo Ouro
 */

import { initTheme } from './layout/theme.js';
import { initSidebar } from './layout/sidebar.js';
import { initDataStore, getUniqueValues, setFilter, applyFilters, state, stateDejem, initDejemStore, setDejemFilter, applyDejemFilters, getUniqueDejemValues, stateAbastecimento, initAbastecimentoStore, setAbastecimentoFilter, applyAbastecimentoFilters, getUniqueAbastecimentoValues, forceRefresh } from './store/dataStore.js';

import { initRouter } from './router.js';

// Instâncias Globais
let charts = {};
let homeMap = null;
let heatLayer = null;
let abastDataTable = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebar();

    // Inicializa o Relógio em tempo real no cabeçalho
    initRealTimeClock();

    // Como os filtros agora estão no index.html globalmente, inicializamos de imediato
    initFlatpickr();
    bindFilterEvents();

    // Inicializa o roteador e carrega a tela
    initRouter();

    // Baixa os dados
    await initDataStore();
});

// Listener de Roteamento SPA
document.addEventListener('page-loaded', (e) => {
    const route = e.detail.route;

    if (route === 'home') {
        // Aguarda a renderização do Grid CSS para o ECharts não calcular largura errada
        setTimeout(() => {
            initCharts();
            initHomeMap();
            updateDashboard();
        }, 100);
    } else if (route === 'ocorrencias') {
        initDataTable();
    } else if (route === 'viaturas') {
        setTimeout(() => { initViaturasTab(); }, 100);
    } else if (route === 'prontidoes') {
        setTimeout(() => { initProntidoesTab(); }, 100);
    } else if (route === 'mapa') {
        setTimeout(() => { 
            initFullMap(); 
            if (fullMap) fullMap.invalidateSize();
        }, 150);
    } else if (route === 'timeline') {
        setTimeout(() => { initTimelineTab(); }, 100);
    } else if (route === 'dejem') {
        setTimeout(() => { initDejemTab(); }, 100);
    } else if (route === 'abastecimento') {
        setTimeout(() => { initAbastecimentoTab(); }, 100);
    }
});

let dataTable = null;
let fullMap = null;
let fullHeatLayer = null;
let clusterIncendios = null;
let clusterResgates = null;
let clusterOutros = null;
let bufferLayerGroup = null;
let layerControlObj = null;
let mapMarkerCluster = null;
let currentMapMode = 'markers';
let currentMapStyle = 'dark';
let activeTileLayer = null;
let geocodingAbortController = null;
let globalValidPoints = []; // Coordenadas em tela para análise do Turf
let timeSliderControl = null;
let allMapMarkers = []; // { marker, cat, hour }

window.addEventListener('dataUpdated', () => {
    populateSelects(); // Atualiza o select de viaturas (filtro global)
    
    const currentRoute = window.location.hash.replace('#', '') || 'home';
    
    if (currentRoute === 'home') {
        updateDashboard();
    } else if (currentRoute === 'ocorrencias') {
        updateDataTable();
    } else if (currentRoute === 'viaturas') {
        updateViaturasTab();
    } else if (currentRoute === 'prontidoes') {
        updateProntidoesTab();
    } else if (currentRoute === 'mapa') {
        updateFullMapData(state.filteredData);
    } else if (currentRoute === 'timeline') {
        updateTimelineTab();
    }
});

window.addEventListener('themeChanged', () => {
    const currentRoute = window.location.hash.replace('#', '') || 'home';
    if (currentRoute === 'home') {
        setTimeout(() => {
            initCharts();
            updateDashboard();
        }, 100);
    }
});

window.addEventListener('resize', () => {
    const currentRoute = window.location.hash.replace('#', '') || 'home';
    if (currentRoute === 'home') {
        Object.values(charts).forEach(c => c && c.resize());
    }
});

/**
 * Atualiza o relógio digital no cabeçalho estilo DEJEM a cada segundo.
 */
function initRealTimeClock() {
    const dateEl = document.getElementById('widget-date');
    const timeEl = document.getElementById('widget-time');

    function update() {
        const now = new Date();
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('pt-BR');
        }
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }
    
    update();
    setInterval(update, 1000);
}

function initFlatpickr() {
    if (window.flatpickr) {
        flatpickr(".flatpickr-date", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            locale: "pt",
            theme: "dark",
            onChange: function(selectedDates, dateStr, instance) {
                if (instance.element) {
                    instance.element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }
}

function populateSelects(customFilters = null) {
    const filtersToUse = customFilters || state.filters;

    const prontidaoSelect = document.getElementById('filter-prontidao');
    const viaturaSelect = document.getElementById('filter-viatura');
    const naturezaSelect = document.getElementById('filter-natureza');
    const cidadeSelect = document.getElementById('filter-cidade');
    const talaoInput = document.getElementById('filter-id');
    const startInput = document.getElementById('filter-date-start');
    const endInput = document.getElementById('filter-date-end');
    
    // Apenas se NÃO for cascata visual (carregar filtros iniciais da store)
    if (!customFilters) {
        if (prontidaoSelect && state.filters.prontidao) prontidaoSelect.value = state.filters.prontidao;
        if (talaoInput && state.filters.talao) talaoInput.value = state.filters.talao;
        if (startInput && state.filters.dateStart) {
            startInput.value = state.filters.dateStart;
            if (startInput._flatpickr) startInput._flatpickr.setDate(state.filters.dateStart);
        }
        if (endInput && state.filters.dateEnd) {
            endInput.value = state.filters.dateEnd;
            if (endInput._flatpickr) endInput._flatpickr.setDate(state.filters.dateEnd);
        }
    }

    if (viaturaSelect) {
        const viaturas = getUniqueValues('viatura', filtersToUse);
        viaturaSelect.innerHTML = '<option value="TODOS">TODOS</option>';
        viaturas.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            if (filtersToUse.viatura === v) opt.selected = true;
            viaturaSelect.appendChild(opt);
        });
    }

    if (naturezaSelect) {
        const naturezas = getUniqueValues('natureza', filtersToUse);
        naturezaSelect.innerHTML = '<option value="TODOS">TODOS</option>';
        naturezas.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (filtersToUse.natureza === n) opt.selected = true;
            naturezaSelect.appendChild(opt);
        });
    }

    if (cidadeSelect) {
        const cidades = getUniqueValues('cidade', filtersToUse);
        cidadeSelect.innerHTML = '<option value="TODOS">TODAS</option>';
        cidades.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (filtersToUse.cidade === c) opt.selected = true;
            cidadeSelect.appendChild(opt);
        });
    }
}

function bindFilterEvents() {
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear');
    const btnRefresh = document.getElementById('btn-refresh');

    const triggerCascade = () => {
        const currentDOMFilters = {
            talao: document.getElementById('filter-id') ? document.getElementById('filter-id').value.trim() : '',
            dateStart: document.getElementById('filter-date-start') ? document.getElementById('filter-date-start').value : '',
            dateEnd: document.getElementById('filter-date-end') ? document.getElementById('filter-date-end').value : '',
            prontidao: document.getElementById('filter-prontidao') ? document.getElementById('filter-prontidao').value : 'TODOS',
            viatura: document.getElementById('filter-viatura') ? document.getElementById('filter-viatura').value : 'TODOS',
            natureza: document.getElementById('filter-natureza') ? document.getElementById('filter-natureza').value : 'TODOS',
            cidade: document.getElementById('filter-cidade') ? document.getElementById('filter-cidade').value : 'TODOS'
        };
        populateSelects(currentDOMFilters);
    };

    ['filter-date-start', 'filter-date-end', 'filter-prontidao', 'filter-viatura', 'filter-natureza', 'filter-cidade'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', triggerCascade);
    });

    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            setFilter('talao', document.getElementById('filter-id').value.trim());
            setFilter('dateStart', document.getElementById('filter-date-start').value);
            setFilter('dateEnd', document.getElementById('filter-date-end').value);
            setFilter('prontidao', document.getElementById('filter-prontidao').value);
            setFilter('viatura', document.getElementById('filter-viatura').value);
            setFilter('natureza', document.getElementById('filter-natureza').value);
            setFilter('cidade', document.getElementById('filter-cidade').value);
            applyFilters();
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            document.getElementById('filter-id').value = '';
            
            const startDate = document.getElementById('filter-date-start');
            const endDate = document.getElementById('filter-date-end');
            
            const d30 = new Date();
            d30.setDate(d30.getDate() - 30);
            const dateStartStr = d30.toISOString().split('T')[0];
            const dateEndStr = new Date().toISOString().split('T')[0];

            if (startDate && startDate._flatpickr) startDate._flatpickr.setDate(dateStartStr);
            if (endDate && endDate._flatpickr) endDate._flatpickr.setDate(dateEndStr);

            document.getElementById('filter-prontidao').value = 'TODOS';
            document.getElementById('filter-viatura').value = 'TODOS';
            document.getElementById('filter-natureza').value = 'TODOS';
            document.getElementById('filter-cidade').value = 'TODOS';

            setFilter('talao', '');
            setFilter('dateStart', dateStartStr);
            setFilter('dateEnd', dateEndStr);
            setFilter('prontidao', 'TODOS');
            setFilter('viatura', 'TODOS');
            setFilter('natureza', 'TODOS');
            setFilter('cidade', 'TODOS');
            applyFilters();
        });
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            initDataStore(true);
        });
    }
}

// Filtro Dinâmico da Linha do Tempo (Time Slider)
function filterMapByTime(hourLimit) {
    if (clusterIncendios) clusterIncendios.clearLayers();
    if (clusterResgates) clusterResgates.clearLayers();
    if (clusterOutros) clusterOutros.clearLayers();
    
    const heatPoints = [];
    globalValidPoints = [];
    let validCount = 0;
    
    allMapMarkers.forEach(item => {
        if (hourLimit === 24 || (item.hour >= hourLimit - 3 && item.hour <= hourLimit)) {
            if (item.cat === 'incendio' && clusterIncendios) clusterIncendios.addLayer(item.marker);
            else if (item.cat === 'resgate' && clusterResgates) clusterResgates.addLayer(item.marker);
            else if (clusterOutros) clusterOutros.addLayer(item.marker);
            
            const pt = item.marker.getLatLng();
            const coord = [pt.lat, pt.lng];
            heatPoints.push(coord);
            globalValidPoints.push(coord);
            validCount++;
        }
    });

    if (fullHeatLayer) {
        fullHeatLayer.setLatLngs(heatPoints);
    }
    
    const kpiTotal = document.getElementById('kpi-map-total');
    if (kpiTotal) kpiTotal.textContent = validCount;
}

function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    
    Object.values(charts).forEach(c => c && c.dispose());

    const domEvolucao = document.getElementById('chart-evolucao');
    const domNatureza = document.getElementById('chart-natureza-donut');
    const domProntidao = document.getElementById('chart-prontidao-bar');
    const domDiaSemana = document.getElementById('chart-dia-semana');

    if (domEvolucao) charts.evolucao = echarts.init(domEvolucao, isDark ? 'dark' : null);
    if (domNatureza) charts.natureza = echarts.init(domNatureza, isDark ? 'dark' : null);
    if (domProntidao) charts.prontidao = echarts.init(domProntidao, isDark ? 'dark' : null);
    if (domDiaSemana) charts.diaSemana = echarts.init(domDiaSemana, isDark ? 'dark' : null);
}

function initHomeMap() {
    const domMap = document.getElementById('home-map');
    if (!domMap) return;

    if (homeMap) {
        homeMap.remove();
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    homeMap = L.map('home-map', { zoomControl: false }).setView([-23.528, -47.135], 11);
    
    const tileUrl = isLight 
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap'
    }).addTo(homeMap);
}

function updateDashboard() {
    const data = state.filteredData;
    updateKPIs(data);
    updateHomeMapData(data);
    updateCharts(data);
    updateRanking(data);
}

function updateKPIs(data) {
    const kpiContainer = document.getElementById('kpi-container');
    if (!kpiContainer) return;

    // 1. Ocorrências (Total, Atendidas, QTA)
    const totalOcorrencias = data.length;
    const qtaCount = data.filter(i => i.resultado === 'QTA').length;
    const atendidasCount = totalOcorrencias - qtaCount;

    // 2. Vítimas (Total = N + O)
    const sumN = data.reduce((sum, item) => sum + (item.vitimas || 0), 0);
    const sumO = data.reduce((sum, item) => sum + (item.vitimasFatais || 0), 0);
    const totalVitimas = sumN + sumO;
    const vitimasFatais = sumO;
    
    // 3. Viaturas e KM Médio
    const viaturasSet = new Set(data.map(i => i.viatura).filter(v => v));
    const totalViaturas = viaturasSet.size;
    const totalKm = data.reduce((sum, item) => sum + (item.distancia || 0), 0);
    const kmMedio = totalOcorrencias > 0 ? (totalKm / totalOcorrencias).toFixed(1) : '0.0';

    // 4. Municípios
    const cidadesSet = new Set(data.map(i => i.cidade).filter(c => c));
    const totalMunicipios = cidadesSet.size;

    // 5. Tempo Médio
    const tempos = data.map(i => i.tempoMinutos).filter(t => t > 0);
    const tempoMedioMinutos = tempos.length > 0 ? (tempos.reduce((sum, t) => sum + t, 0) / tempos.length) : 0;
    const hrsMedio = Math.floor(tempoMedioMinutos / 60).toString().padStart(2, '0');
    const minsMedio = Math.round(tempoMedioMinutos % 60).toString().padStart(2, '0');
    const tempoMedioFormatado = `${hrsMedio}:${minsMedio}`;

    kpiContainer.innerHTML = `
        <!-- Card 1: Ocorrências (Card Duplo) -->
        <div class="glass-panel rounded-2xl flex items-center p-3 border-l-4 border-yellow-500 xl:col-span-2">
            <i class="fa-solid fa-list text-yellow-500 text-lg mr-3 p-2 bg-yellow-500/10 rounded-xl"></i>
            <div class="flex-1 flex justify-between items-center pr-2">
                <div>
                    <h3 class="text-base font-extrabold text-white">${totalOcorrencias}</h3>
                    <p class="text-[9px] uppercase font-bold text-gray-400">Total Ocorrências</p>
                </div>
                <div class="flex gap-4 text-right">
                    <div>
                        <h4 class="text-xs font-bold text-green-400">${atendidasCount}</h4>
                        <p class="text-[8px] uppercase font-bold text-gray-500">Atendidas</p>
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-red-400">${qtaCount}</h4>
                        <p class="text-[8px] uppercase font-bold text-gray-500">QTA</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Card 2: Vítimas -->
        <div class="glass-panel rounded-2xl flex items-center p-3 border-l-4 border-blue-500">
            <i class="fa-solid fa-user-injured text-blue-500 text-lg mr-3 p-2 bg-blue-500/10 rounded-xl"></i>
            <div class="flex-1">
                <div class="flex items-end justify-between">
                    <h3 class="text-base font-extrabold text-white">${totalVitimas}</h3>
                    <span class="text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">${vitimasFatais} óbitos</span>
                </div>
                <p class="text-[9px] uppercase font-bold text-gray-400">Total Vítimas</p>
            </div>
        </div>

        <!-- Card 3: Viaturas & KM -->
        <div class="glass-panel rounded-2xl flex items-center p-3 border-l-4 border-purple-500">
            <i class="fa-solid fa-truck-fast text-purple-500 text-lg mr-3 p-2 bg-purple-500/10 rounded-xl"></i>
            <div class="flex-1">
                <div class="flex items-end justify-between">
                    <h3 class="text-base font-extrabold text-white">${totalViaturas}</h3>
                    <span class="text-[9px] font-bold text-purple-300">${kmMedio} km/médio</span>
                </div>
                <p class="text-[9px] uppercase font-bold text-gray-400">Viaturas Distintas</p>
            </div>
        </div>

        <!-- Card 4: Municípios -->
        <div class="glass-panel rounded-2xl flex items-center p-3 border-l-4 border-teal-500">
            <i class="fa-solid fa-city text-teal-500 text-lg mr-3 p-2 bg-teal-500/10 rounded-xl"></i>
            <div>
                <h3 class="text-base font-extrabold text-white">${totalMunicipios}</h3>
                <p class="text-[9px] uppercase font-bold text-gray-400">Municípios</p>
            </div>
        </div>

        <!-- Card 5: Tempo Médio -->
        <div class="glass-panel rounded-2xl flex items-center p-3 border-l-4 border-gray-400">
            <i class="fa-solid fa-clock text-gray-400 text-lg mr-3 p-2 bg-gray-400/10 rounded-xl"></i>
            <div>
                <h3 class="text-base font-extrabold text-white">${tempoMedioFormatado}</h3>
                <p class="text-[9px] uppercase font-bold text-gray-400">Tempo Médio de Atendimento</p>
            </div>
        </div>
    `;
}

function updateHomeMapData(data) {
    if (!homeMap) return;

    if (heatLayer) {
        homeMap.removeLayer(heatLayer);
    }

    const heatPoints = [];
    const geocache = JSON.parse(localStorage.getItem('dashboard_geocache') || '{}');

    data.forEach(item => {
        if (item.latitude !== null && !isNaN(item.latitude) && item.longitude !== null && !isNaN(item.longitude)) {
            heatPoints.push([item.latitude, item.longitude]);
        } else {
            let query = `${item.endereco || ''}, ${item.cidade}, SP, Brasil`.trim();
            if (query.startsWith(',')) query = `${item.cidade}, SP, Brasil`;
            
            const coords = geocache[query];
            if (coords) {
                heatPoints.push(coords);
            }
        }
    });

    if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, { radius: 20, blur: 15 }).addTo(homeMap);
        const bounds = L.latLngBounds(heatPoints);
        homeMap.fitBounds(bounds, { padding: [10, 10] });
    }
}

function updateCharts(data) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#e5e7eb' : '#1e293b';
    const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    // Paleta de Cores Distintas (Azul, Amarelo, Rosa, Verde, Roxo, Laranja)
    const colors = ['#2563eb', '#eab308', '#ec4899', '#10b981', '#8b5cf6', '#f97316'];

    // 1. Evolução Operacional por Mês (Ano Atual vs Ano Anterior)
    if (charts.evolucao) {
        // Filtra os dados ignorando apenas o filtro de DATA
        const baseData = state.rawData.filter(item => {
            if (state.filters.talao && !item.talao.includes(state.filters.talao)) return false;
            if (state.filters.prontidao !== 'TODOS' && item.prontidao !== state.filters.prontidao) return false;
            if (state.filters.viatura !== 'TODOS' && item.viatura !== state.filters.viatura) return false;
            return true;
        });

        const mesesNomesAbrev = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
        const anchorDate = new Date();
        const currentYear = anchorDate.getFullYear();
        const currentMonth = anchorDate.getMonth();
        
        // Ano atual: preencher com 0 até o mês atual, null para o futuro
        const countsCurrent = new Array(12).fill(null);
        for (let i = 0; i <= currentMonth; i++) {
            countsCurrent[i] = 0;
        }
        
        // Ano anterior: preencher com 0 para o ano todo
        const countsPrevious = new Array(12).fill(0);
        
        baseData.forEach(item => {
            if (!item.data) return;
            const m = item.data.getMonth();
            const y = item.data.getFullYear();
            
            if (y === currentYear && m <= currentMonth) {
                countsCurrent[m]++;
            } else if (y === (currentYear - 1)) {
                countsPrevious[m]++;
            }
        });

        // O eixo X será sempre de JAN a DEZ do ano corrente
        const labels = mesesNomesAbrev;

        const nameCurrent = `Ano Atual (${currentYear})`;
        const namePrev = `Ano Anterior (${currentYear - 1})`;

        charts.evolucao.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: {
                data: [nameCurrent, namePrev],
                textStyle: { color: textColor, fontSize: 10 },
                top: 0
            },
            grid: { top: 35, bottom: 25, left: 35, right: 15 },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: gridLineColor } },
                axisLabel: { color: textColor, fontSize: 9, interval: 0, rotate: 45 }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: gridLineColor } },
                splitLine: { lineStyle: { color: gridLineColor } },
                axisLabel: { color: textColor, fontSize: 10 }
            },
            series: [
                {
                    name: nameCurrent,
                    type: 'line',
                    data: countsCurrent,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: { color: '#eab308' }, // Amarelo
                    lineStyle: { width: 3, color: '#eab308' },
                    label: { 
                        show: true, 
                        position: 'top', 
                        color: textColor, 
                        fontSize: 10,
                        formatter: (p) => p.value > 0 ? p.value : ''
                    },
                    markPoint: {
                        data: [
                            { type: 'max', name: 'Máx' },
                            { type: 'min', name: 'Mín' }
                        ],
                        itemStyle: { color: '#eab308' },
                        label: { color: '#000', fontSize: 9, fontWeight: 'bold' },
                        symbolSize: 40
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(234, 179, 8, 0.35)' },
                            { offset: 1, color: 'rgba(234, 179, 8, 0)' }
                        ])
                    }
                },
                {
                    name: namePrev,
                    type: 'line',
                    data: countsPrevious,
                    smooth: true,
                    symbol: 'emptyCircle',
                    symbolSize: 6,
                    itemStyle: { color: '#8b5cf6' }, // Roxo
                    lineStyle: { width: 2, color: '#8b5cf6', type: 'dashed' },
                    label: { show: false }
                }
            ]
        });
    }
    // Calcular Top 5 Naturezas globalmente para usar em ambos os gráficos
    const porNatGlobal = {};
    data.forEach(i => {
        const n = i.natureza || 'NÃO INFORMADA';
        porNatGlobal[n] = (porNatGlobal[n] || 0) + 1;
    });
    
    const top5NaturezasNames = Object.keys(porNatGlobal)
        .map(k => ({ name: k, value: porNatGlobal[k] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(item => item.name);

    // 2. Distribuição por Natureza (Donut - Azul, Roxo, Ouro)
    if (charts.natureza) {
        const top5 = top5NaturezasNames.map(name => ({ name: name, value: porNatGlobal[name] }));
        const top5Total = top5.reduce((sum, item) => sum + item.value, 0);

        charts.natureza.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item' },
            legend: {
                orient: 'vertical',
                right: '2%',
                top: 'center',
                textStyle: { color: textColor, fontSize: 9 }
            },
            title: {
                text: top5Total.toString(),
                subtext: 'TOP 5',
                left: '28%',
                top: '38%',
                textAlign: 'center',
                textStyle: { fontSize: 18, color: textColor, fontWeight: 'bold' },
                subtextStyle: { fontSize: 9, color: textColor }
            },
            series: [{
                type: 'pie',
                radius: ['60%', '82%'],
                center: ['30%', '50%'],
                avoidLabelOverlap: false,
                label: { show: false },
                labelLine: { show: false },
                data: top5.map((item, idx) => ({
                    ...item,
                    itemStyle: { color: colors[idx % colors.length] }
                })),
                itemStyle: {
                    borderRadius: 4,
                    borderColor: isDark ? '#12131a' : '#ffffff',
                    borderWidth: 2
                }
            }]
        });
    }

    // 3. Operação por Prontidão x Natureza (Barras Empilhadas)
    if (charts.prontidao) {
        const prontidoes = ['AMARELA', 'VERDE', 'AZUL'];
        
        // Preparar estrutura de dados: seriesDataMap[natureza] = [valorAmarela, valorVerde, valorAzul]
        const seriesDataMap = {};
        top5NaturezasNames.forEach(nat => {
            seriesDataMap[nat] = [0, 0, 0];
        });
        
        data.forEach(i => {
            const p = i.prontidao;
            const n = i.natureza || 'NÃO INFORMADA';
            
            const pIdx = prontidoes.indexOf(p);
            if (pIdx !== -1 && seriesDataMap[n]) {
                seriesDataMap[n][pIdx]++;
            }
        });

        const series = top5NaturezasNames.map((nat, idx) => ({
            name: nat,
            type: 'bar',
            stack: 'total',
            label: {
                show: true,
                fontSize: 9,
                color: '#fff',
                formatter: (p) => p.value > 0 ? p.value : ''
            },
            emphasis: { focus: 'series' },
            itemStyle: { color: colors[idx % colors.length] },
            data: seriesDataMap[nat]
        }));

        charts.prontidao.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: {
                data: top5NaturezasNames,
                textStyle: { color: textColor, fontSize: 9 },
                top: 0,
                type: 'scroll'
            },
            grid: { top: 30, bottom: 20, left: 65, right: 15 },
            xAxis: {
                type: 'value',
                axisLabel: { color: textColor, fontSize: 9 },
                splitLine: { lineStyle: { color: gridLineColor } }
            },
            yAxis: {
                type: 'category',
                data: prontidoes,
                axisLabel: { color: textColor, fontSize: 9 },
                axisLine: { lineStyle: { color: gridLineColor } }
            },
            series: series
        });
    }

    // 4. Ocorrências por Dia da Semana (Últimos 7 Dias)
    if (charts.diaSemana) {
        const diasSemanaNomes = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
        const labels = [];
        const dateKeys = [];
        
        const anchorDate = new Date();
        
        // Construir os últimos 7 dias (do 6º dia atrás até hoje)
        for (let i = 6; i >= 0; i--) {
            let d = new Date(anchorDate);
            d.setDate(anchorDate.getDate() - i);
            let dia = diasSemanaNomes[d.getDay()];
            if (i === 0) dia += ' (Hoje)';
            labels.push(dia);
            
            let dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            dateKeys.push(dateKey);
        }

        const counts = new Array(7).fill(0);
        
        // Filtrar a partir do rawData ignorando data global, garantindo os últimos 7 dias reais
        state.rawData.forEach(item => {
            if (!item.data) return;
            if (state.filters.talao && !item.talao.includes(state.filters.talao)) return;
            if (state.filters.prontidao !== 'TODOS' && item.prontidao !== state.filters.prontidao) return;
            if (state.filters.viatura !== 'TODOS' && item.viatura !== state.filters.viatura) return;

            const itemKey = `${item.data.getFullYear()}-${String(item.data.getMonth()+1).padStart(2,'0')}-${String(item.data.getDate()).padStart(2,'0')}`;
            const idx = dateKeys.indexOf(itemKey);
            if (idx !== -1) {
                counts[idx]++;
            }
        });

        let maxVal = -1;
        let minVal = Infinity;
        counts.forEach(c => {
            if (c > maxVal) maxVal = c;
            if (c < minVal) minVal = c;
        });

        const seriesData = counts.map(val => {
            let color = '#2563eb'; // Default Azul
            if (maxVal > minVal) {
                if (val === maxVal) color = '#eab308'; // Amarelo para maior
                else if (val === minVal) color = '#ef4444'; // Vermelho para menor
            }
            return {
                value: val,
                itemStyle: { color: color, borderRadius: [4, 4, 0, 0] }
            };
        });

        charts.diaSemana.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { top: 25, bottom: 20, left: 30, right: 5 },
            xAxis: {
                type: 'category',
                data: labels,
                axisLabel: { color: textColor, fontSize: 9, interval: 0 },
                axisLine: { lineStyle: { color: gridLineColor } }
            },
            yAxis: {
                type: 'value',
                max: 30,
                axisLabel: { color: textColor, fontSize: 9 },
                splitLine: { lineStyle: { color: gridLineColor } }
            },
            series: [{
                type: 'bar',
                data: seriesData,
                label: {
                    show: true,
                    position: 'top',
                    color: textColor,
                    fontSize: 10,
                    formatter: (p) => p.value > 0 ? p.value : ''
                },
                barWidth: '50%'
            }]
        });
    }
}

function updateRanking(data) {
    const tbody = document.getElementById('ranking-viaturas-body');
    if (!tbody) return;

    const rankMap = {};
    data.forEach(i => {
        const vtr = i.viatura || 'OUTRA';
        if (!rankMap[vtr]) {
            rankMap[vtr] = { vtr: vtr, ocorrencias: 0, km: 0 };
        }
        rankMap[vtr].ocorrencias++;
        rankMap[vtr].km += (i.distancia || 0);
    });

    const sorted = Object.values(rankMap).sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 5);

    tbody.innerHTML = sorted.map((item, idx) => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="py-2"><span class="font-bold text-yellow-500 text-xs">#${idx + 1}</span></td>
            <td class="py-2 font-bold text-white text-xs">${item.vtr}</td>
            <td class="py-2 text-center text-blue-400 font-semibold text-xs">${item.ocorrencias}</td>
            <td class="py-2 text-right text-purple-400 font-semibold text-xs">${Math.round(item.km)}</td>
        </tr>
    `).join('');
}

// ============================================
// LÓGICA DA TABELA DE OCORRÊNCIAS
// ============================================
function initDataTable() {
    if (dataTable) {
        dataTable.destroy();
    }
    
    if (window.$ && $.fn.DataTable) {
        dataTable = $('#table-ocorrencias').DataTable({
            data: state.filteredData,
            columns: [
                { 
                    data: 'data', 
                    render: (data, type) => {
                        if (!data) return '';
                        const d = new Date(data);
                        if (type === 'sort' || type === 'type') {
                            return d.getTime();
                        }
                        return d.toLocaleDateString('pt-BR');
                    },
                    className: "text-[#b0c0d8]"
                },
                { 
                    data: 'talao', 
                    render: (data, type, row) => {
                        const isQTA = row.resultado === 'QTA';
                        const dotColor = isQTA ? 'bg-red-500' : 'bg-green-500';
                        const title = isQTA ? 'QTA (Cancelada)' : 'Atendida';
                        return `<div class="flex items-center gap-2" title="${title}"><span class="w-2 h-2 rounded-full ${dotColor}"></span> <span class="font-mono text-yellow-500">${data}</span></div>`;
                    }
                },
                { data: 'viatura', className: "font-semibold text-white" },
                { 
                    data: 'prontidao',
                    render: (data) => {
                        if (data === 'VERDE') return `<span class="px-2 py-1 rounded bg-green-500/20 text-green-400 text-[10px] font-bold">VERDE</span>`;
                        if (data === 'AMARELA') return `<span class="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-[10px] font-bold">AMARELA</span>`;
                        if (data === 'AZUL') return `<span class="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">AZUL</span>`;
                        return data;
                    }
                },
                { data: 'natureza', className: "text-[#b0c0d8]" },
                { data: 'cidade', className: "text-[#b0c0d8]" },
                { data: 'vitimas', className: "text-center text-blue-400 font-bold" },
                { data: 'vitimasFatais', className: "text-center text-red-400 font-bold" },
                { data: 'cmtVtr', className: "text-[#b0c0d8]" }
            ],
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
            },
            dom: '<"flex flex-col md:flex-row justify-between items-center mb-4 gap-4 w-full"<"text-sm"l><"text-sm"f>>rt<"flex flex-col md:flex-row justify-between items-center mt-4 text-xs text-[#5a6f8a] w-full"i p>',
            buttons: [],
            pageLength: 15,
            lengthMenu: [[10, 15, 25, 50, 100], [10, 15, 25, 50, 100]],
            order: [[0, 'desc']],
            // Styling the table container for Tailwind
            createdRow: function(row, data, dataIndex) {
                $(row).addClass('border-b border-white/5 hover:bg-white/5 transition text-xs');
            }
        });
    }
}

function updateDataTable() {
    if (dataTable) {
        dataTable.clear();
        dataTable.rows.add(state.filteredData);
        dataTable.draw();
    }
}

// ============================================
// LÓGICA DO MAPA FULL
// ============================================
function initFullMap() {
    const domMap = document.getElementById('full-map');
    if (!domMap) return;

    if (fullMap) fullMap.remove();

    fullMap = L.map('full-map', { zoomControl: true }).setView([-23.528, -47.135], 11);
    
    // Configurar as ferramentas do Leaflet-Geoman (Desenho, Área e Distância)
    if (fullMap.pm) {
        fullMap.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            drawPolyline: true,
            drawCircle: true,
            drawRectangle: true,
            editMode: true,
            dragMode: true,
            cutPolygon: false,
            removalMode: true,
        });
        
        // Habilitar tooltips que mostram medidas (distância/área) nativamente no Geoman
        fullMap.pm.setGlobalOptions({ 
            measurements: { measurement: true, displayFormat: 'metric' },
            tooltips: true
        });

        // Adiciona cálculos manuais e Tooltips visuais via Turf.js 
        fullMap.on('pm:create', function(e) {
            const layer = e.layer;
            const shape = e.shape;
            
            function updateMeasure() {
                if (!window.turf) return;
                let measureText = '';
                let geojson = layer.toGeoJSON ? layer.toGeoJSON() : null;
                
                if (shape === 'Polygon' || shape === 'Rectangle' || shape === 'Circle') {
                    let area = 0;
                    if (shape === 'Circle') {
                        area = Math.PI * Math.pow(layer.getRadius(), 2);
                    } else if (geojson) {
                        area = turf.area(geojson);
                    }
                    
                    if (area > 1000000) {
                        measureText = 'Área: ' + (area / 1000000).toFixed(2) + ' km²';
                    } else {
                        measureText = 'Área: ' + area.toFixed(2) + ' m²';
                    }

                    // Análise de Proximidade (Contar Ocorrências dentro da forma)
                    let countInside = 0;
                    if (globalValidPoints && globalValidPoints.length > 0) {
                        if (shape === 'Circle') {
                            const center = layer.getLatLng();
                            const radius = layer.getRadius();
                            for (const pt of globalValidPoints) {
                                // pt = [lat, lng]
                                if (center.distanceTo(L.latLng(pt[0], pt[1])) <= radius) countInside++;
                            }
                        } else if (geojson && shape !== 'Line' && shape !== 'Polyline' && shape !== 'LineString') {
                            const pointsFeature = turf.points(globalValidPoints.map(p => [p[1], p[0]])); // turf usa [lng, lat]
                            const ptsWithin = turf.pointsWithinPolygon(pointsFeature, geojson);
                            countInside = ptsWithin.features.length;
                        }
                    }
                    if (countInside > 0) {
                        measureText += `<br><span style="color:#ef4444; font-weight:bold;">${countInside} ocorrência(s) na área</span>`;
                    }
                } else if (shape === 'Line' || shape === 'Polyline' || shape === 'LineString') {
                    if (geojson) {
                        const length = turf.length(geojson, {units: 'kilometers'});
                        if (length < 1) {
                            measureText = 'Distância: ' + (length * 1000).toFixed(0) + ' m';
                        } else {
                            measureText = 'Distância: ' + length.toFixed(2) + ' km';
                        }
                    }
                }

                if (measureText) {
                    layer.bindTooltip(measureText, { permanent: true, direction: 'center' }).openTooltip();
                }
            }

            updateMeasure();

            // Atualiza caso o usuário edite (mova os pontos)
            layer.on('pm:edit', updateMeasure);
        });
    }
    
    setMapTileLayer(currentMapStyle);

    if (clusterIncendios) clusterIncendios.clearLayers();
    if (clusterResgates) clusterResgates.clearLayers();
    if (clusterOutros) clusterOutros.clearLayers();
    if (bufferLayerGroup) bufferLayerGroup.clearLayers();
    
    const clusterConfig = { disableClusteringAtZoom: 16, maxClusterRadius: 50 };
    clusterIncendios = L.markerClusterGroup(clusterConfig);
    clusterResgates = L.markerClusterGroup(clusterConfig);
    clusterOutros = L.markerClusterGroup(clusterConfig);
    bufferLayerGroup = L.layerGroup();
    
    // Configura o Quartel e isócronas (Raios de 3, 6, 12 km)
    const quartelCoords = [-23.5435390, -47.1323313];
    const quartelMarker = L.marker(quartelCoords, {
        icon: L.divIcon({ html: '<i class="fa-solid fa-building-shield text-2xl text-red-600 drop-shadow-md"></i>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] })
    }).bindPopup('<b>Quartel de São Roque</b>');
    bufferLayerGroup.addLayer(quartelMarker);
    
    // Anéis
    L.circle(quartelCoords, { radius: 3000, color: '#10b981', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' }).bindPopup('Tempo de Resposta: ~5 min').addTo(bufferLayerGroup);
    L.circle(quartelCoords, { radius: 6000, color: '#f59e0b', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' }).bindPopup('Tempo de Resposta: ~10 min').addTo(bufferLayerGroup);
    L.circle(quartelCoords, { radius: 12000, color: '#ef4444', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' }).bindPopup('Tempo de Resposta: ~20 min').addTo(bufferLayerGroup);

    // Layer Control
    if (layerControlObj) {
        fullMap.removeControl(layerControlObj);
    }
    
    const baseMaps = {};
    const overlayMaps = {
        "<span class='text-red-500 font-bold'><i class='fa-solid fa-fire'></i> Incêndios</span>": clusterIncendios,
        "<span class='text-yellow-500 font-bold'><i class='fa-solid fa-truck-medical'></i> Resgate/Acidentes</span>": clusterResgates,
        "<span class='text-blue-500 font-bold'><i class='fa-solid fa-bars-staggered'></i> Outras Naturezas</span>": clusterOutros,
        "<span class='text-green-500 font-bold'><i class='fa-solid fa-tower-observation'></i> Cobertura do Quartel</span>": bufferLayerGroup
    };
    
    layerControlObj = L.control.layers(baseMaps, overlayMaps, { collapsed: true, position: 'bottomright' }).addTo(fullMap);

    // Linha do Tempo Espacial (Time Slider)
    if (timeSliderControl) fullMap.removeControl(timeSliderControl);
    
    timeSliderControl = L.control({ position: 'bottomleft' });
    timeSliderControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'time-slider-container bg-[#090e18]/90 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md text-white flex flex-col gap-2 min-w-[280px] mb-6 ml-2');
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-xs uppercase tracking-wider text-gray-300"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Linha do Tempo</span>
                <span id="time-slider-val" class="text-blue-400 font-mono font-bold text-sm">24:00</span>
            </div>
            <input type="range" id="time-slider-input" min="0" max="24" value="24" step="3" class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer">
            <div class="text-[10px] text-gray-500 flex justify-between font-bold">
                <span>00:00</span><span>12:00</span><span>24:00</span>
            </div>
        `;
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    timeSliderControl.addTo(fullMap);
    
    setTimeout(() => {
        const sliderInput = document.getElementById('time-slider-input');
        const sliderVal = document.getElementById('time-slider-val');
        if (sliderInput) {
            sliderInput.addEventListener('input', (e) => {
                const h = parseInt(e.target.value);
                sliderVal.textContent = h === 24 ? '24:00' : h.toString().padStart(2, '0') + ':00';
                filterMapByTime(h);
            });
        }
    }, 100);

    if (charts.mapNat) {
        charts.mapNat.dispose();
        charts.mapNat = null;
    }
    const domMapNat = document.getElementById('chart-map-naturezas');
    if (domMapNat) charts.mapNat = echarts.init(domMapNat, 'dark');

    // Botões e Eventos
    const btnDark = document.getElementById('btn-map-dark');
    const btnSat = document.getElementById('btn-map-sat');
    const btnMarkers = document.getElementById('btn-map-markers');
    const btnHeat = document.getElementById('btn-map-heat');

    const updateBtnStyles = (activeBtn, inactiveBtn) => {
        if(!activeBtn || !inactiveBtn) return;
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-white', 'bg-blue-500/20');
        inactiveBtn.classList.remove('text-white', 'bg-blue-500/20');
        inactiveBtn.classList.add('text-gray-400');
    };

    if (btnDark) btnDark.onclick = () => { currentMapStyle = 'dark'; setMapTileLayer('dark'); updateBtnStyles(btnDark, btnSat); };
    if (btnSat) btnSat.onclick = () => { currentMapStyle = 'sat'; setMapTileLayer('sat'); updateBtnStyles(btnSat, btnDark); };
    
    if (btnMarkers) btnMarkers.onclick = () => { 
        currentMapMode = 'markers'; 
        toggleMapMode(); 
        updateBtnStyles(btnMarkers, btnHeat); 
    };
    if (btnHeat) btnHeat.onclick = () => { 
        currentMapMode = 'heat'; 
        toggleMapMode(); 
        updateBtnStyles(btnHeat, btnMarkers); 
    };

    // Initial styles
    if (currentMapStyle === 'dark') updateBtnStyles(btnDark, btnSat); else updateBtnStyles(btnSat, btnDark);
    if (currentMapMode === 'markers') updateBtnStyles(btnMarkers, btnHeat); else updateBtnStyles(btnHeat, btnMarkers);

    updateFullMapData(state.filteredData);
}

function setMapTileLayer(style) {
    if (activeTileLayer && fullMap) fullMap.removeLayer(activeTileLayer);
    
    const url = style === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    
    activeTileLayer = L.tileLayer(url, { attribution: '© OpenStreetMap | © ESRI' }).addTo(fullMap);
}

function toggleMapMode() {
    if (!fullMap) return;
    if (currentMapMode === 'markers') {
        if (fullHeatLayer) fullMap.removeLayer(fullHeatLayer);
        fullMap.addLayer(clusterIncendios);
        fullMap.addLayer(clusterResgates);
        fullMap.addLayer(clusterOutros);
    } else {
        fullMap.removeLayer(clusterIncendios);
        fullMap.removeLayer(clusterResgates);
        fullMap.removeLayer(clusterOutros);
        if (fullHeatLayer) fullMap.addLayer(fullHeatLayer);
    }
}

async function updateFullMapData(data) {
    if (!fullMap) return;

    if (geocodingAbortController) {
        geocodingAbortController.abort();
    }
    geocodingAbortController = new AbortController();
    const signal = geocodingAbortController.signal;

    if (fullHeatLayer) fullMap.removeLayer(fullHeatLayer);
    if (mapMarkerCluster) mapMarkerCluster.clearLayers();
    allMapMarkers = [];

    const heatPoints = [];
    const geocache = JSON.parse(localStorage.getItem('dashboard_geocache') || '{}');
    
    // Processamento limitado para visualização sem travar
    const dataToProcess = data.slice(0, 300); 
    let processed = 0;
    
    const uiStatus = document.getElementById('geocoding-status');
    const uiCount = document.getElementById('geocoding-count');
    const uiProgress = document.getElementById('geocoding-progress');
    
    if (uiStatus) uiStatus.classList.remove('hidden');
    let cacheUpdated = false;
    let validPointsCount = 0;
    
    const natCount = {};
    let tempoTotal = 0;
    let tempoOcorrencias = 0;
    const cityCount = {};

    globalTotalMapPoints = 0;
    globalMappedPoints = 0;

    const itemsToGeocode = [];

    for (const item of dataToProcess) {
        if (signal.aborted) return;
        
        if (!item.cidade) continue;

        globalTotalMapPoints++;

        let coords = null;

        // Prioridade 1: Coordenadas Nativas da Planilha (Evita gargalo de geocoding)
        if (item.latitude !== null && !isNaN(item.latitude) && item.longitude !== null && !isNaN(item.longitude)) {
            coords = [item.latitude, item.longitude];
        } else {
            // Prioridade 2: Fallback para Cache
            let query = `${item.endereco || ''}, ${item.cidade}, SP, Brasil`.trim();
            if (query.startsWith(',')) query = `${item.cidade}, SP, Brasil`;
            
            coords = geocache[query];

            if (!coords) {
                // Adiciona à fila de background para não travar a UI
                itemsToGeocode.push({ item, query });
                continue; 
            }
        }

        if (coords) {
            heatPoints.push(coords);
            globalValidPoints.push(coords);
            validPointsCount++;
            globalMappedPoints++;

            // Popup do marcador (Enriquecido)
            const dateStr = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '';
            const latStr = coords[0];
            const lngStr = coords[1];
            
            let color = '#3b82f6';
            let iconCode = 'fa-bars-staggered';
            let cat = 'outros';
            
            const natUpper = (item.natureza || '').toUpperCase();
            if (natUpper.includes('FOGO') || natUpper.includes('INCÊNDIO')) {
                color = '#ef4444';
                iconCode = 'fa-fire';
                cat = 'incendio';
            } else if (natUpper.includes('ACIDENTE') || natUpper.includes('RESGATE') || natUpper.includes('QUEDA')) {
                color = '#eab308';
                iconCode = 'fa-truck-medical';
                cat = 'resgate';
            }

            const popup = `
                <div style="color: #0a0e17; min-width: 220px; font-family: sans-serif;">
                    <div style="background-color: ${color}; color: white; padding: 6px 10px; border-radius: 6px 6px 0 0; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid ${iconCode}"></i>
                        <span style="flex-1">${item.natureza || 'N/I'}</span>
                    </div>
                    <div style="padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; font-size: 13px; line-height: 1.5;">
                        <b>Talão:</b> ${item.talao}<br>
                        <b>Viatura:</b> ${item.viatura} (${item.prontidao})<br>
                        <b>Data:</b> ${dateStr}<br>
                        <b>QTR Saída:</b> ${item.qtrSaida || 'N/I'}<br>
                        ${item.endereco ? '<b>Local:</b> ' + item.endereco + '<br>' : ''}
                        <b>Cidade:</b> ${item.cidade}<br>
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${latStr},${lngStr}" target="_blank" style="display: block; text-align: center; margin-top: 10px; background: #2563eb; color: white; padding: 6px; border-radius: 4px; text-decoration: none; font-weight: bold;">
                            <i class="fa-solid fa-route"></i> Traçar Rota
                        </a>
                    </div>
                </div>`;
            const marker = L.marker(coords).bindPopup(popup);
            
            if (cat === 'incendio') {
                if (clusterIncendios) clusterIncendios.addLayer(marker);
            } else if (cat === 'resgate') {
                if (clusterResgates) clusterResgates.addLayer(marker);
            } else {
                if (clusterOutros) clusterOutros.addLayer(marker);
            }

            let hour = 24;
            if (item.horaSaida) {
                const parsed = parseInt(item.horaSaida);
                if (!isNaN(parsed)) hour = parsed;
            }
            allMapMarkers.push({ marker, cat, hour });

            // KPIs
            const nat = item.natureza || 'OUTRAS';
            natCount[nat] = (natCount[nat] || 0) + 1;
            
            const cid = item.cidade;
            cityCount[cid] = (cityCount[cid] || 0) + 1;
            
            if (item.tempoMinutos && item.tempoMinutos > 0) {
                tempoTotal += item.tempoMinutos;
                tempoOcorrencias++;
            }
        }

        processed++;
        if (uiCount) uiCount.textContent = `${processed}/${dataToProcess.length}`;
        if (uiProgress) uiProgress.style.width = `${(processed / dataToProcess.length) * 100}%`;
    }

    if (cacheUpdated) localStorage.setItem('dashboard_geocache', JSON.stringify(geocache));
    
    if (uiStatus) uiStatus.classList.add('hidden');

    if (heatPoints.length > 0) {
        fullHeatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15 });
        toggleMapMode(); // Adiciona a layer correta baseada no modo atual

        // Centraliza o mapa
        const bounds = L.latLngBounds(heatPoints);
        fullMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    if (itemsToGeocode.length > 0) {
        processGeocodingBackground(itemsToGeocode, geocache, heatPoints, mapMarkerCluster, signal);
    }

    updateMapStatsUI();

    // Atualiza KPIs da tela
    const kpiTotal = document.getElementById('kpi-map-total');
    if (kpiTotal) kpiTotal.textContent = validPointsCount;

    const kpiHotspot = document.getElementById('kpi-map-hotspot');
    if (kpiHotspot) {
        let topCid = '--'; let maxC = -1;
        for (const [c, v] of Object.entries(cityCount)) { if(v > maxC) { maxC = v; topCid = c; } }
        kpiHotspot.textContent = topCid;
    }

    const kpiTime = document.getElementById('kpi-map-time');
    if (kpiTime) {
        if (tempoOcorrencias > 0) {
            kpiTime.textContent = Math.round(tempoTotal / tempoOcorrencias) + ' min';
        } else {
            kpiTime.textContent = '--';
        }
    }

    // Gráfico de Naturezas local
    if (charts.mapNat) {
        const sortedNats = Object.keys(natCount).sort((a,b)=>natCount[b]-natCount[a]).slice(0,5);
        const dataNat = sortedNats.map(n => ({ name: n, value: natCount[n] }));
        
        charts.mapNat.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { show: false },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: { borderRadius: 3, borderColor: '#0a0e17', borderWidth: 2 },
                label: { show: true, formatter: '{b}', color: '#b0c0d8', fontSize: 9, width: 80, overflow: 'truncate' },
                data: dataNat
            }]
        });
    }
}

// ============================================
// LÓGICA DA ABA VIATURAS
// ============================================
let viaturasDataTable = null;

function initViaturasTab() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    if (charts.vtrCalls) {
        charts.vtrCalls.dispose();
        charts.vtrCalls = null;
    }
    if (charts.vtrKm) {
        charts.vtrKm.dispose();
        charts.vtrKm = null;
    }

    const domCalls = document.getElementById('chart-vtr-calls');
    if (domCalls) charts.vtrCalls = echarts.init(domCalls, isDark ? 'dark' : null);
    
    const domKm = document.getElementById('chart-vtr-km');
    if (domKm) charts.vtrKm = echarts.init(domKm, isDark ? 'dark' : null);
    
    // Inicia datatable
    if (viaturasDataTable) {
        viaturasDataTable.destroy();
    }
    
    if (window.$ && $.fn.DataTable) {
        viaturasDataTable = $('#table-viaturas-detalhe').DataTable({
            data: [], // Será preenchido via update
            columns: [
                { data: 'posicao', className: 'text-center text-yellow-400 font-bold w-12' },
                { data: 'viatura', className: 'font-semibold text-white' },
                { data: 'total', className: 'text-center text-[#b0c0d8]' },
                { data: 'atendidas', className: 'text-center text-green-400 font-bold' },
                { data: 'qta', className: 'text-center text-red-400 font-bold' },
                { data: 'km', className: 'text-center text-[#b0c0d8]' },
                { data: 'kmAvg', className: 'text-center text-[#b0c0d8]' },
                { data: 'timeAvg', className: 'text-center text-[#b0c0d8]' }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
            dom: '<"flex flex-col md:flex-row justify-between items-center mb-4 gap-4 w-full"<"text-sm"l><"text-sm"f>>rt<"flex flex-col md:flex-row justify-between items-center mt-4 text-xs text-[#5a6f8a] w-full"i p>',
            pageLength: 10,
            lengthMenu: [[10, 15, 25, -1], [10, 15, 25, "Todos"]],
            order: [[2, 'desc']], // Ordena por Total Acionamentos desc
            createdRow: function(row) {
                $(row).addClass('border-b border-white/5 hover:bg-white/5 transition text-xs');
            }
        });
    }

    updateViaturasTab();
}

function updateViaturasTab() {
    const data = state.filteredData;
    
    // Processamento
    const mapVtr = {};
    data.forEach(item => {
        const v = item.viatura || 'N/I';
        if (!mapVtr[v]) {
            mapVtr[v] = { 
                viatura: v, total: 0, atendidas: 0, qta: 0, km: 0, tempoTotal: 0 
            };
        }
        mapVtr[v].total++;
        if (item.resultado === 'QTA') mapVtr[v].qta++;
        else mapVtr[v].atendidas++;
        
        mapVtr[v].km += (item.distancia || 0);
        mapVtr[v].tempoTotal += (item.tempoMinutos || 0);
    });

    let vtrList = Object.values(mapVtr).filter(v => v.viatura !== 'N/I');
    vtrList.sort((a, b) => b.total - a.total);

    // Prepara dados da tabela e KPIs
    let maxCalls = 0;
    let topCallsVtr = '--';
    let maxKm = 0;
    let topKmVtr = '--';
    let totalTime = 0;
    let totalCallsForTime = 0;

    vtrList.forEach((v, index) => {
        v.posicao = index + 1;
        v.kmAvg = v.total > 0 ? (v.km / v.total).toFixed(1) : '0.0';
        v.timeAvg = v.total > 0 ? Math.round(v.tempoTotal / v.total) + 'm' : '0m';
        
        v.km = Math.round(v.km);

        if (v.total > maxCalls) { maxCalls = v.total; topCallsVtr = v.viatura; }
        if (v.km > maxKm) { maxKm = v.km; topKmVtr = v.viatura; }
        totalTime += v.tempoTotal;
        totalCallsForTime += v.total;
    });

    // Atualiza KPIs
    document.getElementById('kpi-vtr-top-calls').textContent = topCallsVtr;
    document.getElementById('kpi-vtr-top-km').textContent = topKmVtr;
    const avgTime = totalCallsForTime > 0 ? Math.round(totalTime / totalCallsForTime) : 0;
    document.getElementById('kpi-vtr-avg-time').textContent = avgTime + 'm';

    // Atualiza Tabela
    if (viaturasDataTable) {
        viaturasDataTable.clear();
        viaturasDataTable.rows.add(vtrList);
        viaturasDataTable.draw();
    }

    // Atualiza Gráficos (Top 10 para gráficos)
    const top10 = vtrList.slice(0, 10).reverse(); // reverse para barras horizontais
    
    if (charts.vtrCalls) {
        charts.vtrCalls.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { 
                type: 'value', 
                max: (value) => Math.ceil(value.max * 1.15),
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, 
                axisLabel: { color: '#5a6f8a' } 
            },
            yAxis: { type: 'category', data: top10.map(v => v.viatura), axisLabel: { color: '#b0c0d8', fontWeight: 'bold' } },
            series: [{
                name: 'Acionamentos',
                type: 'bar',
                data: top10.map(v => v.total),
                label: { show: true, position: 'right', color: '#e8edf5', fontWeight: 'bold' },
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#3b82f6' },
                        { offset: 1, color: '#1d4ed8' }
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        });
    }

    if (charts.vtrKm) {
        const topKmList = [...vtrList].sort((a,b) => b.km - a.km).slice(0, 10).reverse();
        
        charts.vtrKm.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} km' },
            grid: { left: '3%', right: '12%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { 
                type: 'value', 
                max: (value) => Math.ceil(value.max * 1.15),
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, 
                axisLabel: { color: '#5a6f8a' } 
            },
            yAxis: { type: 'category', data: topKmList.map(v => v.viatura), axisLabel: { color: '#b0c0d8', fontWeight: 'bold' } },
            series: [{
                name: 'KM Rodado',
                type: 'bar',
                data: topKmList.map(v => v.km),
                label: { show: true, position: 'right', color: '#e8edf5', fontWeight: 'bold', formatter: '{c} km' },
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#eab308' }, // yellow-500
                        { offset: 1, color: '#a16207' }  // yellow-700
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        });
    }
}

// ============================================
// LÓGICA DA ABA PRONTIDÕES
// ============================================
let prontidoesDataTable = null;

function initProntidoesTab() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    if (charts.efetivoCmt) { charts.efetivoCmt.dispose(); charts.efetivoCmt = null; }
    if (charts.efetivoNatPrt) { charts.efetivoNatPrt.dispose(); charts.efetivoNatPrt = null; }

    const domCmt = document.getElementById('chart-efetivo-cmt');
    if (domCmt) charts.efetivoCmt = echarts.init(domCmt, isDark ? 'dark' : null);
    
    const domNatPrt = document.getElementById('chart-efetivo-nat-prt');
    if (domNatPrt) charts.efetivoNatPrt = echarts.init(domNatPrt, isDark ? 'dark' : null);

    window.addEventListener('resize', () => {
        if (charts.efetivoCmt) charts.efetivoCmt.resize();
        if (charts.efetivoNatPrt) charts.efetivoNatPrt.resize();
    });

    if (prontidoesDataTable) {
        prontidoesDataTable.destroy();
    }
    
    if (window.$ && $.fn.DataTable) {
        prontidoesDataTable = $('#table-efetivo-cmt').DataTable({
            data: [],
            columns: [
                { data: 'comandante', className: 'font-bold text-white' },
                { data: 'prontidao', className: 'text-center font-bold' },
                { data: 'atendidas', className: 'text-center text-green-400 font-bold' },
                { data: 'qta', className: 'text-center text-red-400 font-bold' },
                { data: 'topNat', className: 'text-left text-[#b0c0d8] truncate max-w-[150px]' },
                { data: 'topVtr', className: 'text-center text-blue-400' }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json' },
            dom: '<"flex flex-col md:flex-row justify-between items-center mb-4 gap-4 w-full"<"text-sm"l><"text-sm"f>>rt<"flex flex-col md:flex-row justify-between items-center mt-4 text-xs text-[#5a6f8a] w-full"i p>',
            pageLength: 10,
            lengthMenu: [[10, 15, 25, -1], [10, 15, 25, "Todos"]],
            order: [[2, 'desc']], // Ordena por Atendimentos Efetivos desc
            createdRow: function(row, data) {
                $(row).addClass('border-b border-white/5 hover:bg-white/5 transition text-xs');
                let colorClass = 'text-gray-400';
                if (data.prontidao === 'VERDE') colorClass = 'text-green-500';
                else if (data.prontidao === 'AMARELA') colorClass = 'text-yellow-500';
                else if (data.prontidao === 'AZUL') colorClass = 'text-blue-500';
                else if (data.prontidao === 'VERMELHA') colorClass = 'text-red-500';
                $('td:eq(1)', row).addClass(colorClass);
            }
        });
    }

    updateProntidoesTab();
}

function updateProntidoesTab() {
    const data = state.filteredData;
    const colorsMap = { 'VERDE': '#22c55e', 'AMARELA': '#eab308', 'AZUL': '#3b82f6', 'VERMELHA': '#ef4444' };
    
    const mapCmt = {};
    const mapPrt = {};
    const natMap = {}; 
    
    data.forEach(item => {
        let p = item.prontidao || 'N/I';
        if (p === 'TODOS' || p === 'N/I' || p === '') return;
        
        // Agrupamento Prontidão (para os KPIs e Chart)
        if (!mapPrt[p]) mapPrt[p] = 0;
        mapPrt[p]++;

        // Agrupamento Naturezas x Prontidão
        const nat = item.natureza || 'OUTRAS';
        if (!natMap[nat]) natMap[nat] = {};
        natMap[nat][p] = (natMap[nat][p] || 0) + 1;

        // Agrupamento Comandante
        let cmt = item.cmtVtr || 'NÃO INFORMADO';
        if (cmt.trim() === '') cmt = 'NÃO INFORMADO';
        
        if (!mapCmt[cmt]) {
            mapCmt[cmt] = {
                comandante: cmt,
                prontidao: p, // Assumindo que ele está nessa prontidão (pode variar, mas pegamos a última ou a principal)
                prtFreq: {},
                atendidas: 0,
                qta: 0,
                naturezas: {},
                viaturas: {}
            };
        }
        
        mapCmt[cmt].prtFreq[p] = (mapCmt[cmt].prtFreq[p] || 0) + 1;

        if (item.resultado === 'QTA') mapCmt[cmt].qta++;
        else mapCmt[cmt].atendidas++;

        mapCmt[cmt].naturezas[nat] = (mapCmt[cmt].naturezas[nat] || 0) + 1;
        const v = item.viatura || 'N/I';
        mapCmt[cmt].viaturas[v] = (mapCmt[cmt].viaturas[v] || 0) + 1;
    });

    let cmtList = Object.values(mapCmt);
    
    // Calcula Top Nat, Top Vtr e ajusta Prontidão principal para cada CMT
    cmtList.forEach(c => {
        // Natureza
        let maxNat = 0; let topN = '--';
        for (const [n, count] of Object.entries(c.naturezas)) {
            if (count > maxNat) { maxNat = count; topN = n; }
        }
        c.topNat = topN;

        // Viatura
        let maxVtr = 0; let topV = '--';
        for (const [v, count] of Object.entries(c.viaturas)) {
            if (count > maxVtr) { maxVtr = count; topV = v; }
        }
        c.topVtr = topV;

        // Prontidao (a mais frequente para esse cmt no periodo)
        let maxPrt = 0; let topP = c.prontidao;
        for (const [prt, count] of Object.entries(c.prtFreq)) {
            if (count > maxPrt) { maxPrt = count; topP = prt; }
        }
        c.prontidao = topP;
        c.total = c.atendidas + c.qta;
    });

    cmtList = cmtList.filter(c => c.comandante !== 'NÃO INFORMADO');
    cmtList.sort((a, b) => b.atendidas - a.atendidas); // Sort by efetivas

    // KPIs
    let topCmt = cmtList.length > 0 ? cmtList[0].comandante : '--';
    
    let topPrtName = '--';
    let maxPrtCalls = -1;
    for (const [p, count] of Object.entries(mapPrt)) {
        if (count > maxPrtCalls) { maxPrtCalls = count; topPrtName = p; }
    }

    let topGlobalNat = '--';
    let maxNatCalls = -1;
    for (const [n, prtObj] of Object.entries(natMap)) {
        const sum = Object.values(prtObj).reduce((acc, v) => acc + v, 0);
        if (sum > maxNatCalls) { maxNatCalls = sum; topGlobalNat = n; }
    }

    const setKpiText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    setKpiText('kpi-efetivo-top-cmt', topCmt);
    setKpiText('kpi-efetivo-top-nat', topGlobalNat);
    
    const prtEl = document.getElementById('kpi-efetivo-top-prt');
    if (prtEl) {
        prtEl.textContent = topPrtName;
        prtEl.className = 'text-sm md:text-base font-bold mt-1 leading-tight';
        if (topPrtName === 'VERDE') prtEl.classList.add('text-green-400');
        else if (topPrtName === 'AMARELA') prtEl.classList.add('text-yellow-400');
        else if (topPrtName === 'AZUL') prtEl.classList.add('text-blue-400');
        else if (topPrtName === 'VERMELHA') prtEl.classList.add('text-red-400');
        else prtEl.classList.add('text-white');
    }

    // Tabela
    if (prontidoesDataTable) {
        prontidoesDataTable.clear();
        prontidoesDataTable.rows.add(cmtList);
        prontidoesDataTable.draw();
    }

    // Chart: Top Comandantes
    if (charts.efetivoCmt) {
        const top10 = cmtList.slice(0, 10).reverse();
        charts.efetivoCmt.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '12%', bottom: '5%', top: '5%', containLabel: true },
            xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#5a6f8a' } },
            yAxis: { type: 'category', data: top10.map(c => c.comandante), axisLabel: { color: '#b0c0d8', fontWeight: 'bold', width: 150, overflow: 'truncate' } },
            series: [{
                name: 'Atendimentos',
                type: 'bar',
                barMaxWidth: 20,
                data: top10.map(c => ({
                    value: c.atendidas,
                    itemStyle: { color: colorsMap[c.prontidao] || '#3b82f6' }
                })),
                label: { show: true, position: 'right', color: '#e8edf5', fontWeight: 'bold' },
                itemStyle: { borderRadius: [0, 4, 4, 0] }
            }]
        });
    }

    // Chart: Natureza x Prontidão
    if (charts.efetivoNatPrt) {
        const sortedNats = Object.keys(natMap).sort((a, b) => {
            const sumA = Object.values(natMap[a]).reduce((acc, val) => acc + val, 0);
            const sumB = Object.values(natMap[b]).reduce((acc, val) => acc + val, 0);
            return sumB - sumA;
        }).slice(0, 7).reverse();

        const prtNames = Object.keys(mapPrt);
        const seriesData = prtNames.map(p => {
            return {
                name: p,
                type: 'bar',
                stack: 'total',
                barMaxWidth: 25,
                label: { show: true, formatter: (prm) => prm.value > 0 ? prm.value : '' },
                itemStyle: { color: colorsMap[p] || '#94a3b8', borderRadius: [0,0,0,0] },
                data: sortedNats.map(nat => natMap[nat][p] || 0)
            };
        });

        if (seriesData.length > 0) {
            seriesData[seriesData.length - 1].itemStyle.borderRadius = [0, 4, 4, 0];
            seriesData[0].itemStyle.borderRadius = [4, 0, 0, 4];
        }

        charts.efetivoNatPrt.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: prtNames, bottom: 0, textStyle: { color: '#7a8ba8' } },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '5%', containLabel: true },
            xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            yAxis: { type: 'category', data: sortedNats, axisLabel: { color: '#b0c0d8', width: 220, overflow: 'truncate' } },
            series: seriesData
        });
    }
}

// ============================================
// LÓGICA DA ABA TIMELINE
// ============================================

function initTimelineTab() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    
    if (charts.timelineHeatmap) {
        charts.timelineHeatmap.dispose();
        charts.timelineHeatmap = null;
    }

    const domHeatmap = document.getElementById('chart-timeline-heatmap');
    if (domHeatmap) {
        charts.timelineHeatmap = echarts.init(domHeatmap, isDark ? 'dark' : null);
    }

    updateTimelineTab();
}

function updateTimelineTab() {
    if (!state.filteredData || state.filteredData.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#e5e7eb' : '#1e293b';

    // 1. DADOS DO HEATMAP (Dias x Horas)
    const hours = Array.from({length: 24}, (_, i) => i + 'h');
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Matriz de dados [hourIndex, dayIndex, count]
    const heatmapDataMap = new Map();

    // 2. DADOS DO FEED (Cronológico)
    const feedItems = [];

    state.filteredData.forEach(item => {
        if (!item.data) return;
        
        try {
            // Heatmap
            const dayIdx = item.data.getDay(); // 0-6
            
            let hourIdx = 0;
            let minIdx = 0;
            
            if (item.qtrSaida) {
                const qtrStr = String(item.qtrSaida);
                if (qtrStr.includes(':')) {
                    const parts = qtrStr.split(':');
                    // Pode ter vindo como string de data: "Sat Dec 30 1899 08:15:00"
                    let p0 = parts[0].trim();
                    if (p0.length > 2) p0 = p0.slice(-2); 
                    hourIdx = parseInt(p0, 10);
                    minIdx = parseInt(parts[1], 10);
                } else {
                    hourIdx = parseInt(qtrStr, 10);
                }
            }
            
            if (isNaN(hourIdx) || hourIdx < 0 || hourIdx > 23) {
                hourIdx = 0;
                minIdx = 0;
            }

            const key = `${hourIdx}-${dayIdx}`;
            heatmapDataMap.set(key, (heatmapDataMap.get(key) || 0) + 1);

            // Feed
            const itemDate = new Date(item.data.getTime());
            itemDate.setHours(hourIdx, isNaN(minIdx) ? 0 : minIdx, 0, 0);

            feedItems.push({
                dateObj: itemDate,
                hora: `${hourIdx.toString().padStart(2, '0')}:${(isNaN(minIdx) ? 0 : minIdx).toString().padStart(2, '0')}`,
                natureza: item.natureza || 'N/I',
                viatura: item.viatura || 'N/I',
                prontidao: item.prontidao || 'N/I',
                cmt: item.cmtVtr || 'N/I',
                endereco: item.endereco || '',
                cidade: item.cidade || '',
                tempo: item.tempoMinutos || 0,
                status: (item.qtrLocal || item.qta) ? 'Atendida' : 'N/I'
            });

        } catch (e) { }
    });

    // --- Render Heatmap ---
    if (charts.timelineHeatmap) {
        const heatmapSeriesData = [];
        let maxVal = 0;
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const val = heatmapDataMap.get(`${h}-${d}`) || 0;
                heatmapSeriesData.push([h, d, val]);
                if (val > maxVal) maxVal = val;
            }
        }

        charts.timelineHeatmap.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                position: 'top',
                formatter: function (p) {
                    return `${days[p.data[1]]} às ${hours[p.data[0]]}: ${p.data[2]} ocorrências`;
                }
            },
            grid: { top: 10, bottom: 25, left: 35, right: 10 },
            xAxis: {
                type: 'category',
                data: hours,
                splitArea: { show: true },
                axisLabel: { color: textColor, fontSize: 10 }
            },
            yAxis: {
                type: 'category',
                data: days,
                splitArea: { show: true },
                axisLabel: { color: textColor, fontSize: 10 }
            },
            visualMap: {
                min: 0,
                max: maxVal || 10,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: -20,
                show: false,
                inRange: {
                    color: isDark 
                        ? ['#0a0e17', '#1e3a8a', '#2563eb', '#9333ea', '#ec4899', '#ef4444'] 
                        : ['#f8fafc', '#bfdbfe', '#60a5fa', '#a855f7', '#ec4899', '#ef4444']
                }
            },
            series: [{
                name: 'Ocorrências',
                type: 'heatmap',
                data: heatmapSeriesData,
                label: { show: false },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }
            }]
        });
    }

    // --- Render Feed ---
    const feedContainer = document.getElementById('timeline-feed');
    if (feedContainer) {
        // Ordena mais recentes primeiro
        feedItems.sort((a, b) => b.dateObj - a.dateObj);
        
        // Limita a 100 itens para não pesar
        const renderItems = feedItems.slice(0, 100);
        
        if (renderItems.length === 0) {
            feedContainer.innerHTML = `<div class="text-center text-sm text-gray-500 mt-10">Nenhuma ocorrência encontrada.</div>`;
            return;
        }

        let html = '';
        renderItems.forEach((item, index) => {
            // Cor da prontidao
            let prtColor = 'bg-gray-500';
            if(item.prontidao.toUpperCase().includes('AZUL')) prtColor = 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
            if(item.prontidao.toUpperCase().includes('VERDE')) prtColor = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
            if(item.prontidao.toUpperCase().includes('AMARELA')) prtColor = 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
            if(item.prontidao.toUpperCase().includes('VERMELHA')) prtColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';

            const dataStr = item.dateObj.toLocaleDateString('pt-BR');

            html += `
                <div class="flex items-start gap-4 relative z-10 mb-4 transition-all hover:translate-x-1">
                    <!-- Bola / Icone -->
                    <div class="w-12 h-12 rounded-2xl ${prtColor} flex items-center justify-center text-white flex-shrink-0 relative z-10 border border-white/20 mt-1">
                        <i class="fa-solid fa-fire-extinguisher text-lg"></i>
                    </div>
                    
                    <!-- Card de conteúdo -->
                    <div class="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition group">
                        <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                            <h3 class="text-sm font-bold text-white group-hover:text-blue-400 transition">${item.natureza}</h3>
                            <div class="text-[10px] font-bold text-[#5a6f8a] bg-[#0a0e17] px-2 py-1 rounded-lg border border-white/5 self-start md:self-auto">
                                ${dataStr} às <span class="text-white">${item.hora}</span>
                            </div>
                        </div>
                        
                        <div class="text-xs text-[#b0c0d8] leading-relaxed mb-3">
                            ${item.endereco ? item.endereco + ' - ' : ''}${item.cidade}
                        </div>
                        
                        <div class="flex flex-wrap gap-2 text-[10px] font-semibold text-gray-400">
                            <span class="bg-[#0a0e17]/50 px-2 py-1 rounded-md border border-white/5"><i class="fa-solid fa-truck-fire mr-1 text-gray-500"></i> ${item.viatura}</span>
                            <span class="bg-[#0a0e17]/50 px-2 py-1 rounded-md border border-white/5"><i class="fa-solid fa-user mr-1 text-gray-500"></i> ${item.cmt}</span>
                            <span class="bg-[#0a0e17]/50 px-2 py-1 rounded-md border border-white/5"><i class="fa-regular fa-clock mr-1 text-gray-500"></i> ${item.tempo} min</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        feedContainer.innerHTML = html;
    }
}

// ============================================
// LÓGICA DA ABA DEJEM
// ============================================

function initDejemTab() {
    if (!stateDejem.isLoaded) {
        initDejemStore().then(() => {
            setupDejemFilters();
            renderDejemTable();
        });
    } else {
        setupDejemFilters();
        renderDejemTable();
    }
}

function setupDejemFilters() {
    const selEb = document.getElementById('dejem-filter-eb');
    if (selEb && selEb.options.length <= 1) {
        const ebs = getUniqueDejemValues('eb');
        ebs.forEach(eb => {
            const opt = document.createElement('option');
            opt.value = eb;
            opt.textContent = eb;
            selEb.appendChild(opt);
        });
    }

    const inputNome = document.getElementById('dejem-filter-nome');
    const inputId = document.getElementById('dejem-filter-id');
    const inputDateStart = document.getElementById('dejem-filter-dateStart');
    const inputDateEnd = document.getElementById('dejem-filter-dateEnd');

    if (inputNome) {
        inputNome.value = stateDejem.filters.nome;
        inputNome.oninput = (e) => {
            setDejemFilter('nome', e.target.value);
            applyDejemFilters();
        };
    }
    
    if (inputId) {
        inputId.value = stateDejem.filters.id;
        inputId.oninput = (e) => {
            setDejemFilter('id', e.target.value);
            applyDejemFilters();
        };
    }
    
    if (inputDateStart) {
        inputDateStart.value = stateDejem.filters.dateStart;
        inputDateStart.onchange = (e) => {
            setDejemFilter('dateStart', e.target.value);
            applyDejemFilters();
        };
    }
    
    if (inputDateEnd) {
        inputDateEnd.value = stateDejem.filters.dateEnd;
        inputDateEnd.onchange = (e) => {
            setDejemFilter('dateEnd', e.target.value);
            applyDejemFilters();
        };
    }
    
    if (selEb) {
        selEb.value = stateDejem.filters.eb;
        selEb.onchange = (e) => {
            setDejemFilter('eb', e.target.value);
            applyDejemFilters();
        };
    }
}

window.addEventListener('dejemDataUpdated', (e) => {
    if (window.location.hash.includes('dejem')) {
        renderDejemTable();
    }
});

function renderDejemTable() {
    const tbody = document.getElementById('dejem-table-body');
    const totalCount = document.getElementById('dejem-total-count');
    
    if (!tbody || !stateDejem.filteredData) return;

    if (totalCount) {
        totalCount.textContent = `${stateDejem.filteredData.length} Registros`;
    }

    if (stateDejem.filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    let html = '';
    stateDejem.filteredData.forEach(item => {
        const dataStr = item.data ? item.data.toLocaleDateString('pt-BR') : 'N/I';
        
        let statusBadge = '';
        if (item.escalado === 'ESCALADO') {
            statusBadge = `<span class="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold">ESCALADO</span>`;
        } else if (item.escalado === 'NÃO ESCALADO') {
            statusBadge = `<span class="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold">NÃO ESCALADO</span>`;
        } else {
            statusBadge = `<span class="bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-0.5 rounded text-[10px] font-bold">${item.escalado}</span>`;
        }

        html += `
            <tr class="hover:bg-white/5 transition">
                <td class="px-4 py-3 border-b border-white/5 font-mono text-xs text-blue-400">${item.id}</td>
                <td class="px-4 py-3 border-b border-white/5 font-bold">${item.nome}</td>
                <td class="px-4 py-3 border-b border-white/5">${statusBadge}</td>
                <td class="px-4 py-3 border-b border-white/5 text-xs text-[#5a6f8a]">${dataStr}</td>
                <td class="px-4 py-3 border-b border-white/5 text-xs text-[#5a6f8a]">${item.horaInicio} - ${item.horaFim}</td>
                <td class="px-4 py-3 border-b border-white/5 text-xs font-bold text-gray-300">${item.eb}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ============================================
// LÓGICA DA ABA ABASTECIMENTO
// ============================================

function initAbastecimentoTab() {
    if (!stateAbastecimento.isLoaded) {
        initAbastecimentoStore().then(() => {
            setupAbastecimentoFilters();
            renderAbastecimentoDashboard();
        });
    } else {
        setupAbastecimentoFilters();
        renderAbastecimentoDashboard();
    }
}

function setupAbastecimentoFilters() {
    const inputPrefixo = document.getElementById('abast-filter-prefixo');
    const inputDateStart = document.getElementById('abast-filter-dateStart');
    const inputDateEnd = document.getElementById('abast-filter-dateEnd');

    if (inputPrefixo) {
        // Popula as opções únicas
        const prefixos = getUniqueAbastecimentoValues('prefixo');
        let htmlOpts = '<option value="" class="bg-[#0a0e17] text-white">TODAS AS VIATURAS</option>';
        prefixos.forEach(p => {
            htmlOpts += `<option value="${p}" class="bg-[#0a0e17] text-white">${p}</option>`;
        });
        inputPrefixo.innerHTML = htmlOpts;
        
        inputPrefixo.value = stateAbastecimento.filters.prefixo;
        inputPrefixo.onchange = (e) => {
            setAbastecimentoFilter('prefixo', e.target.value);
            applyAbastecimentoFilters();
        };
    }
    
    if (inputDateStart) {
        inputDateStart.value = stateAbastecimento.filters.dateStart;
        inputDateStart.onchange = (e) => {
            setAbastecimentoFilter('dateStart', e.target.value);
            applyAbastecimentoFilters();
        };
    }
    
    if (inputDateEnd) {
        inputDateEnd.value = stateAbastecimento.filters.dateEnd;
        inputDateEnd.onchange = (e) => {
            setAbastecimentoFilter('dateEnd', e.target.value);
            applyAbastecimentoFilters();
        };
    }
}

window.addEventListener('abastecimentoDataUpdated', (e) => {
    if (window.location.hash.includes('abastecimento')) {
        renderAbastecimentoDashboard();
    }
});

function renderAbastecimentoDashboard() {
    const tbody = document.getElementById('abast-table-body');
    const tableEl = document.getElementById('abast-table');
    const cardValor = document.getElementById('abast-card-valor');
    const cardVolume = document.getElementById('abast-card-volume');
    const cardCount = document.getElementById('abast-card-count');
    const cardKml = document.getElementById('abast-card-kml');
    
    if (!tbody || !stateAbastecimento.filteredData) return;

    let totalValor = 0;
    let totalVolume = 0;
    const count = stateAbastecimento.filteredData.length;

    // Cálculo de Km/L por Viatura
    let veiculos = {};
    stateAbastecimento.filteredData.forEach(item => {
        if (!item.prefixo) return;
        if (!veiculos[item.prefixo]) veiculos[item.prefixo] = [];
        veiculos[item.prefixo].push(item);
    });

    let totalValidDistance = 0;
    let totalValidVolume = 0;

    for (let prefixo in veiculos) {
        let registros = veiculos[prefixo];
        // Ordena por Km para garantir a cronologia correta
        registros.sort((a, b) => a.km - b.km);
        
        if (registros.length > 1) {
            let kmInicial = registros[0].km;
            let kmFinal = registros[registros.length - 1].km;
            
            // Set the first row's kml_linha to empty
            registros[0].kml_linha = '--';
            
            // Soma o volume de TODOS, exceto do primeiro (índice 0) e calcula consumo por trecho
            let volumeUsado = 0;
            for (let i = 1; i < registros.length; i++) {
                let volTrecho = registros[i].volume;
                volumeUsado += volTrecho;
                
                let distTrecho = registros[i].km - registros[i-1].km;
                if (distTrecho > 0 && volTrecho > 0) {
                    registros[i].kml_linha = (distTrecho / volTrecho).toFixed(1).replace('.', ',');
                } else {
                    registros[i].kml_linha = '--';
                }
            }

            if (kmFinal > kmInicial && volumeUsado > 0) {
                totalValidDistance += (kmFinal - kmInicial);
                totalValidVolume += volumeUsado;
            }
        }
    }

    let avgKml = '--';
    if (totalValidVolume > 0 && totalValidDistance > 0) {
        avgKml = (totalValidDistance / totalValidVolume).toFixed(2).replace('.', ',');
    }

    // Ordenação decrescente por Data
    stateAbastecimento.filteredData.sort((a, b) => b.data - a.data);

    let html = '';
    
    if (count === 0) {
        html = `<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>`;
    } else {
        if (abastDataTable) {
            abastDataTable.destroy();
        }
        
        stateAbastecimento.filteredData.forEach(item => {
            totalValor += item.valor;
            totalVolume += item.volume;
            
            const dataStr = item.data ? item.data.toLocaleDateString('pt-BR') : 'N/I';
            const valFormated = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor);
            const volFormated = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.volume) + ' L';
            const kmFormated = new Intl.NumberFormat('pt-BR').format(item.km);
            
            const kmlStr = item.kml_linha ? item.kml_linha : '--';

            html += `
                <tr class="hover:bg-white/5 transition">
                    <td class="px-4 py-3 border-b border-white/5 text-xs text-[#5a6f8a]">${dataStr}</td>
                    <td class="px-4 py-3 border-b border-white/5 font-mono font-bold text-emerald-400">${item.prefixo}</td>
                    <td class="px-4 py-3 border-b border-white/5 font-mono text-xs text-gray-400">${item.placa}</td>
                    <td class="px-4 py-3 border-b border-white/5 font-bold text-xs">${item.responsavel}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-xs text-gray-300">${kmFormated}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-xs text-blue-400 font-bold text-right">${volFormated}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-xs text-red-400 font-bold text-right">${valFormated}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-xs text-purple-400 font-bold text-right bg-purple-500/5">${kmlStr}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-[10px] text-gray-400 max-w-[200px] truncate" title="${item.posto}">${item.posto}</td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;
    
    // Iniciar DataTables
    if (count > 0 && tableEl) {
        abastDataTable = new simpleDatatables.DataTable(tableEl, {
            searchable: true,
            fixedHeight: true,
            perPage: 15,
            labels: {
                placeholder: "Pesquisar abastecimento...",
                perPage: "itens por página",
                noRows: "Nenhum registro encontrado",
                info: "Mostrando {start} até {end} de {rows} registros",
            }
        });
    }
    
    if (cardCount) cardCount.textContent = count;
    if (cardValor) cardValor.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor);
    if (cardVolume) cardVolume.textContent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(totalVolume) + ' L';
    if (cardKml) cardKml.textContent = avgKml;
}

// Processamento assíncrono de Geocoding (Não bloqueia a tela)
async function processGeocodingBackground(itemsToGeocode, geocache, heatPoints, mapMarkerCluster, signal) {
    const uiStatus = document.getElementById('geocoding-status');
    const uiCount = document.getElementById('geocoding-count');
    const uiProgress = document.getElementById('geocoding-progress');
    
    if (uiStatus) uiStatus.classList.remove('hidden');

    let processed = 0;
    const total = itemsToGeocode.length;
    let cacheUpdated = false;

    for (const { item, query } of itemsToGeocode) {
        if (signal && signal.aborted) return;
        
        try {
            await new Promise(r => setTimeout(r, 1000)); // 1 req/s nominatim limit
            if (signal && signal.aborted) return;

            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { signal });
            const resData = await response.json();
            
            if (resData && resData.length > 0) {
                const coords = [parseFloat(resData[0].lat), parseFloat(resData[0].lon)];
                geocache[query] = coords;
                cacheUpdated = true;
                
                heatPoints.push(coords);
                globalMappedPoints++;
                updateMapStatsUI();
                
                // Add popup
                const dateStr = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '';
                const popup = `
                    <div style="color: #0a0e17; min-width: 200px; font-family: sans-serif;">
                        <strong style="color: #2563eb; display:block; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 4px;">${item.natureza || 'N/I'}</strong>
                        <div style="font-size: 12px; line-height: 1.4;">
                            <b>Talão:</b> ${item.talao}<br>
                            <b>Viatura:</b> ${item.viatura} (${item.prontidao})<br>
                            <b>Data:</b> ${dateStr}<br>
                            <b>Tempo Resp:</b> ${item.tempoMinutos ? item.tempoMinutos + ' min' : 'N/I'}<br>
                            ${item.endereco ? '<b>Local:</b> ' + item.endereco + '<br>' : ''}
                            <b>Cidade:</b> ${item.cidade}
                        </div>
                    </div>`;
                const marker = L.marker(coords).bindPopup(popup);
                
                // Adiciona ao cluster correspondente
                let cat = 'outros';
                if (item.natureza) {
                    const nat = item.natureza.toLowerCase();
                    if (nat.includes('incêndio') || nat.includes('fogo')) cat = 'incendio';
                    else if (nat.includes('resgate') || nat.includes('acidente') || nat.includes('salvamento') || nat.includes('atropelamento') || nat.includes('queda')) cat = 'resgate';
                }

                if (cat === 'incendio' && clusterIncendios) clusterIncendios.addLayer(marker);
                else if (cat === 'resgate' && clusterResgates) clusterResgates.addLayer(marker);
                else if (clusterOutros) clusterOutros.addLayer(marker);

                let hour = 24;
                if (item.horaSaida) {
                    const parsed = parseInt(item.horaSaida);
                    if (!isNaN(parsed)) hour = parsed;
                }
                allMapMarkers.push({ marker, cat, hour });
                
                // Update Heatmap if active
                if (fullHeatLayer) {
                    fullHeatLayer.setLatLngs(heatPoints);
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') console.warn("Geocoding background err:", err);
        }

        processed++;
        if (uiCount) uiCount.textContent = `${processed}/${total}`;
        if (uiProgress) uiProgress.style.width = `${(processed / total) * 100}%`;
    }

    if (cacheUpdated) localStorage.setItem('dashboard_geocache', JSON.stringify(geocache));
    if (uiStatus) uiStatus.classList.add('hidden');
}

let globalTotalMapPoints = 0;
let globalMappedPoints = 0;

function updateMapStatsUI() {
    const domStats = document.getElementById('map-render-stats');
    const domPct = document.getElementById('map-render-pct');
    const domMissing = document.getElementById('map-render-missing');
    
    if (domStats && domPct && domMissing && globalTotalMapPoints > 0) {
        domStats.classList.remove('hidden');
        const pct = Math.round((globalMappedPoints / globalTotalMapPoints) * 100);
        const missing = globalTotalMapPoints - globalMappedPoints;
        
        domPct.textContent = `${pct}%`;
        domPct.className = `font-bold text-sm leading-none ${pct >= 90 ? 'text-green-400' : (pct >= 70 ? 'text-yellow-400' : 'text-red-400')}`;
        domMissing.textContent = missing;
    }
}
