/**
 * filters.js - Versão 3.0 (Tailwind v4)
 * Injeta e gerencia os filtros globais nas páginas secundárias
 */

import { state, setFilter, applyFilters, getUniqueValues } from '../store/dataStore.js';

export function renderFilters() {
    const container = document.getElementById('filters-container');
    if (!container) return;

    // Estrutura HTML idêntica à Home usando Tailwind v4
    container.className = 'glass-panel p-3.5 rounded-3xl z-10 flex flex-wrap items-end gap-3';
    container.innerHTML = `
        <div class="flex-1 min-w-[120px]">
            <label class="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">ID / TALÃO</label>
            <input type="text" id="filter-id" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition" placeholder="Ex: 8604016">
        </div>
        <div class="flex-1 min-w-[130px]">
            <label class="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">DATA INICIAL</label>
            <input type="text" id="filter-date-start" class="flatpickr-date w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition" placeholder="dd/mm/aaaa">
        </div>
        <div class="flex-1 min-w-[130px]">
            <label class="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">DATA FINAL</label>
            <input type="text" id="filter-date-end" class="flatpickr-date w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition" placeholder="dd/mm/aaaa">
        </div>
        <div class="flex-1 min-w-[120px]">
            <label class="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">PRONTIDÃO</label>
            <select id="filter-prontidao" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition">
                <option value="TODOS">TODOS</option>
                <option value="VERDE">VERDE</option>
                <option value="AMARELA">AMARELA</option>
                <option value="AZUL">AZUL</option>
            </select>
        </div>
        <div class="flex-1 min-w-[120px]">
            <label class="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">VIATURA</label>
            <select id="filter-viatura" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition">
                <option value="TODOS">TODOS</option>
            </select>
        </div>
        <div class="flex gap-2 shrink-0">
            <button class="bg-[#10b981]/15 hover:bg-[#10b981]/30 border border-[#10b981]/50 text-[#10b981] px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer" id="btn-search">
                <i class="fa-solid fa-magnifying-glass mr-1"></i> Pesquisar
            </button>
            <button class="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer" id="btn-clear">
                <i class="fa-solid fa-trash-can mr-1"></i> Limpar
            </button>
        </div>
    `;

    // Popular o Select de Viatura
    const viaturaSelect = document.getElementById('filter-viatura');
    if (viaturaSelect) {
        const viaturas = getUniqueValues('viatura');
        viaturas.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            if (state.filters.viatura === v) opt.selected = true;
            viaturaSelect.appendChild(opt);
        });
    }

    // Setar valores existentes e Prontidão estática
    const prontidaoSelect = document.getElementById('filter-prontidao');
    if (prontidaoSelect && state.filters.prontidao) prontidaoSelect.value = state.filters.prontidao;
    if (state.filters.talao) document.getElementById('filter-id').value = state.filters.talao;
    if (state.filters.dateStart) document.getElementById('filter-date-start').value = state.filters.dateStart;
    if (state.filters.dateEnd) document.getElementById('filter-date-end').value = state.filters.dateEnd;

    // Iniciar Flatpickr nos inputs de data
    if (window.flatpickr) {
        flatpickr(".flatpickr-date", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            locale: "pt",
            theme: "dark"
        });
    }

    // Vincular Eventos
    document.getElementById('btn-search').addEventListener('click', () => {
        setFilter('talao', document.getElementById('filter-id').value.trim());
        setFilter('dateStart', document.getElementById('filter-date-start').value);
        setFilter('dateEnd', document.getElementById('filter-date-end').value);
        setFilter('prontidao', document.getElementById('filter-prontidao').value);
        setFilter('viatura', document.getElementById('filter-viatura').value);
        applyFilters();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        document.getElementById('filter-id').value = '';
        document.getElementById('filter-date-start')._flatpickr.clear();
        document.getElementById('filter-date-end')._flatpickr.clear();
        document.getElementById('filter-prontidao').value = 'TODOS';
        document.getElementById('filter-viatura').value = 'TODOS';

        setFilter('talao', '');
        setFilter('dateStart', '');
        setFilter('dateEnd', '');
        setFilter('prontidao', 'TODOS');
        setFilter('viatura', 'TODOS');
        applyFilters();
    });
}
