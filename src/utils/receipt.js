import { Share } from 'react-native';
import { formatBRL, formatKg, formatDate } from './format';
import { getFinanceiroByTransacao } from '../database/transactions';

function linhaVencimento(financeiros) {
  const prazo = financeiros.find(f => f.status === 'Pendente');
  if (!prazo) return [];
  return [`📅 Vencimento:   ${formatDate(prazo.data_vencimento)}`];
}

export function gerarTextoRecibo(t, financeiros) {
  const isVenda = t.tipo === 'Venda';
  const tipo = isVenda ? 'VENDA' : 'COMPRA';
  const emoji = isVenda ? '📤' : '📥';
  const parceiroLabel = isVenda ? 'Cliente' : 'Fornecedor';

  const linhas = [
    '━━━━━━━━━━━━━━━━━━━━',
    `${emoji}  RECIBO DE ${tipo}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `📅 Data:         ${formatDate(t.data)}`,
    `👤 ${parceiroLabel}:  ${t.parceiro_nome}`,
    `📦 Material:     ${t.nome_material}`,
    `⚖️  Peso:         ${formatKg(t.peso_kg)}`,
    `💰 Valor/kg:     ${formatBRL(t.valor_kg)}`,
    '──────────────────────',
    `💵 TOTAL:        ${formatBRL(t.valor_total)}`,
    ...linhaVencimento(financeiros),
    '━━━━━━━━━━━━━━━━━━━━',
  ];

  return linhas.join('\n');
}

export async function compartilharRecibo(transacao) {
  try {
    const financeiros = getFinanceiroByTransacao(transacao.id);
    await Share.share({
      message: gerarTextoRecibo(transacao, financeiros),
    });
  } catch (_) {}
}
