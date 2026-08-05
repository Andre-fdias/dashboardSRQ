/**
 * mapa.js - Versão 2.0
 * Lógica da página do Mapa Operacional (Leaflet + Geocoding Cache com visual escuro)
 */

import { initTheme } from '../layout/theme.js';
import { initSidebar } from '../layout/sidebar.js';
import { initDataStore, state } from '../store/dataStore.js';
import { renderFilters } from '../components/filters.js';

let map;
let markerCluster;
let heatLayer;
const GEOCACHE_KEY = 'dashboard_geocache';

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebar();
    
    // Iniciar Mapa (São Roque como centro padrão)
    map = L.map('map').setView([-23.528, -47.135], 11);
    
    // Usar camada escura por padrão para combinar com o design
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB'
    }).addTo(map);

    markerCluster = L.markerClusterGroup();
    map.addLayer(markerCluster);

    await initDataStore();
    renderFilters();

    updateMap();

    window.addEventListener('dataUpdated', () => {
        updateMap();
    });

    document.getElementById('toggle-heatmap').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.removeLayer(markerCluster);
            if (heatLayer) map.addLayer(heatLayer);
        } else {
            if (heatLayer) map.removeLayer(heatLayer);
            map.addLayer(markerCluster);
        }
    });
});

async function updateMap() {
    markerCluster.clearLayers();
    if (heatLayer) map.removeLayer(heatLayer);

    const heatPoints = [];
    const geocache = JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}');
    
    // Processar os primeiros 150 registros para evitar travamento de rede com o Nominatim
    const dataToMap = state.filteredData.slice(0, 150); 
    let cacheUpdated = false;

    for (const item of dataToMap) {
        if (!item.cidade) continue;

        let query = `${item.endereco || ''}, ${item.cidade}, SP, Brasil`.trim();
        if (query.startsWith(',')) query = `${item.cidade}, SP, Brasil`;

        let coords = geocache[query];

        if (!coords) {
            try {
                // Atraso de 1 segundo para respeitar o rate-limit público da API Nominatim
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                    geocache[query] = coords;
                    cacheUpdated = true;
                }
            } catch (err) {
                console.warn("Falha no geocoding para:", query, err);
            }
        }

        if (coords) {
            const dateStr = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '';
            const popupContent = `
                <div style="color: #333;">
                    <strong>${item.natureza}</strong><br>
                    Talão: ${item.talao}<br>
                    ${item.endereco ? item.endereco + '<br>' : ''}
                    ${item.cidade}<br>
                    Viatura: ${item.viatura} - Data: ${dateStr}
                </div>
            `;
            
            const marker = L.marker(coords).bindPopup(popupContent);
            markerCluster.addLayer(marker);
            heatPoints.push(coords);
        }
    }

    if (cacheUpdated) {
        localStorage.setItem(GEOCACHE_KEY, JSON.stringify(geocache));
    }

    if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, {radius: 25, blur: 15});
        if (document.getElementById('toggle-heatmap').checked) {
            map.addLayer(heatLayer);
        }
    }
}
