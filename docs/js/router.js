// router.js

const routes = {
    'home': 'pages/home.html',
    'ocorrencias': 'pages/ocorrencias.html',
    'viaturas': 'pages/viaturas.html',
    'prontidoes': 'pages/prontidoes.html',
    'naturezas': 'pages/naturezas.html',
    'municipios': 'pages/municipios.html',
    'mapa': 'pages/mapa.html',
    'timeline': 'pages/timeline.html',
    'qta': 'pages/qta.html',
    'sobre': 'pages/sobre.html',
    'abastecimento': 'pages/abastecimento.html',
    'checklist': 'pages/checklist.html',
    'detalhamento': 'pages/detalhamento.html',
    'avarias': 'pages/avarias.html'
};

const dashboardRoutes = ['home', 'ocorrencias', 'prontidoes', 'naturezas', 'municipios', 'mapa', 'timeline', 'qta'];

const appContent = document.getElementById('app-content');
const loader = document.getElementById('loader-overlay');

export async function navigateTo(fullRoute) {
    const [route, queryString] = fullRoute.split('?');
    let targetRoute = route;
    if (!routes[targetRoute]) {
        targetRoute = 'home';
    }

    // Mostrar loader rápido na troca de tela
    if (loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
    }

    try {
        const response = await fetch(`${routes[targetRoute]}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Erro ao carregar página: ${response.status}`);
        
        const html = await response.text();
        appContent.innerHTML = html;

        // Atualiza a URL (Hash)
        window.location.hash = fullRoute;

        // Atualiza UI (Menu Sidebar Ativo)
        updateSidebarUI(targetRoute);

        // Dispara evento global avisando que a página foi montada, 
        // para o app.js reinicializar gráficos/componentes da tela atual.
        document.dispatchEvent(new CustomEvent('page-loaded', { detail: { route: targetRoute, queryString } }));

    } catch (error) {
        console.error("Erro no router:", error);
        appContent.innerHTML = `
            <div class="glass-panel p-8 text-center text-red-400">
                <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                <h2 class="text-xl font-bold">Erro ao carregar a página</h2>
                <p class="text-sm mt-2 text-[#5a6f8a]">Página "${targetRoute}" não foi encontrada ou ainda está em construção.</p>
            </div>
        `;
    } finally {
        if (loader) {
            // Esconde loader
            setTimeout(() => {
                loader.classList.add('hidden');
                loader.classList.remove('flex');
            }, 300); // pequeno delay visual
        }
    }
}

function updateSidebarUI(route) {
    const isDashboardRoute = dashboardRoutes.includes(route);

    // Controle de visibilidade do subnav e filtro
    const dashHeader = document.getElementById('dashboard-header');
    if (dashHeader) {
        if (isDashboardRoute) {
            dashHeader.classList.remove('hidden');
            dashHeader.classList.add('flex');
        } else {
            dashHeader.classList.remove('flex');
            dashHeader.classList.add('hidden');
        }
    }

    // Atualizar Sidebar (Módulos)
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        const itemRoute = item.getAttribute('data-route');
        if (itemRoute === route || (itemRoute === 'home' && isDashboardRoute) || (itemRoute === 'viaturas' && route === 'detalhamento')) {
            item.classList.add('active');
        }
    });

    // Atualizar Subnav (Navegação Horizontal)
    document.querySelectorAll('.subnav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-route') === route) {
            item.classList.add('active');
        }
    });
}

export function initRouter() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.add('hidden');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }

    function openSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.remove('hidden');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => closeSidebar());
    }

    // Intercepta cliques no menu
    document.querySelectorAll('.sidebar-item, .subnav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const route = item.getAttribute('data-route');
            if (route) {
                closeSidebar();
                navigateTo(route);
            }
        });
    });

    // Se o usuário carregar direto pela URL com Hash (ex: /index.html#mapa)
    const initialRoute = window.location.hash.replace('#', '') || 'home';
    navigateTo(initialRoute);

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'home';
        navigateTo(hash);
    });
}
