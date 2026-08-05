/**
 * ocorrencias.js - Versão 2.0
 * Lógica específica para a página de Ocorrências (DataTables)
 */

import { initTheme } from '../layout/theme.js';
import { initSidebar } from '../layout/sidebar.js';
import { initDataStore, state } from '../store/dataStore.js';
import { renderFilters } from '../components/filters.js';

let dataTable = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebar();
    
    await initDataStore();
    renderFilters();
    
    initDataTable();

    window.addEventListener('dataUpdated', () => {
        updateDataTable();
    });
});

function initDataTable() {
    dataTable = $('#table-ocorrencias').DataTable({
        data: state.filteredData,
        columns: [
            { 
                data: 'data', 
                render: (data) => {
                    if (!data) return '';
                    const d = new Date(data);
                    return d.toLocaleDateString('pt-BR');
                }
            },
            { data: 'talao' },
            { data: 'viatura' },
            { data: 'prontidao' },
            { data: 'natureza' },
            { data: 'cidade' },
            { data: 'vitimas' },
            { data: 'vitimasFatais' },
            { data: 'cmtVtr' },
            { data: 'observacoes', render: (data) => data ? `<span title="${data}">${data.substring(0, 30)}...</span>` : '' }
        ],
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
        },
        dom: '<"row mb-3"<"col-md-6"B><"col-md-6"f>>rt<"row"<"col-md-6"i><"col-md-6"p>>',
        buttons: [
            { extend: 'excel', className: 'btn btn-success btn-sm', text: '<i class="fa-solid fa-file-excel"></i> Excel' },
            { extend: 'csv', className: 'btn btn-info btn-sm text-white', text: '<i class="fa-solid fa-file-csv"></i> CSV' }
        ],
        pageLength: 15,
        order: [[0, 'desc']]
    });
}

function updateDataTable() {
    if (dataTable) {
        dataTable.clear();
        dataTable.rows.add(state.filteredData);
        dataTable.draw();
    }
}
