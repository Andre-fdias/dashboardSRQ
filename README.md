# Portal Analítico Operacional - EB São Roque
### Corpo de Bombeiros da Polícia Militar do Estado de São Paulo
**15º Grupamento de Bombeiros • 2º Subgrupamento • Estação de Bombeiros São Roque**

---

## 📋 Sumário
- [Visão Geral](#-visão-geral)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
- [Módulos da Aplicação](#-módulos-da-aplicação)
  - [Módulos Operacionais](#1-módulos-operacionais)
  - [Módulo de Gestão de Frota](#2-módulo-de-gestão-de-frota)
- [Últimas Atualizações e Melhorias](#-últimas-atualizações-e-melhorias)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Execução Local](#-execução-local)
- [Publicação no GitHub Pages](#-publicação-no-github-pages)
- [Configuração de Fontes de Dados](#-configuração-de-fontes-de-dados)

---

## 🚒 Visão Geral

O **Portal Analítico Operacional de São Roque** é uma plataforma web para consolidação, monitoramento e inteligência operacional da Estação de Bombeiros de São Roque (15º GB / 2º SGB). 

O sistema opera de forma **100% estática (Serverless)**, consumindo dados em tempo real de planilhas operacionais do Google Sheets via API GViz (Google Visualization) e arquivos estruturados, processando e cruzando todas as informações diretamente no navegador do usuário.

---

## 🏛 Arquitetura do Sistema

- **Padrão SPA (Single-Page Application):** Utiliza roteador baseado em hash (`#home`, `#viaturas`, `#detalhamento?vtr=...`, etc.) com carregamento assíncrono de templates HTML via Fetch API e injeção dinâmica em `#app-content`.
- **Zero Backend / Serverless:** Não depende de servidores dedicados, bancos de dados relacionais ou autenticação externa.
- **Camada de Dados Centralizada:**
  - `sheets.js`: Consumo e parse de ocorrências operacionais.
  - `frota.js`: Consumo concorrente (`Promise.all`) e normalização das planilhas de *Detalhamento de Viaturas*, *Checklist Diário*, *Abastecimentos* e *Controle de Revisões*.
  - `frota_ui.js`: Controladores e renderizadores de interface para toda a frota.
- **Responsividade Adaptativa:**
  - Telas amplas (Desktop): Barra lateral fixa e menus contextuais horizontais.
  - Telas menores / Mobile: Menu sanduíche acessível no topo do cabeçalho superior (`<header>`) com abertura em gaveta lateral e fundo escurecido com desfoque (`backdrop-blur`).

---

## 📦 Módulos da Aplicação

### 1. Módulos Operacionais
- **Dashboard Executivo (`#home`):** Visão geral de ocorrências, KPIs diários, comparativos por prontidão e gráficos analíticos.
- **Ocorrências (`#ocorrencias`):** Tabela dinâmica completa com busca, ordenação cronológica e filtros múltiplos.
- **Mapa Operacional (`#mapa`):** Visualização geoespacial com mapa de calor (Heatmap) e agrupamento de marcadores (MarkerCluster) via Leaflet.
- **Prontidões (`#prontidoes`):** Análise volumétrica de atendimentos por equipe/prontidão de serviço.
- **Naturezas (`#naturezas`):** Estatísticas detalhadas por tipo de sinistro (Incêndios, Salvamentos, Resgates, etc.).
- **Municípios (`#municipios`):** Distribuição geográfica das ocorrências no território de cobertura.
- **Linha do Tempo (`#timeline`):** Sequência temporal dos despachos operacionais.
- **QTA (`#qta`):** Indicadores de finalização e cancelamento de ocorrências.

### 2. Módulo de Gestão de Frota
- **Painel de Viaturas (`#viaturas`):**
  - Exibição em **Cards operacionais** ou em **Tabela DataTables**.
  - Filtragem por status: *Todas, Operando, Reserva, Baixada, Com Alertas, Com Avarias*.
  - Busca rápida por prefixo, placa, modelo ou garagem.
  - Clique direto no card/linha para abrir a ficha da viatura.
- **Ficha da Viatura / Detalhamento (`#detalhamento?vtr=PREFIXO`):**
  - **4 Mini-Cards KPI**: Identificação técnica (placa, modelo, tipo, garagem), Base/OPM e combustível, KM atual e contagem de checklists/avarias, e Gastos acumulados de abastecimento.
  - **Alertas Operacionais**: Detecção automática de avarias ativas e anomalias registradas.
  - **Linha do Tempo Operacional**: Histórico unificado em ordem cronológica decrescente de checklists, abastecimentos e revisões.
    - Badges arredondados coloridos por equipe: **AMARELA** (amarelo), **AZUL** (azul), **VERDE** (verde).
    - Alerta inteligente de avarias reais (ocultando avisos indevidos quando o campo for "OK").
  - **Histórico de Checklists**: Tabela das inspeções diárias com hodômetro, responsável, equipe e botão para visualização completa.
  - **Histórico de Abastecimentos**: Registro de litragem, valor total, posto e consumo médio.
  - **Controle de Manutenções/Revisões**: Histórico de ordens de serviço e revisões periódicas.
- **Modal de Avaliação do Checklist (30 Itens Técnicos):**
  - **Cabeçalho Informativo**: Identificação da viatura com badge colorido da equipe, data/hora da inspeção, pill com o **Dia da Prontidão** formatado (`DD/MM/AAAA`), responsável e odômetro.
  - **Grid de Inspeção**: Lista de itens com visualização verde (Conforme/OK) e destaque em vermelho vivo para anomalias relatadas.
  - Os campos de serviço (*Dia da Prontidão* e *Equipe de Serviço*) são mantidos exclusivamente no cabeçalho, evitando falsos itens de avaria.
- **Checklists Diários (`#checklist`):**
  - Listagem geral de todos os checklists da frota.
  - **Filtro dropdown por viatura** com contagem dinâmica de inspeções por prefixo.
- **Painel Geral de Avarias e Anomalias (`#avarias`):**
  - Centralização de todas as pendências e manutenções requeridas.
  - **Filtro dropdown por viatura** com contagem dinâmica de avarias por prefixo.
  - Acesso direto com um clique à ficha de detalhamento da viatura.
- **Controle Geral de Abastecimento (`#abastecimento`):**
  - Cards de custo total, volume consumido e consumo médio da frota.
  - Filtros combinados por viatura e intervalo de datas.

---

## 🚀 Últimas Atualizações e Melhorias

1. **Responsividade com Menu Sanduíche no Topo:**
   - Botão sanduíche integrado no cabeçalho superior (`<header>`) para telas menores ou janelas minimizadas ($\le 1024\text{px}$).
   - Abertura de gaveta lateral deslizante com backdrop fosco, contendo todas as opções da barra lateral.
   - Remoção completa de barras residuais de navegação no rodapé, maximizando a área de visualização em dispositivos móveis.
2. **Filtro Dinâmico de Viaturas em Avarias e Checklists:**
   - Dropdown inteligente nos cabeçalhos de *Avarias* e *Checklists* com identificação das viaturas e número de registros associados.
   - Atualização em tempo real dos contadores e da tabela DataTables.
3. **Internacionalização Nativa das Tabelas (pt-BR):**
   - Dicionário de tradução embutido diretamente no código (`dataTablePtBr`), eliminando falhas ou atrasos de carregamento de CDNs externos.
   - Labels traduzidos: *Pesquisar:*, *Exibir ... registros*, *Mostrando de ... até ...*, *Anterior / Próximo*.
4. **Metadados e Badges na Frota:**
   - Separação definitiva entre metadados administrativos (*Dia da Prontidão*, *Equipe*) e itens técnicos de inspeção.
   - Badges coloridos das equipes de serviço em conformidade com as cores oficiais das prontidões do Corpo de Bombeiros.
5. **Regras Inteligentes de Conformidade no Checklist:**
   - Para perguntas de rotina periódica como *"É dia de CHECK UP LONGO da viatura?"* e *"É dia de realizar engraxamento de caminhão?"*, o valor padrão esperado é **NÃO**.
   - Respostas **NÃO** são validadas como conformes (badge verde), sem gerar alertas ou avarias falsas.
   - O item só é destacado em **vermelho** caso a resposta informada seja **SIM**, sinalizando a necessidade do procedimento.

---

## 📁 Estrutura de Diretórios

```
dashboardSRQ/
├── docs/
│   ├── index.html                  # Shell SPA principal (Cabeçalho, Sidebar, Modal compartilhado)
│   ├── css/
│   │   └── main.css                # Estilização completa, Dark Mode, animações e media queries
│   ├── js/
│   │   ├── router.js               # Gerenciador de rotas SPA (#hash) e menu sanduíche
│   │   ├── app.js                  # Inicializador dos módulos analíticos gerais
│   │   ├── api/
│   │   │   ├── frota.js            # Integração GViz com as 4 planilhas da frota
│   │   │   └── sheets.js           # Integração com dados operacionais de ocorrências
│   │   └── modules/
│   │       └── frota_ui.js         # Interface e lógica das abas de Viaturas, Detalhamento, Checklists e Avarias
│   └── pages/                      # Templates parciais carregados dinamicamente via router
│       ├── home.html               # Dashboard geral de ocorrências
│       ├── viaturas.html           # Painel de viaturas (Cards/Tabela)
│       ├── detalhamento.html       # Ficha detalhada da viatura (KPIs, Timeline, Históricos)
│       ├── checklist.html          # Tabela geral de checklists diários
│       ├── avarias.html            # Painel geral de avarias com filtro
│       ├── abastecimento.html      # Painel geral de abastecimentos
│       ├── ocorrencias.html        # Lista de ocorrências
│       ├── mapa.html               # Mapa operacional (Leaflet)
│       ├── prontidoes.html         # Análise de prontidões
│       ├── naturezas.html          # Análise de naturezas de ocorrências
│       ├── municipios.html         # Distribuição por municípios
│       ├── timeline.html           # Linha do tempo de atendimentos
│       ├── qta.html                # Análise de ocorrências finalizadas/canceladas
│       └── sobre.html              # Informações institucionais e versão
└── README.md                       # Documentação do projeto
```

---

## 🛠 Tecnologias Utilizadas

- **Estrutura & Estilização:** HTML5 semântico, Tailwind CSS (via CDN) e CSS3 customizado com identidade visual militar/institucional e suporte completo a telas escuras (*Dark Mode*).
- **Linguagem & Padrões:** JavaScript Moderno (ES6+ / ES Modules).
- **Visualização de Dados & Gráficos:** Apache ECharts.
- **Mapas & Geoprocessamento:** Leaflet.js, Leaflet.heat, Leaflet.markercluster, Leaflet-Geoman e Turf.js.
- **Tabelas Interativas:** jQuery DataTables 1.13 com tradução pt-BR nativa em memória.
- **Ícones & Tipografia:** FontAwesome 6 e Google Fonts (Inter / Outfit).

---

## 💻 Execução Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/Andre-fdias/dashboardSRQ.git
   cd dashboardSRQ
   ```

2. Inicie um servidor HTTP local na pasta raiz ou em `/docs`:
   - **Com Python 3:**
     ```bash
     python -m http.server 8080 --directory docs
     ```
   - **Com Node.js (npx serve):**
     ```bash
     npx serve docs
     ```
   - **Com VSCode:** Utilize a extensão *Live Server* abrindo `docs/index.html`.

3. Abra no navegador:
   ```
   http://localhost:8080
   ```

> **Aviso:** Evite abrir o arquivo `index.html` diretamente via duplo clique no Windows (`file:///...`), pois o navegador bloqueia requisições Fetch e ES Modules locais por políticas de segurança (CORS).

---

## 🌐 Publicação no GitHub Pages

O projeto já está estruturado para publicação contínua no GitHub Pages:

1. Acesse o repositório no GitHub: **Settings > Pages**.
2. Na seção **Build and deployment**:
   - **Source:** Deploy from a branch.
   - **Branch:** `main` (ou a branch padrão) e diretório `/docs`.
3. Clique em **Save**. O portal estará acessível no link público em poucos minutos.

---

## 📊 Configuração de Fontes de Dados

As planilhas do Google Sheets são consumidas através da API pública do GViz:
- **Detalhamento de Viaturas**: Informações cadastrais de prefixo, modelo, placa, tipo, base e status.
- **Checklist Diário**: Registros das inspeções com 30 itens técnicos, hodômetro, militar responsável e equipe.
- **Abastecimentos**: Litragem, valor total, posto, quilometragem e consumo calculado.
- **Controle de Revisões**: Manutenções e revisões periódicas da frota.

Para atualizar o ID da planilha ou nomes das abas, ajuste as constantes em [`docs/js/api/frota.js`](file:///docs/js/api/frota.js).