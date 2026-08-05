import { fetchSpreadsheetData, fetchDejemData } from '../api/sheets.js';

const CACHE_KEY = 'dashboard_data_cache_v3';
const CACHE_TIME_KEY = 'dashboard_data_time_v2';
const CACHE_FILTERS_KEY = 'dashboard_filters_v2';
const CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos (conformeApps Script trigger)

function getPastDateStr(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

export const state = {
    rawData: [],
    filteredData: [],
    filters: {
        talao: '',
        dateStart: getPastDateStr(30),
        dateEnd: getPastDateStr(0),
        prontidao: 'TODOS',
        viatura: 'TODOS'
    },
    lastUpdate: null,
    isLoaded: false
};

export async function initDataStore() {
    showLoader();
    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedFilters = localStorage.getItem(CACHE_FILTERS_KEY);
        
        const now = new Date().getTime();
        
        if (cachedFilters) {
            try {
                const parsedFilters = JSON.parse(cachedFilters);
                delete parsedFilters.dateStart; // Sempre forçar os 30 dias ao carregar a página
                delete parsedFilters.dateEnd;
                state.filters = { ...state.filters, ...parsedFilters };
            } catch(e) {}
        }

        let hasValidCache = false;
        if (cachedData && cacheTime && (now - parseInt(cacheTime)) < CACHE_EXPIRATION_MS) {
            try {
                const parsed = JSON.parse(cachedData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Reconverte strings de data de volta para objetos Date
                    state.rawData = parsed.map(item => {
                        item.data = new Date(item.data);
                        return item;
                    });
                    state.lastUpdate = new Date(parseInt(cacheTime));
                    hasValidCache = true;
                    console.log("Carregando dados do LocalStorage (Cache)");
                }
            } catch (e) {
                console.warn("Erro ao fazer o parse do cache:", e);
            }
        }

        if (!hasValidCache) {
            console.log("Buscando dados da Planilha Google");
            state.rawData = await fetchSpreadsheetData();
            state.lastUpdate = new Date();
            
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(state.rawData));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
            } catch (e) {
                console.warn("Não foi possível salvar no LocalStorage", e);
            }
        }
        
        state.isLoaded = true;
        applyFilters();
        updateLastUpdateUI();
        
    } catch (error) {
        console.error("Erro ao inicializar DataStore:", error);
        alert("Falha ao carregar os dados. Verifique sua conexão e tente atualizar a página.");
    } finally {
        hideLoader();
    }
}

export function setFilter(key, value) {
    if (state.filters.hasOwnProperty(key)) {
        state.filters[key] = value;
        localStorage.setItem(CACHE_FILTERS_KEY, JSON.stringify(state.filters));
    }
}

export function getUniqueValues(field) {
    const values = state.rawData.map(item => item[field]).filter(val => val && val.toString().trim() !== '');
    return [...new Set(values)].sort();
}

export function applyFilters() {
    state.filteredData = state.rawData.filter(item => {
        let match = true;
        
        // 1. Filtro de Talão (Texto/Busca parcial)
        if (state.filters.talao && !item.talao.includes(state.filters.talao)) {
            match = false;
        }

        // 2. Filtro de Período (Datas)
        if (state.filters.dateStart) {
            const start = new Date(state.filters.dateStart + 'T00:00:00');
            if (item.data < start) match = false;
        }
        if (state.filters.dateEnd) {
            const end = new Date(state.filters.dateEnd + 'T23:59:59');
            if (item.data > end) match = false;
        }

        // 3. Selects
        const prontidaoFilter = state.filters.prontidao || 'TODOS';
        if (prontidaoFilter !== 'TODOS' && item.prontidao !== prontidaoFilter) {
            match = false;
        }
        
        const viaturaFilter = state.filters.viatura || 'TODOS';
        if (viaturaFilter !== 'TODOS' && item.viatura !== viaturaFilter) {
            match = false;
        }
        
        return match;
    });

    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: state.filteredData }));
}

function showLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.classList.remove('hidden', 'opacity-0');
        loader.classList.add('flex', 'opacity-100');
    }
}

function hideLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.classList.remove('opacity-100');
        loader.classList.add('opacity-0');
        setTimeout(() => {
            loader.classList.remove('flex');
            loader.classList.add('hidden');
        }, 300);
    }
}

function updateLastUpdateUI() {
    const el = document.getElementById('last-update-time');
    if (el && state.lastUpdate) {
        el.textContent = state.lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' + state.lastUpdate.toLocaleDateString('pt-BR');
    }
}

export function forceRefresh() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    initDataStore();
}

// ==========================================
// STORE DEJEM
// ==========================================
export const stateDejem = {
    rawData: [],
    filteredData: [],
    filters: {
        nome: '',
        dateStart: getPastDateStr(0),
        dateEnd: '',
        eb: 'TODOS',
        id: ''
    },
    isLoaded: false
};

export async function initDejemStore() {
    showLoader();
    try {
        const CACHE_DEJEM_KEY = 'dashboard_dejem_cache_v1';
        const CACHE_DEJEM_TIME = 'dashboard_dejem_time_v1';
        const now = new Date().getTime();
        
        const cachedData = localStorage.getItem(CACHE_DEJEM_KEY);
        const cacheTime = localStorage.getItem(CACHE_DEJEM_TIME);
        
        let hasValidCache = false;
        if (cachedData && cacheTime && (now - parseInt(cacheTime)) < CACHE_EXPIRATION_MS) {
            try {
                const parsed = JSON.parse(cachedData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    stateDejem.rawData = parsed.map(item => {
                        if (item.data) item.data = new Date(item.data);
                        return item;
                    });
                    hasValidCache = true;
                }
            } catch (e) {}
        }

        if (!hasValidCache) {
            console.log("Buscando dados da Planilha DEJEM");
            stateDejem.rawData = await fetchDejemData();
            try {
                localStorage.setItem(CACHE_DEJEM_KEY, JSON.stringify(stateDejem.rawData));
                localStorage.setItem(CACHE_DEJEM_TIME, now.toString());
            } catch (e) {}
        }
        
        stateDejem.isLoaded = true;
        applyDejemFilters();
        
    } catch (error) {
        console.error("Erro ao inicializar DejemStore:", error);
    } finally {
        hideLoader();
    }
}

export function setDejemFilter(key, value) {
    if (stateDejem.filters.hasOwnProperty(key)) {
        stateDejem.filters[key] = value;
    }
}

export function getUniqueDejemValues(field) {
    const values = stateDejem.rawData.map(item => item[field]).filter(val => val && val.toString().trim() !== '');
    return [...new Set(values)].sort();
}

export function applyDejemFilters() {
    stateDejem.filteredData = stateDejem.rawData.filter(item => {
        let match = true;
        
        if (stateDejem.filters.nome && !item.nome.includes(stateDejem.filters.nome.toUpperCase())) match = false;
        if (stateDejem.filters.id && !item.id.includes(stateDejem.filters.id)) match = false;
        
        if (stateDejem.filters.dateStart) {
            const start = new Date(stateDejem.filters.dateStart + 'T00:00:00');
            if (item.data && item.data < start) match = false;
        }
        if (stateDejem.filters.dateEnd) {
            const end = new Date(stateDejem.filters.dateEnd + 'T23:59:59');
            if (item.data && item.data > end) match = false;
        }

        const ebFilter = stateDejem.filters.eb || 'TODOS';
        if (ebFilter !== 'TODOS' && item.eb !== ebFilter) match = false;
        
        return match;
    });

    window.dispatchEvent(new CustomEvent('dejemDataUpdated', { detail: stateDejem.filteredData }));
}
