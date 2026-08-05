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
    'sobre': 'pages/sobre.html',
    'dejem': 'pages/dejem.html',
    'abastecimento': 'pages/abastecimento.html',
    'ferias': 'pages/ferias.html',
    'efetivo': 'pages/efetivo.html',
    'frequencia': 'pages/frequencia.html'
};

const dashboardRoutes = ['home', 'ocorrencias', 'viaturas', 'prontidoes', 'naturezas', 'municipios', 'mapa', 'timeline'];

const appContent = document.getElementById('app-content');
const loader = document.getElementById('loader-overlay');

export async function navigateTo(route) {
    if (!routes[route]) {
        route = 'home';
    }

    // Mostrar loader rápido na troca de tela
    if (loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
    }

    try {
        const response = await fetch(routes[route]);
        if (!response.ok) throw new Error(`Erro ao carregar página: ${response.status}`);
        
        const html = await response.text();
        appContent.innerHTML = html;

        // Atualiza a URL (Hash)
        window.location.hash = route;

        // Atualiza UI (Menu Sidebar Ativo)
        updateSidebarUI(route);

        // Dispara evento global avisando que a página foi montada, 
        // para o app.js reinicializar gráficos/componentes da tela atual.
        document.dispatchEvent(new CustomEvent('page-loaded', { detail: { route } }));

    } catch (error) {
        console.error("Erro no router:", error);
        appContent.innerHTML = `
            <div class="glass-panel p-8 text-center text-red-400">
                <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                <h2 class="text-xl font-bold">Erro ao carregar a página</h2>
                <p class="text-sm mt-2 text-[#5a6f8a]">Página "${route}" não foi encontrada ou ainda está em construção.</p>
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
        if (itemRoute === route || (itemRoute === 'home' && isDashboardRoute)) {
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

    // Mobile Bottom Nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const itemRoute = item.getAttribute('data-route');
        if (itemRoute === route || (itemRoute === 'home' && isDashboardRoute)) {
            item.classList.add('active');
        }
    });
}

export function initRouter() {
    // Intercepta cliques no menu
    document.querySelectorAll('.sidebar-item, .nav-item, .subnav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const route = item.getAttribute('data-route');
            if (route) {
                // No mobile, se clicar num link, esconde a sidebar
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth <= 1024 && sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    const toggleBtn = document.getElementById('sidebarToggle');
                    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
                }
                navigateTo(route);
            }
        });
    });

    // Se o usuário carregar direto pela URL com Hash (ex: /index.html#mapa)
    const initialRoute = window.location.hash.replace('#', '') || 'home';
    navigateTo(initialRoute);
}
