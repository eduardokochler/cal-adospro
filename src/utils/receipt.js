import { Share } from 'react-native';
import { formatBRL, formatKg, formatDate } from './format';

export function gerarTextoRecibo(t) {
  const tipo = t.tipo === 'Compra' ? 'COMPRA' : 'VENDA';
  const emoji = t.tipo === 'Compra' ? '📥' : '📤';

  return [
    '━━━━━━━━━━━━━━━━━━━━',
    `${emoji}  RECIBO DE ${tipo}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `📅 Data:       ${formatDate(t.data)}`,
    `👤 Comprador:  ${t.parceiro_nome}`,
    `📦 Material:   ${t.nome_material}`,
    `⚖️  Peso:       ${formatKg(t.peso_kg)}`,
    `💰 Valor/kg:   ${formatBRL(t.valor_kg)}`,
    '──────────────────────',
    `💵 TOTAL:      ${formatBRL(t.valor_total)}`,
    '━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');
}

export async function compartilharRecibo(transacao) {
  try {
    await Share.share({
      message: gerarTextoRecibo(transacao),
    });
  } catch (_) {}
}
