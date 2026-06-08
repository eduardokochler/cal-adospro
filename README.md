# CalcadosPro

Aplicativo mobile para gestão de compra e venda de materiais termoplásticos. Desenvolvido em React Native com Expo, funciona 100% offline com banco de dados local no próprio aparelho.

---

## Funcionalidades

### Painel Principal
- Resumo financeiro: saldo em caixa, valores a receber, valores a pagar e pagamentos vencidos
- Acesso rápido a todas as seções
- Exportação e importação de backup

### Parceiros
- Cadastro de **Compradores** e **Vendedores**
- Telefone de contato
- Histórico completo de movimentações por parceiro

### Estoque / Materiais
- Cadastro de tipos de materiais (ex: PVC, EVA, etc.)
- Controle automático de estoque em kg
- Saldo atualizado a cada compra ou venda

### Movimentações
- Registro de **Compras** e **Vendas**
- Peso em kg e valor por kg
- Cálculo automático do valor total
- Filtros por período, tipo e parceiro
- Formas de pagamento:
  - **PIX** — à vista ou a prazo (com data de vencimento)
  - **Dinheiro** — à vista ou a prazo
  - **Cheque** — múltiplos cheques com valor e data individual por título
  - **Pagamento misto** — combinação de qualquer forma (ex: parte em cheque + parte em PIX)

### Financeiro
- Extrato de todas as entradas e saídas
- Confirmar recebimento/pagamento de lançamentos pendentes (PIX e Dinheiro a prazo)
- Compensar cheques recebidos
- Lançamentos avulsos (despesas e receitas fora de movimentações)
- Resumo: **A Receber**, **A Pagar**, **Vencidos Hoje**, **Cheques em Compensação**

### Backup e Restauração
- **Exportar**: gera um arquivo `.json` com todos os dados e compartilha via qualquer app (WhatsApp, Google Drive, e-mail, etc.)
- **Importar**: seleciona um arquivo de backup e restaura todos os dados (parceiros, materiais, movimentações, financeiro e saldo)

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| React Native + Expo SDK 54 | Base do app |
| expo-sqlite | Banco de dados local (SQLite) |
| expo-file-system | Leitura e escrita de arquivos |
| expo-sharing | Compartilhamento do backup |
| expo-document-picker | Seleção do arquivo de backup |
| react-native-safe-area-context | Suporte à barra de navegação virtual |
| React Navigation | Navegação entre telas |
| EAS Build | Geração do APK |

---

## Estrutura do Projeto

```
src/
├── database/
│   ├── db.js              # Inicialização do SQLite e criação das tabelas
│   ├── partners.js        # Operações de parceiros
│   ├── materials.js       # Operações de materiais e estoque
│   ├── transactions.js    # Registro de compras e vendas
│   ├── financial.js       # Lançamentos financeiros e saldo
│   └── backup.js          # Exportar e importar backup
├── navigation/
│   └── AppNavigator.js    # Navegação principal (bottom tabs)
├── screens/
│   ├── HomeScreen.js      # Painel principal
│   ├── financial/
│   │   └── FinancialScreen.js
│   ├── inventory/
│   │   ├── InventoryScreen.js
│   │   └── AddMaterialScreen.js
│   ├── movements/
│   │   ├── MovementsScreen.js
│   │   └── NewMovementScreen.js
│   └── partners/
│       ├── PartnersScreen.js
│       ├── AddPartnerScreen.js
│       └── PartnerDetailScreen.js
└── utils/
    ├── format.js          # Formatação de moeda, kg e datas
    └── receipt.js         # Geração de recibos
```

---

## Banco de Dados

```sql
parceiros       -- compradores e vendedores
materiais       -- tipos de material com quantidade em estoque
transacoes      -- registro de cada compra ou venda
financeiro      -- lançamentos financeiros (parcelas, cheques, a prazo)
saldo_caixa     -- saldo atual do caixa (única linha)
```

---

## Como Rodar Localmente

**Pré-requisitos:** Node.js, Expo CLI, EAS CLI

```bash
# Instalar dependências
npm install

# Rodar no Expo Go (desenvolvimento)
npx expo start

# Gerar APK
eas build --platform android --profile preview
```

---

## Fluxo Financeiro

- **PIX / Dinheiro à vista** → entra/sai do caixa imediatamente
- **PIX / Dinheiro a prazo** → fica como *Pendente*, atualiza o caixa somente ao confirmar
- **Cheque** → fica como *Pendente* até ser compensado manualmente
- **Pagamento misto** → cada forma gera seu próprio lançamento financeiro independente
