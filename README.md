# Portal Analítico Operacional - Estação de Bombeiros São Roque

Este projeto é um dashboard 100% estático, focado na visualização de dados operacionais do 15º Grupamento de Bombeiros (2º Subgrupamento de Bombeiros - Estação São Roque). Ele consome os dados diretamente de uma planilha pública do Google Sheets.

## Visão Geral do Projeto

- **Arquitetura 100% Estática (Serverless):** Sem backend, sem banco de dados, sem login.
- **Hospedagem:** Preparado para rodar no GitHub Pages.
- **Fontes de Dados:** Lê o arquivo `.xlsx` gerado pelo Google Sheets em tempo real.
- **Performance:** Processamento local no navegador, armazenamento em Cache (LocalStorage) configurável para evitar requisições redundantes à API do Google e Nominatim (Geocoding).
- **Tecnologias:** HTML5, CSS3, JavaScript (ES2024), Bootstrap 5, Apache ECharts, Leaflet (Mapas), DataTables e SheetJS.

## Arquitetura e Estrutura de Diretórios

O projeto obedece ao padrão modular. O código-fonte principal que será servido no GitHub Pages está dentro da pasta `docs/`.

```
docs/
├── index.html            # Dashboard Executivo e KPIs Globais
├── ocorrencias.html      # Tabela dinâmica de ocorrências (DataTables)
├── mapa.html             # Mapa Operacional com Heatmap e Clusters (Leaflet)
├── css/
│   └── main.css          # Identidade visual, cores institucionais e Dark Mode
├── js/
│   ├── api/
│   │   └── sheets.js     # Integração com SheetJS para baixar e converter a planilha
│   ├── store/
│   │   └── dataStore.js  # Gerenciamento de Estado, Filtros e Cache (LocalStorage)
│   ├── components/
│   │   └── filters.js    # Renderização dinâmica dos filtros globais
│   ├── layout/
│   │   ├── theme.js      # Controlador do Tema Claro/Escuro
│   │   └── sidebar.js    # Controlador da navegação lateral
│   ├── app.js            # Entry-point da página inicial
│   └── pages/            # Scripts específicos de cada página (ex: mapa.js)
```

## Como Executar Localmente

1. Clone o repositório.
2. Abra a pasta `docs/` utilizando a extensão **Live Server** (VSCode) ou inicie um servidor HTTP local simples:
   - Python: `cd docs && python -m http.server 8000`
   - Node.js: `npx serve docs`
3. Acesse `http://localhost:8000` no navegador.

> **Importante:** Não abra o `index.html` diretamente pelo sistema de arquivos (protocolo `file://`), pois o JavaScript em Módulos (ES Modules) e requisições Fetch bloqueiam acesso local por segurança (CORS).

## Como Publicar no GitHub Pages

O projeto foi projetado para publicação via GitHub Pages através da pasta `/docs`.

1. Crie um repositório no GitHub.
2. Envie todos os arquivos (commit e push na branch `main`).
3. Vá em **Settings** > **Pages** no seu repositório GitHub.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Selecione a branch `main` e mude a pasta raiz de `/(root)` para `/docs`.
6. Salve. O site estará disponível em alguns minutos.

## Como Atualizar a URL da Planilha

Para trocar a planilha de origem, edite o arquivo `docs/js/api/sheets.js`:

```javascript
// Substitua o link abaixo pela sua nova URL publicada:
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/.../pub?output=xlsx';
```

## Como Adicionar Novas Páginas

1. Copie o arquivo `docs/index.html` ou `docs/ocorrencias.html` e renomeie-o.
2. Altere o título e o conteúdo principal na tag `<main>`.
3. Adicione o link para a nova página na `sidebar` (`docs/index.html` e nos demais arquivos `.html`).
4. Crie um script dedicado em `docs/js/pages/nova-pagina.js` e inclua `<script type="module" src="js/pages/nova-pagina.js"></script>` no final do seu novo HTML.

## Personalizar Cores e Identidade Visual

As cores estão centralizadas em `docs/css/main.css` nas variáveis `:root`.
- `--brand-red`: Cor primária da Estação.
- `--bg-primary` e `--bg-secondary`: Controlam o fundo da aplicação nos modos claro/escuro.

## Estratégia de Cache e Limitações Conhecidas

- O **DataStore** (`dataStore.js`) realiza download da planilha uma única vez a cada 1 hora (configurável). A leitura subsequente entre páginas ocorre imediatamente do LocalStorage (memória do navegador).
- O **Mapa Operacional** utiliza a API aberta do Nominatim. Como as coordenadas nem sempre estão presentes na planilha, é feito geocoding com cache persistente. O script introduz delays intencionais para respeitar o rate limit da API pública (1 req/sec).

> **Atenção (Quota do LocalStorage):** Navegadores normalmente permitem armazenar cerca de 5MB por domínio. Se a planilha ultrapassar dezenas de milhares de linhas, o cache pode falhar. O sistema irá tentar usar apenas requisições diretas neste cenário.