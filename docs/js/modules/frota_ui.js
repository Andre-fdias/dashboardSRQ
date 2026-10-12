/**
 * frota_ui.js - Renderização e Interatividade das Abas de Frota:
 * - Viaturas (Cards / Tabela com filtros de status e busca)
 * - Detalhamento (4 mini-cards KPI, Alertas, Timeline, Checklists, Abastecimentos, Revisões)
 * - Checklists (Tabela completa e Modal de Avaliação dos 30 itens)
 * - Avarias (Tabela de anomalias com link direto para a ficha da viatura)
 */

(function() {
    window.frotaUI = {};

    const dataTablePtBr = {
        emptyTable: "Nenhum registro encontrado",
        info: "Mostrando de _START_ até _END_ de _TOTAL_ registros",
        infoEmpty: "Mostrando 0 até 0 de 0 registros",
        infoFiltered: "(filtrado de _MAX_ registros no total)",
        infoThousands: ".",
        lengthMenu: "Exibir _MENU_ registros",
        loadingRecords: "Carregando...",
        processing: "Processando...",
        search: "Pesquisar:",
        zeroRecords: "Nenhum registro correspondente encontrado",
        paginate: {
            first: "Primeiro",
            last: "Último",
            next: "Próximo",
            previous: "Anterior"
        },
        aria: {
            sortAscending: ": Ordenar colunas de forma ascendente",
            sortDescending: ": Ordenar colunas de forma descendente"
        }
    };

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
        window.jQuery.extend(true, window.jQuery.fn.dataTable.defaults, {
            language: dataTablePtBr
        });
    }

    function getVtrStatusBadge(status) {
        const s = String(status || '').toUpperCase();
        if (s.includes('OPERANDO')) {
            return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">OPERANDO</span>';
        } else if (s.includes('RESERVA')) {
            return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">RESERVA</span>';
        } else if (s.includes('BAIXAD')) {
            return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">BAIXADA</span>';
        }
        return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/10 text-[#cbd5e1] border border-white/10">${status || 'S/ STATUS'}</span>`;
    }

    function getEquipeBadge(equipe) {
        if (!equipe || equipe === '-' || /^(n[aã]o informado|-)$/i.test(equipe)) return '';
        const raw = String(equipe).trim();
        const upper = raw.toUpperCase();
        
        let bgStyle = 'bg-slate-600 text-white shadow-sm';
        
        if (upper.includes('AMAREL')) {
            bgStyle = 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.35)]';
        } else if (upper.includes('AZUL')) {
            bgStyle = 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.35)]';
        } else if (upper.includes('VERDE')) {
            bgStyle = 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.35)]';
        } else if (upper.includes('VERMELH')) {
            bgStyle = 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.35)]';
        } else if (upper.includes('LARANJ')) {
            bgStyle = 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.35)]';
        } else if (upper.includes('ROX') || upper.includes('VIOLET')) {
            bgStyle = 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.35)]';
        } else if (upper.includes('BRANC')) {
            bgStyle = 'bg-white text-slate-900 border border-slate-300 font-extrabold shadow-sm';
        } else if (upper.includes('PRET')) {
            bgStyle = 'bg-neutral-900 text-white border border-neutral-700 shadow-sm';
        }
        
        return `<span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${bgStyle}"><i class="fa-solid fa-users text-[9px] mr-1 opacity-90"></i>${raw}</span>`;
    }

    // ========================================================
    // 1. ABA VIATURAS
    // ========================================================
    let viaturasDataTable = null;
    let currentViaturasFilter = 'ALL';
    let currentViaturasView = 'cards';

    window.frotaUI.initViaturasTab = function() {
        const searchInput = document.getElementById('search-viatura-card');
        if (searchInput) {
            searchInput.oninput = () => window.frotaUI.updateViaturasTab();
        }
        
        // Filtros rápidos
        const filterBtns = document.querySelectorAll('#viaturas-filters button');
        filterBtns.forEach(btn => {
            btn.onclick = (e) => {
                filterBtns.forEach(b => {
                    b.classList.remove('bg-white/20', 'text-white', 'border-white/20', 'active-filter');
                    b.classList.add('text-[#cbd5e1]', 'border-white/10');
                });
                const target = e.currentTarget;
                target.classList.remove('text-[#cbd5e1]', 'border-white/10');
                target.classList.add('bg-white/20', 'text-white', 'border-white/20', 'active-filter');
                
                currentViaturasFilter = target.getAttribute('data-filter') || 'ALL';
                window.frotaUI.updateViaturasTab();
            };
        });
        
        // Alternador Cards / Tabela
        const btnCards = document.getElementById('btn-view-cards');
        const btnTable = document.getElementById('btn-view-table');
        const viewCards = document.getElementById('viaturas-cards-view');
        const viewTable = document.getElementById('viaturas-table-view');
        
        if (btnCards && btnTable) {
            btnCards.onclick = () => {
                currentViaturasView = 'cards';
                btnCards.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 border border-white/20 transition flex items-center gap-1.5';
                btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-[#cbd5e1] hover:text-white transition flex items-center gap-1.5';
                if (viewCards) viewCards.classList.remove('hidden');
                if (viewTable) viewTable.classList.add('hidden');
                window.frotaUI.updateViaturasTab();
            };
            
            btnTable.onclick = () => {
                currentViaturasView = 'table';
                btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 border border-white/20 transition flex items-center gap-1.5';
                btnCards.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-[#cbd5e1] hover:text-white transition flex items-center gap-1.5';
                if (viewCards) viewCards.classList.add('hidden');
                if (viewTable) viewTable.classList.remove('hidden');
                window.frotaUI.updateViaturasTab();
            };
        }
        
        window.frotaUI.updateViaturasTab();
    };

    window.frotaUI.updateViaturasTab = function() {
        const gridContainer = document.getElementById('viaturas-grid');
        const badge = document.getElementById('viaturas-count-badge');
        if (!gridContainer) return;
        
        if (!window.frotaData || !window.frotaData.loaded) {
            gridContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12"><i class="fa-solid fa-spinner fa-spin mr-2 text-yellow-400"></i>Carregando dados da frota...</div>';
            if (badge) badge.textContent = 'Carregando...';
            return;
        }
        
        let viaturas = window.frotaData.getAllVehicles();
        
        // Filtro de busca
        const searchInput = document.getElementById('search-viatura-card');
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (q) {
            viaturas = viaturas.filter(v => {
                const p = (v.prefixo || '').toLowerCase();
                const pl = (v.cadastro?.placa || '').toLowerCase();
                const m = (v.cadastro?.modelo || '').toLowerCase();
                const b = (v.cadastro?.opmcb || '').toLowerCase();
                return p.includes(q) || pl.includes(q) || m.includes(q) || b.includes(q);
            });
        }
        
        // Filtro de status
        if (currentViaturasFilter !== 'ALL') {
            viaturas = viaturas.filter(v => {
                const s = (v.cadastro?.status || '').toUpperCase();
                if (currentViaturasFilter === 'OPERANDO') return s.includes('OPERANDO');
                if (currentViaturasFilter === 'RESERVA') return s.includes('RESERVA');
                if (currentViaturasFilter === 'BAIXADO') return s.includes('BAIXAD');
                if (currentViaturasFilter === 'ALERTAS') return v.alertas.length > 0;
                if (currentViaturasFilter === 'AVARIAS') return v.metricas.totalAvarias > 0;
                return true;
            });
        }
        
        if (badge) {
            badge.textContent = `${viaturas.length} viatura(s) listada(s)`;
        }
        
        // Renderiza Cards
        if (currentViaturasView === 'cards') {
            gridContainer.innerHTML = '';
            if (viaturas.length === 0) {
                gridContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12">Nenhuma viatura encontrada com os filtros aplicados.</div>';
                return;
            }
            
            viaturas.forEach(v => {
                const c = v.cadastro || {};
                const prefixo = v.prefixo;
                const placa = c.placa || '-';
                const modelo = c.modelo || '-';
                const base = c.opmcb || '-';
                const status = c.status || 'OPERANDO';
                
                const card = document.createElement('div');
                card.className = 'glass-panel p-4 rounded-2xl flex flex-col relative overflow-hidden transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] hover:bg-white/5 cursor-pointer border border-white/5 hover:border-yellow-500/30';
                card.onclick = () => {
                    window.location.hash = `#detalhamento?vtr=${encodeURIComponent(prefixo)}`;
                };
                
                card.innerHTML = `
                    <div class="absolute -right-3 -top-3 text-yellow-500/5 rotate-[-15deg] pointer-events-none">
                        <i class="fa-solid fa-car text-[80px]"></i>
                    </div>
                    
                    <div class="relative z-10 flex flex-col h-full">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="text-[#eab308] font-bold text-base tracking-wide">${prefixo}</h4>
                            ${getVtrStatusBadge(status)}
                        </div>
                        
                        <div class="space-y-1 text-xs text-[#cbd5e1] mb-3">
                            <div>Placa: <span class="text-white font-medium">${placa}</span></div>
                            <div class="truncate">Modelo: <span class="text-white font-medium">${modelo}</span></div>
                            <div class="truncate">Base: <span class="text-white font-medium">${base}</span></div>
                        </div>
                        
                        <div class="mt-auto pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                            ${v.alertas.length > 0 ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${v.alertas.length} Alerta(s)</span>` : ''}
                            ${v.metricas.totalAvarias > 0 ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">${v.metricas.totalAvarias} Avaria(s)</span>` : ''}
                            ${v.metricas.kmAtual > 0 ? `<span class="text-[9px] font-medium text-gray-400 ml-auto self-center">${v.metricas.kmAtual.toLocaleString('pt-BR')} km</span>` : ''}
                        </div>
                    </div>
                `;
                gridContainer.appendChild(card);
            });
        } else {
            // Renderiza Tabela
            if (viaturasDataTable) {
                viaturasDataTable.destroy();
            }
            
            const tbody = document.querySelector('#table-viaturas-lista tbody');
            if (tbody) {
                tbody.innerHTML = '';
                viaturas.forEach(v => {
                    const c = v.cadastro || {};
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-white/5 cursor-pointer';
                    tr.onclick = (e) => {
                        if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                            window.location.hash = `#detalhamento?vtr=${encodeURIComponent(v.prefixo)}`;
                        }
                    };
                    
                    tr.innerHTML = `
                        <td class="py-2.5 px-3 border-b border-white/5 text-[#eab308] font-bold text-xs">${v.prefixo}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs">${c.placa || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs">${c.modelo || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5">${getVtrStatusBadge(c.status)}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${c.opmcb || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-center">
                            ${v.alertas.length > 0 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 mr-1">${v.alertas.length} Alerta(s)</span>` : ''}
                            ${v.metricas.totalAvarias > 0 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">${v.metricas.totalAvarias} Avaria(s)</span>` : ''}
                            ${v.alertas.length === 0 && v.metricas.totalAvarias === 0 ? '<span class="text-xs text-gray-500">-</span>' : ''}
                        </td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-right">
                            <button onclick="window.location.hash='#detalhamento?vtr=${encodeURIComponent(v.prefixo)}'" class="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition">
                                <i class="fa-solid fa-eye mr-1"></i> Ver Ficha
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            
            viaturasDataTable = $('#table-viaturas-lista').DataTable({
                language: dataTablePtBr,
                pageLength: 20,
                responsive: true,
                order: [[0, 'asc']]
            });
        }
    };

    // ========================================================
    // 2. ABA DETALHAMENTO DA VIATURA
    // ========================================================
    window.frotaUI.initDetalhamentoTab = function() {
        // Alternador de abas internas (Timeline, Checklists, Abastecimentos, Revisões)
        const tabBtns = document.querySelectorAll('#det-tabs-nav button');
        tabBtns.forEach(btn => {
            btn.onclick = (e) => {
                tabBtns.forEach(b => {
                    b.classList.remove('bg-white/20', 'text-white', 'border-white/20', 'active-det-tab');
                    b.classList.add('text-[#cbd5e1]', 'border-white/10');
                });
                const target = e.currentTarget;
                target.classList.remove('text-[#cbd5e1]', 'border-white/10');
                target.classList.add('bg-white/20', 'text-white', 'border-white/20', 'active-det-tab');
                
                const tabName = target.getAttribute('data-tab');
                document.querySelectorAll('.det-tab-pane').forEach(p => p.classList.add('hidden'));
                const activePane = document.getElementById(`det-tab-content-${tabName}`);
                if (activePane) activePane.classList.remove('hidden');
            };
        });
        
        // Popula select de viaturas
        const select = document.getElementById('select-det-viatura');
        if (select && window.frotaData?.loaded) {
            select.innerHTML = '<option value="">Selecione Viatura...</option>';
            window.frotaData.getAllVehicles().forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.prefixo;
                opt.textContent = `${v.prefixo} - ${v.cadastro?.modelo || ''} (${v.cadastro?.placa || ''})`;
                select.appendChild(opt);
            });
            
            select.onchange = () => {
                if (select.value) {
                    window.location.hash = `#detalhamento?vtr=${encodeURIComponent(select.value)}`;
                }
            };
        }
        
        window.frotaUI.updateDetalhamentoTab();
    };

    window.frotaUI.updateDetalhamentoTab = function() {
        if (!window.frotaData || !window.frotaData.loaded) return;
        
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        const queryString = queryIndex !== -1 ? hash.substring(queryIndex + 1) : '';
        const urlParams = new URLSearchParams(queryString);
        let vtrPrefix = urlParams.get('vtr');
        
        const allVehicles = window.frotaData.getAllVehicles();
        if (!vtrPrefix && allVehicles.length > 0) {
            vtrPrefix = allVehicles[0].prefixo;
        }
        
        if (!vtrPrefix) return;
        
        const vtr = window.frotaData.getVehicle(vtrPrefix);
        if (!vtr) {
            const titleEl = document.getElementById('det-vtr-title');
            if (titleEl) titleEl.textContent = `Viatura ${vtrPrefix} não encontrada`;
            return;
        }
        
        const select = document.getElementById('select-det-viatura');
        if (select && select.value !== vtr.prefixo) {
            select.value = vtr.prefixo;
        }
        
        const c = vtr.cadastro || {};
        const m = vtr.metricas || {};
        
        // Título e Subtítulo
        const titleEl = document.getElementById('det-vtr-title');
        if (titleEl) titleEl.textContent = `Ficha da Viatura: ${vtr.prefixo}`;
        
        const subEl = document.getElementById('det-vtr-subtitle');
        if (subEl) subEl.textContent = `${c.modelo || '-'} | Placa: ${c.placa || '-'} | Base: ${c.opmcb || '-'}`;
        
        const statusChip = document.getElementById('det-vtr-status-chip');
        if (statusChip) {
            statusChip.outerHTML = `<span id="det-vtr-status-chip">${getVtrStatusBadge(c.status)}</span>`;
        }
        
        // 4 Mini-Cards
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        
        setTxt('det-card-placa', c.placa);
        setTxt('det-card-modelo', c.modelo);
        setTxt('det-card-tipo', c.tipo);
        setTxt('det-card-garagem', c.garagem);
        
        setTxt('det-card-base', c.opmcb);
        setTxt('det-card-sgb', c.sgb);
        setTxt('det-card-status', c.status);
        setTxt('det-card-combustivel', c.combustivel);
        
        setTxt('det-card-km', m.kmAtual > 0 ? `${m.kmAtual.toLocaleString('pt-BR')} km` : '-');
        setTxt('det-card-consumo', m.consumoMedio > 0 ? `${m.consumoMedio.toFixed(2)} km/l` : '-');
        setTxt('det-card-total-chk', `${vtr.checklists.length} realizados`);
        setTxt('det-card-total-avarias', `${m.totalAvarias} reportadas`);
        
        setTxt('det-card-gasto', m.gastoTotal > 0 ? `R$ ${m.gastoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00');
        setTxt('det-card-litros', m.litrosTotal > 0 ? `${m.litrosTotal.toLocaleString('pt-BR')} L` : '0 L');
        setTxt('det-card-total-abs', `${vtr.abastecimentos.length} registros`);
        
        // Badges das abas
        setTxt('det-tab-chk-badge', vtr.checklists.length);
        setTxt('det-tab-abs-badge', vtr.abastecimentos.length);
        setTxt('det-tab-rev-badge', vtr.revisoes.length);
        
        // Alertas Ativos
        const alertasContainer = document.getElementById('det-alertas-container');
        const alertasList = document.getElementById('det-alertas-list');
        if (alertasContainer && alertasList) {
            if (vtr.alertas.length > 0) {
                alertasContainer.classList.remove('hidden');
                alertasList.innerHTML = vtr.alertas.map(a => `
                    <div class="flex items-start gap-2 text-xs text-red-300">
                        <i class="fa-solid fa-circle-exclamation text-red-400 mt-0.5"></i>
                        <div>
                            <strong class="font-bold">${a.tipo}:</strong> ${a.mensagem}
                        </div>
                    </div>
                `).join('');
            } else {
                alertasContainer.classList.add('hidden');
            }
        }
        
        // ABA 1: Timeline
        renderTimelineFeed(vtr);
        
        // ABA 2: Checklists
        renderDetChecklistsTable(vtr);
        
        // ABA 3: Abastecimentos
        renderDetAbastecimentosTable(vtr);
        
        // ABA 4: Revisões
        renderDetRevisoesTable(vtr);
    };

    function renderTimelineFeed(vtr) {
        const feed = document.getElementById('det-timeline-feed');
        if (!feed) return;
        
        const benignRegex = /^(ok|tudo ok|sem novidades|s\/n|s\/a|sem alteração|sem alteracao|sem alteracoes|nada a relatar|nada consta|não há|nao ha|nenhuma|nil|-|conforme|normal)$/i;
        
        const events = [];
        vtr.checklists.forEach(c => {
            const defItens = (c.itensInspecao || []).filter(i => !i.ok).map(i => i.item).join(', ');
            const anomaliaMsg = (c.novidades && !benignRegex.test(c.novidades)) ? c.novidades : (defItens ? `Anomalias: ${defItens}` : 'Anomalia identificada');
            
            events.push({
                tipo: 'checklist',
                data: c.dataHora || c.data || '',
                sortKey: c.sortKey || 0,
                titulo: `Checklist Diário Realizado`,
                equipe: c.equipe,
                diaProntidao: c.diaProntidao,
                subtitulo: `Responsável: ${c.responsavel} | Hodômetro: ${c.hodometro ? c.hodometro.toLocaleString('pt-BR') + ' km' : '-'}`,
                extra: c.temAvaria ? `<span class="text-red-400 font-bold block mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${anomaliaMsg}</span>` : '<span class="text-emerald-400 text-[11px] block mt-1"><i class="fa-solid fa-circle-check mr-1"></i>Conforme</span>',
                chkObj: c
            });
        });
        
        vtr.abastecimentos.forEach(a => {
            events.push({
                tipo: 'abastecimento',
                data: a.data || '',
                sortKey: a.sortKey || 0,
                titulo: `Abastecimento: ${a.litros ? a.litros + ' L' : ''} - R$ ${a.valorTotal ? a.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`,
                subtitulo: `Posto: ${a.posto} | Responsável: ${a.responsavel} | KM: ${a.km ? a.km.toLocaleString('pt-BR') : '-'}`,
                extra: ''
            });
        });
        
        vtr.revisoes.forEach(r => {
            events.push({
                tipo: 'revisao',
                data: r.data || '',
                sortKey: r.sortKey || 0,
                titulo: `Manutenção / Revisão: ${r.tipo}`,
                subtitulo: `Descrição: ${r.descricao} | KM: ${r.km ? r.km.toLocaleString('pt-BR') : '-'}`,
                extra: `<span class="text-blue-400 text-[11px] block mt-1">Status: ${r.status}</span>`
            });
        });
        
        events.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
        
        if (events.length === 0) {
            feed.innerHTML = '<div class="text-xs text-gray-500 py-4">Nenhum evento registrado para esta viatura.</div>';
            return;
        }
        
        feed.innerHTML = events.slice(0, 50).map(e => {
            let iconClass = 'fa-clipboard-check text-blue-400 bg-blue-500/10 border-blue-500/20';
            if (e.tipo === 'abastecimento') iconClass = 'fa-gas-pump text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            if (e.tipo === 'revisao') iconClass = 'fa-wrench text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            
            const equipeBadge = (e.tipo === 'checklist' && e.equipe && e.equipe !== '-') ? getEquipeBadge(e.equipe) : '';
            
            return `
                <div class="flex items-start gap-3 pl-1 relative">
                    <div class="w-7 h-7 rounded-lg border flex items-center justify-center text-xs flex-shrink-0 z-10 ${iconClass}">
                        <i class="fa-solid ${iconClass.split(' ')[0]}"></i>
                    </div>
                    <div class="glass-panel p-3 rounded-xl flex-1 text-xs">
                        <div class="flex justify-between items-start gap-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-white">${e.titulo}</span>
                                ${equipeBadge}
                            </div>
                            <span class="text-[10px] text-[#5a6f8a] flex-shrink-0">${e.data}</span>
                        </div>
                        <div class="text-[#cbd5e1] mt-0.5">${e.subtitulo}</div>
                        ${e.extra}
                        ${e.chkObj ? `<button onclick='window.frotaUI.openChecklistModal(${JSON.stringify(e.chkObj).replace(/'/g, "&#39;")})' class="mt-2 text-[10px] font-bold text-blue-400 hover:text-blue-300 underline"><i class="fa-solid fa-list-check mr-1"></i>Ver Itens do Checklist</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDetChecklistsTable(vtr) {
        const tbody = document.querySelector('#table-det-checklists tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (vtr.checklists.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400 text-xs">Nenhum checklist registrado para esta viatura.</td></tr>';
            return;
        }
        
        vtr.checklists.forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-white/5';
            const chkJson = JSON.stringify(c).replace(/'/g, "&#39;");
            tr.innerHTML = `
                <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs">${c.dataHora || c.data || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${c.responsavel || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-xs">${c.equipe && c.equipe !== '-' ? getEquipeBadge(c.equipe) : '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-xs text-white">${c.hodometro ? c.hodometro.toLocaleString('pt-BR') : '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center">
                    ${c.temAvaria ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Com Avarias</span>' : '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Conforme</span>'}
                </td>
                <td class="py-2.5 px-3 border-b border-white/5 text-right">
                    <button onclick='window.frotaUI.openChecklistModal(${chkJson})' class="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition">
                        <i class="fa-solid fa-list-check mr-1"></i> Ver Avaliação
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderDetAbastecimentosTable(vtr) {
        const tbody = document.querySelector('#table-det-abastecimentos tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (vtr.abastecimentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400 text-xs">Nenhum abastecimento registrado.</td></tr>';
            return;
        }
        
        vtr.abastecimentos.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-white/5';
            tr.innerHTML = `
                <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs">${a.data || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-white text-xs">${a.km ? a.km.toLocaleString('pt-BR') : '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-yellow-400 font-bold text-xs">${a.litros ? a.litros.toLocaleString('pt-BR') : '-'} L</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-right text-emerald-400 font-bold text-xs">${a.valorTotal ? 'R$ ' + a.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${a.posto || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${a.responsavel || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderDetRevisoesTable(vtr) {
        const tbody = document.querySelector('#table-det-revisoes tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (vtr.revisoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400 text-xs">Nenhuma revisão cadastrada.</td></tr>';
            return;
        }
        
        vtr.revisoes.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-white/5';
            tr.innerHTML = `
                <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs">${r.data || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-white text-xs">${r.km ? r.km.toLocaleString('pt-BR') : '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-blue-400 font-bold text-xs">${r.tipo || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${r.descricao || '-'}</td>
                <td class="py-2.5 px-3 border-b border-white/5 text-center text-xs">
                    <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">${r.status || 'Concluída'}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ========================================================
    // 3. MODAL DE AVALIAÇÃO DE CHECKLIST (30 ITENS)
    // ========================================================
    window.frotaUI.openChecklistModal = function(chk) {
        if (!chk) return;
        
        const modal = document.getElementById('modal-checklist-detalhes') || document.getElementById('modal-checklist-geral-detalhes');
        if (!modal) return;
        
        const isGeral = modal.id === 'modal-checklist-geral-detalhes';
        const prefix = isGeral ? 'modal-chk-geral' : 'modal-chk';
        
        const titleEl = document.getElementById(`${prefix}-title`);
        if (titleEl) {
            titleEl.innerHTML = `
                <div class="flex items-center gap-2.5 flex-wrap">
                    <span>Checklist: Viatura ${chk.prefixo}</span>
                    ${chk.equipe && chk.equipe !== '-' ? getEquipeBadge(chk.equipe) : ''}
                </div>
            `;
        }
        
        const metaEl = document.getElementById(`${prefix}-meta`);
        if (metaEl) {
            const prontidaoHtml = chk.diaProntidao ? `<span class="inline-flex items-center text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-md font-semibold"><i class="fa-regular fa-calendar-check mr-1 text-blue-400"></i>Prontidão: ${chk.diaProntidao}</span>` : '';
            metaEl.innerHTML = `
                <div class="flex items-center gap-2.5 flex-wrap text-xs text-[#8da0bd] mt-1">
                    <span><i class="fa-regular fa-clock mr-1 text-[#5a6f8a]"></i>${chk.dataHora || chk.data || '-'}</span>
                    ${prontidaoHtml}
                    <span><i class="fa-solid fa-user-shield mr-1 text-[#5a6f8a]"></i>${chk.responsavel}</span>
                    <span><i class="fa-solid fa-gauge mr-1 text-[#5a6f8a]"></i>${chk.hodometro ? chk.hodometro.toLocaleString('pt-BR') + ' km' : '-'}</span>
                </div>
            `;
        }
        
        const benignRegex = /^(ok|tudo ok|sem novidades|s\/n|s\/a|sem alteração|sem alteracao|sem alteracoes|nada a relatar|nada consta|não há|nao ha|nenhuma|nil|-|conforme|normal)$/i;
        const banner = document.getElementById(`${prefix}-avaria-banner`);
        const anomaliaText = document.getElementById(`${prefix}-anomalias-text`);
        if (banner && anomaliaText) {
            if (chk.novidades && chk.novidades !== '-' && !benignRegex.test(chk.novidades)) {
                banner.classList.remove('hidden');
                anomaliaText.textContent = chk.novidades;
            } else {
                banner.classList.add('hidden');
            }
        }
        
        const grid = document.getElementById(`${prefix}-items-grid`);
        if (grid) {
            grid.innerHTML = '';
            if (chk.itensInspecao && chk.itensInspecao.length > 0) {
                chk.itensInspecao.forEach(item => {
                    const normVal = String(item.valor || '').trim().toUpperCase();
                    const normalizedKey = String(item.item || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const isDefaultNao = /check[\s_-]*up[\s_-]*longo|engraxamento/i.test(normalizedKey);
                    
                    let isOk = false;
                    if (isDefaultNao) {
                        // Default é NÃO. Somente fica vermelho se for SIM.
                        const isSim = (normVal === 'SIM' || normVal === 'S' || normVal === 'TRUE' || normVal === '1');
                        isOk = !isSim;
                    } else {
                        isOk = item.ok && (normVal === 'OK' || normVal === 'CONFORME' || normVal === 'C/N' || normVal === 'C' || normVal === 'NORMAL');
                    }

                    const el = document.createElement('div');
                    el.className = `p-2.5 rounded-xl border flex justify-between items-center transition-all ${isOk ? 'bg-emerald-500/5 border-emerald-500/20 text-gray-200' : 'bg-red-500/15 border-red-500/40 text-red-200 font-bold shadow-[0_0_15px_rgba(239,68,68,0.15)]'}`;
                    el.innerHTML = `
                        <span class="truncate mr-2 ${isOk ? '' : 'text-red-300 font-semibold'}">${item.item}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${isOk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/30 text-red-400 border border-red-500/40'}">${item.valor}</span>
                    `;
                    grid.appendChild(el);
                });
            } else {
                grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-4">Nenhum item específico detalhado.</div>';
            }
        }
        
        modal.classList.remove('hidden');
    };
    window.openChecklistModal = window.frotaUI.openChecklistModal;

    // ========================================================
    // 4. ABA CHECKLISTS GERAIS
    // ========================================================
    let checklistDataTable = null;

    window.frotaUI.initChecklistTab = function() {
        const selectPrefixo = document.getElementById('checklist-filter-prefixo');
        if (selectPrefixo && window.frotaData?.loaded) {
            populateChecklistPrefixos(selectPrefixo);
            selectPrefixo.onchange = () => window.frotaUI.updateChecklistTab();
        }
        window.frotaUI.updateChecklistTab();
    };

    function populateChecklistPrefixos(selectEl) {
        if (!selectEl || !window.frotaData?.loaded) return;
        const currentVal = selectEl.value;
        const allChecklists = window.frotaData.getAllChecklists();
        
        const vtrCounts = {};
        allChecklists.forEach(c => {
            if (c.prefixo) vtrCounts[c.prefixo] = (vtrCounts[c.prefixo] || 0) + 1;
        });

        const prefixes = Object.keys(vtrCounts).sort();

        selectEl.innerHTML = `<option value="">TODAS AS VIATURAS (${allChecklists.length})</option>`;
        prefixes.forEach(p => {
            const count = vtrCounts[p] || 0;
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `${p} (${count} checklist${count === 1 ? '' : 's'})`;
            if (p === currentVal) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    window.frotaUI.updateChecklistTab = function() {
        const badge = document.getElementById('checklist-count-badge');
        const tableEl = document.getElementById('table-checklist-geral');
        const selectPrefixo = document.getElementById('checklist-filter-prefixo');
        if (!tableEl) return;
        
        if (!window.frotaData || !window.frotaData.loaded) {
            if (badge) badge.textContent = 'Carregando checklists...';
            return;
        }

        if (selectPrefixo && selectPrefixo.options.length <= 1) {
            populateChecklistPrefixos(selectPrefixo);
            selectPrefixo.onchange = () => window.frotaUI.updateChecklistTab();
        }

        const selectedPrefix = selectPrefixo ? selectPrefixo.value.trim() : '';
        let checklists = window.frotaData.getAllChecklists();
        if (selectedPrefix) {
            checklists = checklists.filter(c => c.prefixo === selectedPrefix);
            if (badge) badge.textContent = `${checklists.length} checklist(s) na viatura ${selectedPrefix}`;
        } else {
            if (badge) badge.textContent = `${checklists.length} checklists registrados`;
        }
        
        if (checklistDataTable) {
            checklistDataTable.destroy();
        }
        
        const tbody = document.querySelector('#table-checklist-geral tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (checklists.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400 text-xs">Nenhum checklist registrado para esta viatura.</td></tr>`;
            } else {
                checklists.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-white/5';
                    const chkJson = JSON.stringify(c).replace(/'/g, "&#39;");
                    
                    tr.innerHTML = `
                        <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs" data-order="${c.sortKey || 0}">${c.dataHora || c.data || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5">
                            <button onclick="window.location.hash='#detalhamento?vtr=${encodeURIComponent(c.prefixo)}'" class="text-[#eab308] font-bold text-xs hover:underline flex items-center gap-1">
                                <i class="fa-solid fa-truck text-[10px]"></i> ${c.prefixo}
                            </button>
                        </td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${c.responsavel || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-center text-xs">${c.equipe && c.equipe !== '-' ? getEquipeBadge(c.equipe) : '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-center text-xs text-white">${c.hodometro ? c.hodometro.toLocaleString('pt-BR') : '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-center">
                            ${c.temAvaria ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Com Avarias</span>' : '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Conforme</span>'}
                        </td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-right">
                            <button onclick='window.frotaUI.openChecklistModal(${chkJson})' class="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition">
                                <i class="fa-solid fa-list-check mr-1"></i> Ver Avaliação
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
        
        checklistDataTable = $('#table-checklist-geral').DataTable({
            language: dataTablePtBr,
            pageLength: 20,
            responsive: true,
            order: [[0, 'desc']]
        });
    };

    // ========================================================
    // 5. ABA AVARIAS
    // ========================================================
    let avariasDataTable = null;

    window.frotaUI.initAvariasTab = function() {
        const selectPrefixo = document.getElementById('avarias-filter-prefixo');
        if (selectPrefixo && window.frotaData?.loaded) {
            populateAvariasPrefixos(selectPrefixo);
            selectPrefixo.onchange = () => window.frotaUI.updateAvariasTab();
        }
        window.frotaUI.updateAvariasTab();
    };

    function populateAvariasPrefixos(selectEl) {
        if (!selectEl || !window.frotaData?.loaded) return;
        const currentVal = selectEl.value;
        const allAvarias = window.frotaData.getAllAvarias();
        
        const vtrCounts = {};
        allAvarias.forEach(a => {
            if (a.prefixo) vtrCounts[a.prefixo] = (vtrCounts[a.prefixo] || 0) + 1;
        });

        const prefixes = Object.keys(vtrCounts).sort();

        selectEl.innerHTML = `<option value="">TODAS AS VIATURAS (${allAvarias.length})</option>`;
        prefixes.forEach(p => {
            const count = vtrCounts[p] || 0;
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `${p} (${count} avaria${count === 1 ? '' : 's'})`;
            if (p === currentVal) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    window.frotaUI.updateAvariasTab = function() {
        const badge = document.getElementById('avarias-count-badge');
        const tableEl = document.getElementById('table-avarias-geral');
        const selectPrefixo = document.getElementById('avarias-filter-prefixo');
        if (!tableEl) return;
        
        if (!window.frotaData || !window.frotaData.loaded) {
            if (badge) badge.textContent = 'Carregando avarias...';
            return;
        }

        if (selectPrefixo && selectPrefixo.options.length <= 1) {
            populateAvariasPrefixos(selectPrefixo);
            selectPrefixo.onchange = () => window.frotaUI.updateAvariasTab();
        }

        const selectedPrefix = selectPrefixo ? selectPrefixo.value.trim() : '';
        let avarias = window.frotaData.getAllAvarias();
        
        if (selectedPrefix) {
            avarias = avarias.filter(a => a.prefixo === selectedPrefix);
            if (badge) badge.textContent = `${avarias.length} avaria(s) na viatura ${selectedPrefix}`;
        } else {
            if (badge) badge.textContent = `${avarias.length} avaria(s) registradas`;
        }
        
        if (avariasDataTable) {
            avariasDataTable.destroy();
        }
        
        const tbody = document.querySelector('#table-avarias-geral tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (avarias.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400 text-xs">Nenhuma avaria registrada para esta viatura.</td></tr>`;
            } else {
                avarias.forEach(a => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-white/5';
                    
                    tr.innerHTML = `
                        <td class="py-2.5 px-3 border-b border-white/5 text-white text-xs" data-order="${a.sortKey || 0}">${a.data || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5">
                            <button onclick="window.location.hash='#detalhamento?vtr=${encodeURIComponent(a.prefixo)}'" class="text-[#eab308] font-bold text-xs hover:underline flex items-center gap-1">
                                <i class="fa-solid fa-truck text-[10px]"></i> ${a.prefixo}
                            </button>
                        </td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${a.responsavel || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-gray-300 text-xs">${a.base || '-'}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-red-300 text-xs font-medium">${a.descricao}</td>
                        <td class="py-2.5 px-3 border-b border-white/5 text-right">
                            <button onclick="window.location.hash='#detalhamento?vtr=${encodeURIComponent(a.prefixo)}'" class="px-2.5 py-1 rounded-lg text-xs font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition">
                                <i class="fa-solid fa-eye mr-1"></i> Ver Viatura
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
        
        avariasDataTable = $('#table-avarias-geral').DataTable({
            language: dataTablePtBr,
            pageLength: 20,
            responsive: true,
            order: [[0, 'desc']]
        });
    };

    // ========================================================
    // 5. ABA ABASTECIMENTO GERAL
    // ========================================================
    let abastecimentoDataTable = null;

    window.frotaUI.initAbastecimentoTab = function() {
        const selectPrefixo = document.getElementById('abast-filter-prefixo');
        const inputDateStart = document.getElementById('abast-filter-dateStart');
        const inputDateEnd = document.getElementById('abast-filter-dateEnd');

        if (selectPrefixo && window.frotaData?.loaded) {
            const currentVal = selectPrefixo.value;
            selectPrefixo.innerHTML = '<option value="">TODAS AS VIATURAS</option>';
            const prefixes = Array.from(new Set(window.frotaData.getAllAbastecimentos().map(a => a.prefixo))).sort();
            prefixes.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (p === currentVal) opt.selected = true;
                selectPrefixo.appendChild(opt);
            });
        }

        if (selectPrefixo) selectPrefixo.onchange = () => window.frotaUI.updateAbastecimentoTab();
        if (inputDateStart) inputDateStart.onchange = () => window.frotaUI.updateAbastecimentoTab();
        if (inputDateEnd) inputDateEnd.onchange = () => window.frotaUI.updateAbastecimentoTab();

        window.frotaUI.updateAbastecimentoTab();
    };

    window.frotaUI.updateAbastecimentoTab = function() {
        const cardValor = document.getElementById('abast-card-valor');
        const cardVolume = document.getElementById('abast-card-volume');
        const cardKml = document.getElementById('abast-card-kml');
        const cardCount = document.getElementById('abast-card-count');
        const tbody = document.getElementById('abast-table-body');
        const selectPrefixo = document.getElementById('abast-filter-prefixo');
        const inputDateStart = document.getElementById('abast-filter-dateStart');
        const inputDateEnd = document.getElementById('abast-filter-dateEnd');

        if (!window.frotaData?.loaded) return;

        // Se o select estiver vazio, popula agora
        if (selectPrefixo && selectPrefixo.options.length <= 1) {
            const currentVal = selectPrefixo.value;
            selectPrefixo.innerHTML = '<option value="">TODAS AS VIATURAS</option>';
            const prefixes = Array.from(new Set(window.frotaData.getAllAbastecimentos().map(a => a.prefixo))).sort();
            prefixes.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (p === currentVal) opt.selected = true;
                selectPrefixo.appendChild(opt);
            });
        }

        const filterPrefixo = selectPrefixo ? selectPrefixo.value : '';
        const filterStart = inputDateStart ? inputDateStart.value : '';
        const filterEnd = inputDateEnd ? inputDateEnd.value : '';

        let items = window.frotaData.getAllAbastecimentos();

        if (filterPrefixo) {
            items = items.filter(a => a.prefixo === filterPrefixo);
        }
        if (filterStart) {
            items = items.filter(a => (a.data || '') >= filterStart);
        }
        if (filterEnd) {
            items = items.filter(a => (a.data || '') <= filterEnd);
        }

        // Totais e KPIs
        let custoTotal = 0;
        let volumeTotal = 0;
        let consumoSoma = 0;
        let consumoQtd = 0;

        items.forEach(a => {
            custoTotal += a.valorTotal || 0;
            volumeTotal += a.litros || 0;
            if (a.consumoKmL && a.consumoKmL > 0) {
                consumoSoma += a.consumoKmL;
                consumoQtd++;
            }
        });

        const mediaConsumo = consumoQtd > 0 ? (consumoSoma / consumoQtd).toFixed(2) : '--';

        if (cardValor) cardValor.textContent = `R$ ${custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (cardVolume) cardVolume.textContent = `${Math.round(volumeTotal).toLocaleString('pt-BR')} L`;
        if (cardKml) cardKml.textContent = mediaConsumo;
        if (cardCount) cardCount.textContent = items.length.toLocaleString('pt-BR');

        // Tabela DataTable
        if (abastecimentoDataTable) {
            abastecimentoDataTable.destroy();
            abastecimentoDataTable = null;
        }

        if (tbody) {
            tbody.innerHTML = '';
            items.forEach(a => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-colors';
                
                const valorFmt = a.valorTotal > 0 ? `R$ ${a.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                const volumeFmt = a.litros > 0 ? `${a.litros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L` : '-';
                const kmFmt = a.km > 0 ? a.km.toLocaleString('pt-BR') : '-';
                const consumoFmt = a.consumoKmL > 0 ? `${a.consumoKmL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

                tr.innerHTML = `
                    <td class="px-4 py-3 border-b border-white/5 text-white text-xs" data-order="${a.sortKey || 0}">${a.data || '-'}</td>
                    <td class="px-4 py-3 border-b border-white/5">
                        <button onclick="window.location.hash='#detalhamento?vtr=${encodeURIComponent(a.prefixo)}'" class="text-[#eab308] font-bold text-xs hover:underline flex items-center gap-1">
                            <i class="fa-solid fa-truck-fire text-[10px]"></i> ${a.prefixo}
                        </button>
                    </td>
                    <td class="px-4 py-3 border-b border-white/5 text-gray-400 text-xs">${a.placa && a.placa !== '#N/A' ? a.placa : '-'}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-gray-300 text-xs">${a.responsavel || '-'}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-white text-xs">${kmFmt}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-right font-bold text-blue-400 text-xs">${volumeFmt}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-right font-bold text-emerald-400 text-xs">${valorFmt}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-right font-bold text-purple-400 text-xs bg-purple-500/5">${consumoFmt}</td>
                    <td class="px-4 py-3 border-b border-white/5 text-gray-300 text-xs">${a.posto || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        abastecimentoDataTable = $('#abast-table').DataTable({
            language: dataTablePtBr,
            pageLength: 25,
            responsive: true,
            order: [[0, 'desc']]
        });
    };

    // Re-render quando os dados da planilha chegarem
    window.addEventListener('frotaDataLoaded', () => {
        const hash = window.location.hash.split('?')[0] || '';
        if (hash === '#viaturas') window.frotaUI.updateViaturasTab();
        else if (hash === '#detalhamento') window.frotaUI.updateDetalhamentoTab();
        else if (hash === '#checklist') window.frotaUI.updateChecklistTab();
        else if (hash === '#avarias') window.frotaUI.updateAvariasTab();
        else if (hash === '#abastecimento') window.frotaUI.updateAbastecimentoTab();
    });

})();
