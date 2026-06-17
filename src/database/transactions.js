import { getDb } from './db';
import { updateEstoque } from './materials';

export function getAllTransacoes() {
  return getDb().getAllSync(`
    SELECT t.*, p.nome AS parceiro_nome, m.nome_material,
      COALESCE((SELECT SUM(f.valor_parcela) FROM financeiro f WHERE f.transacao_id = t.id AND f.status = 'Compensado'), 0) AS valor_pago,
      COALESCE((SELECT SUM(f.valor_parcela) FROM financeiro f WHERE f.transacao_id = t.id AND f.status = 'Pendente'), 0) AS valor_pendente
    FROM transacoes t
    JOIN parceiros p ON t.parceiro_id = p.id
    JOIN materiais m ON t.material_id = m.id
    ORDER BY t.data DESC, t.id DESC
  `);
}

export function getFinanceiroByTransacao(id) {
  return getDb().getAllSync(
    'SELECT * FROM financeiro WHERE transacao_id = ? ORDER BY parcela_num ASC',
    [id]
  );
}

export function getTransacaoById(id) {
  return getDb().getFirstSync(`
    SELECT t.*, p.nome AS parceiro_nome, m.nome_material
    FROM transacoes t
    JOIN parceiros p ON t.parceiro_id = p.id
    JOIN materiais m ON t.material_id = m.id
    WHERE t.id = ?
  `, [id]);
}

export function getTransacoesPorParceiro(parceiro_id) {
  return getDb().getAllSync(`
    SELECT t.*, p.nome AS parceiro_nome, m.nome_material,
      COALESCE((SELECT SUM(f.valor_parcela) FROM financeiro f WHERE f.transacao_id = t.id AND f.status = 'Compensado'), 0) AS valor_pago,
      COALESCE((SELECT SUM(f.valor_parcela) FROM financeiro f WHERE f.transacao_id = t.id AND f.status = 'Pendente'), 0) AS valor_pendente
    FROM transacoes t
    JOIN parceiros p ON t.parceiro_id = p.id
    JOIN materiais m ON t.material_id = m.id
    WHERE t.parceiro_id = ?
    ORDER BY t.data DESC, t.id DESC
  `, [parceiro_id]);
}

function inserirCheques(db, transacao_id, tipoFluxo, valor_total, parcelasCustom, parcelas, intervalo_dias) {
  if (parcelasCustom && parcelasCustom.length > 0) {
    for (const p of parcelasCustom) {
      db.runSync(
        'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, parcela_num, total_parcelas, descricao) VALUES (?,?,?,?,?,?,?,?,?)',
        [transacao_id, tipoFluxo, 'Cheque', p.valor, p.data, 'Pendente', p.num, p.total, `Cheque ${p.num}/${p.total}`]
      );
    }
  } else {
    const n = parcelas || 1;
    const valorParc = valor_total / n;
    const dias = intervalo_dias || 30;
    for (let i = 1; i <= n; i++) {
      const venc = new Date();
      venc.setDate(venc.getDate() + dias * i);
      const dataVenc = venc.toISOString().split('T')[0];
      db.runSync(
        'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, parcela_num, total_parcelas, descricao) VALUES (?,?,?,?,?,?,?,?,?)',
        [transacao_id, tipoFluxo, 'Cheque', valorParc, dataVenc, 'Pendente', i, n, `Cheque ${i}/${n}`]
      );
    }
  }
}

function inserirPagamento(db, transacao_id, tipoFluxo, pag, data) {
  const { forma, valor, aPrazo, dataVencimento, parcelas, intervaloDias, parcelasCustom } = pag;

  if (forma === 'PIX' || forma === 'Dinheiro') {
    if (aPrazo && dataVencimento) {
      db.runSync(
        'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, descricao) VALUES (?,?,?,?,?,?,?)',
        [transacao_id, tipoFluxo, forma, valor, dataVencimento, 'Pendente',
          tipoFluxo === 'Entrada' ? 'Recebimento a prazo' : 'Pagamento a prazo']
      );
    } else {
      db.runSync(
        'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, descricao) VALUES (?,?,?,?,?,?,?)',
        [transacao_id, tipoFluxo, forma, valor, data, 'Compensado',
          tipoFluxo === 'Entrada' ? 'Recebimento imediato' : 'Pagamento imediato']
      );
      if (tipoFluxo === 'Entrada') {
        db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [valor]);
      } else {
        db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [valor]);
      }
    }
  } else if (forma === 'Cheque') {
    inserirCheques(db, transacao_id, tipoFluxo, valor, parcelasCustom, parcelas, intervaloDias);
  }
}

export function deleteTransacao(id) {
  const db = getDb();
  const t = db.getFirstSync('SELECT * FROM transacoes WHERE id = ?', [id]);
  if (!t) return;

  // Reverter saldo_caixa para registros já compensados
  const financeiros = db.getAllSync('SELECT * FROM financeiro WHERE transacao_id = ?', [id]);
  for (const f of financeiros) {
    if (f.status === 'Compensado') {
      if (f.tipo_fluxo === 'Entrada') {
        db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [f.valor_parcela]);
      } else {
        db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [f.valor_parcela]);
      }
    }
  }

  // Reverter estoque
  if (t.tipo === 'Compra') {
    db.runSync('UPDATE materiais SET quantidade_kg = quantidade_kg - ? WHERE id = ?', [t.peso_kg, t.material_id]);
  } else {
    db.runSync('UPDATE materiais SET quantidade_kg = quantidade_kg + ? WHERE id = ?', [t.peso_kg, t.material_id]);
  }

  db.runSync('DELETE FROM financeiro WHERE transacao_id = ?', [id]);
  db.runSync('DELETE FROM transacoes WHERE id = ?', [id]);
}

export function registrarCompra({ parceiro_id, material_id, peso_kg, valor_kg, pagamentos }) {
  const db = getDb();
  const valor_total = peso_kg * valor_kg;
  const data = new Date().toISOString().split('T')[0];

  const res = db.runSync(
    'INSERT INTO transacoes (tipo, parceiro_id, material_id, peso_kg, valor_kg, valor_total, data) VALUES (?,?,?,?,?,?,?)',
    ['Compra', parceiro_id, material_id, peso_kg, valor_kg, valor_total, data]
  );
  const transacao_id = res.lastInsertRowId;

  updateEstoque(material_id, peso_kg);

  for (const pag of pagamentos) {
    inserirPagamento(db, transacao_id, 'Saida', pag, data);
  }

  return transacao_id;
}

export function registrarVenda({ parceiro_id, material_id, peso_kg, valor_kg, pagamentos }) {
  const db = getDb();
  const estoque = db.getFirstSync('SELECT quantidade_kg FROM materiais WHERE id = ?', [material_id]);

  if (!estoque || estoque.quantidade_kg < peso_kg) {
    const disponivel = estoque ? estoque.quantidade_kg : 0;
    throw new Error(`ESTOQUE_INSUFICIENTE:${disponivel}`);
  }

  const valor_total = peso_kg * valor_kg;
  const data = new Date().toISOString().split('T')[0];

  const res = db.runSync(
    'INSERT INTO transacoes (tipo, parceiro_id, material_id, peso_kg, valor_kg, valor_total, data) VALUES (?,?,?,?,?,?,?)',
    ['Venda', parceiro_id, material_id, peso_kg, valor_kg, valor_total, data]
  );
  const transacao_id = res.lastInsertRowId;

  updateEstoque(material_id, -peso_kg);

  for (const pag of pagamentos) {
    inserirPagamento(db, transacao_id, 'Entrada', pag, data);
  }

  return transacao_id;
}
