# Dashboard de Máquinas de Cartões

Painel de receita e cobertura de PDVs (máquinas de cartão e Pix) que roda **inteiro no navegador**: sem back-end, sem banco de dados e sem instalação. Você escolhe as planilhas `.xlsx`, o painel agrega as transações e monta três análises com filtros interativos.

> **Aviso: todos os dados deste repositório são fictícios.** A planilha em `dados_exemplo/` é gerada por `gerar_dados_exemplo.py` com valores, unidades, cidades e identificadores inventados. Nenhuma informação real de instituições, pessoas ou estabelecimentos faz parte do projeto.

## Funcionalidades

- **Análise de Receita**: receita total, transações, ticket médio e máquinas com movimento; composição por tipo (débito/crédito/Pix) e por bandeira; evolução mensal.
- **PDV por Localidade**: parque de máquinas, taxa de utilização, receita por região e por descrição de unidade.
- **Consulta por Estado**: tabela dinâmica por UF com busca, ordenação, municípios expansíveis e exportação em CSV.
- Filtros por período, região, estado, descrição da unidade, tipo e bandeira, com chips removíveis.
- Importação por seletor de pasta ou arrastar-e-soltar; log da leitura e avisos de colunas ausentes.
- Base agregada salva no navegador (IndexedDB, com gzip) e exportável em arquivo `.json.gz`.
- Impressão e layout responsivo (menu recolhível, gaveta no celular).

## Arquitetura (MVC)

```
index.html                     marcação das páginas e da janela de importação
css/                           tokens (tema), base, layout, componentes, telas
js/
├── config.js                  regras de negócio, paleta, apelidos de colunas
├── app.js                     ponto de entrada: cria Models e Controllers
├── models/                    dados e regras (não tocam no DOM)
│   ├── PlanilhaModel.js         .xlsx -> fatos + unidades + máquinas
│   ├── CuboModel.js             fatos -> cubo agregado
│   ├── BaseSalvaModel.js        persistência no navegador
│   ├── FiltroModel.js           estado dos filtros
│   └── PainelModel.js           reagregação a cada filtro, CSV
├── views/                     desenho (gráficos Plotly, KPIs, tabelas)
├── controllers/               ligação entre eventos, Models e Views
└── utils/                     texto, formatação pt-BR, eventos, UFs
vendor/fonts/                  Manrope e Source Sans 3 (woff2, licença OFL)
dados_exemplo/                 planilha sintética para testar
gerar_dados_exemplo.py         gerador dos dados fictícios (seed fixa)
```

Os arquivos JS são `<script>` comuns (namespace global `App`), carregados na ordem config, utils, models, views, controllers e app.

## Tecnologias

- HTML, CSS e JavaScript puros (sem framework e sem build)
- [Plotly.js 4.0.0](https://plotly.com/javascript/) e [SheetJS (xlsx) 0.18.5](https://sheetjs.com/), carregados por CDN (cdnjs)
- Fontes Manrope e Source Sans 3 (SIL OFL 1.1), incluídas localmente com as licenças
- Python 3 + openpyxl apenas para gerar os dados de exemplo

## Como executar

Como Plotly e SheetJS vêm de CDN, é preciso acesso à internet. Sirva a pasta por HTTP:

```bash
python -m http.server 8814
```

Abra `http://localhost:8814/`, clique em **Importar base de dados**, escolha a pasta `dados_exemplo/` (ou arraste o arquivo `Analise_Query.xlsx`).

## Geração dos dados de exemplo

```bash
pip install openpyxl
python gerar_dados_exemplo.py
```

Cria `dados_exemplo/Analise_Query.xlsx` (seed fixa, saída reprodutível, menos de 1 MB) com as abas:

| Aba | Colunas principais |
|---|---|
| `Unidades` | ID, Nome, Estado, Municipio, Desc.Região, Descrição da Unidade, Status, Qtd.Membros |
| `Maquinas` | PDV, Nº de série, Modelo, ID_Unidade |
| `Cartões` | Data, Pdv, Tipo, Bandeira, Valor, Status |
| `Pix` | Data, Status, PDV, Valor |

Para usar seus próprios dados, mantenha esse formato (o leitor tolera variação de acento e caixa). Apelidos extras de cabeçalho podem ser adicionados em `aliasColunasExtra`, em `js/config.js`.

## Regras de negócio (`js/config.js`)

| Conceito | Definição |
|---|---|
| Receita | soma dos valores com status aprovado (`regras.statusAprovados`) |
| Movimentação | soma de todos os valores do filtro |
| PDV ativo | máquina com ao menos N transações aprovadas no período |
| Utilização do parque | máquinas com movimento no mês / parque filtrado |
| Sem localidade | PDV sem unidade vinculada ou unidade sem estado/município/região |

## Licença

[MIT](LICENSE)
