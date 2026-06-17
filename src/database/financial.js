import { getDb } from './db';

export function getSaldoCaixa() {
  const row = getDb().getFirstSync('SELECT saldo FROM saldo_caixa WHERE id = 1');
  return row ? row.saldo : 0;
}

export function getAllFinanceiro() {
  return getDb().getAllSync(`
    SELECT f.*, p.nome AS parceiro_nome, t.tipo AS transacao_tipo, m.nome_material
    FROM financeiro f
    LEFT JOIN transacoes t ON f.transacao_id = t.id
    LEFT JOIN parceiros p ON t.parceiro_id = p.id
    LEFT JOIN materiais m ON t.material_id = m.id
    ORDER BY f.data_vencimento ASC, f.id ASC
  `);
}

export function getChequesVencendo() {
  const hoje = new Date().toISOString().split('T')[0];
  return getDb().getAllSync(`
    SELECT f.*, p.nome AS parceiro_nome, t.tipo AS transacao_tipo
    FROM financeiro f
    LEFT JOIN transacoes t ON f.transacao_id = t.id
    LEFT JOIN parceiros p ON t.parceiro_id = p.id
    WHERE f.forma_pagto = 'Cheque' AND f.status != 'Compensado' AND f.data_vencimento <= ?
    ORDER BY f.data_vencimento ASC
  `, [hoje]);
}

export function depositarCheque(id) {
  getDb().runSync('UPDATE financeiro SET status = ? WHERE id = ?', ['Depositado', id]);
}

export function compensarCheque(id) {
  confirmarPagamento(id);
}

export function lancamentoAvulso({ tipo_fluxo, descricao, valor, forma_pagto, data_vencimento, a_prazo }) {
  const db = getDb();
  const hoje = new Date().toISOString().split('T')[0];
  const isPendente = forma_pagto === 'Cheque' || a_prazo;
  const status = isPendente ? 'Pendente' : 'Compensado';
  db.runSync(
    'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, descricao) VALUES (?,?,?,?,?,?,?)',
    [null, tipo_fluxo, forma_pagto, valor, data_vencimento || hoje, status, descricao]
  );
  if (!isPendente) {
    if (tipo_fluxo === 'Entrada') {
      db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [valor]);
    } else {
      db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [valor]);
    }
  }
}

export function confirmarPagamento(id) {
  const db = getDb();
  const item = db.getFirstSync('SELECT * FROM financeiro WHERE id = ?', [id]);
  if (!item || item.status === 'Compensado') return;
  db.runSync('UPDATE financeiro SET status = ? WHERE id = ?', ['Compensado', id]);
  if (item.tipo_fluxo === 'Entrada') {
    db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [item.valor_parcela]);
  } else {
    db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [item.valor_parcela]);
  }
}

export function registrarPagamentoParcial(id, valorParcial) {
  const db = getDb();
  const f = db.getFirstSync('SELECT * FROM financeiro WHERE id = ? AND status = ?', [id, 'Pendente']);
  if (!f) return;
  const original = f.valor_parcela;
  const restante = parseFloat((original - valorParcial).toFixed(2));
  const hoje = new Date().toISOString().split('T')[0];
  const hojeFormatado = hoje.slice(8, 10) + '/' + hoje.slice(5, 7) + '/' + hoje.slice(0, 4);

  // Formatar valores para descrição
  function fmt(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // Atualiza o registro pendente: reduz valor e anota o histórico
  db.runSync(
    'UPDATE financeiro SET valor_parcela = ?, descricao = ? WHERE id = ?',
    [restante, `Restante (original ${fmt(original)}, antecipou ${fmt(valorParcial)} em ${hojeFormatado})`, id]
  );

  // Cria registro compensado para o valor antecipado
  db.runSync(
    'INSERT INTO financeiro (transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, descricao) VALUES (?,?,?,?,?,?,?)',
    [f.transacao_id, f.tipo_fluxo, f.forma_pagto, valorParcial, hoje, 'Compensado',
      `Antecipação em ${hojeFormatado} (original ${fmt(original)})`]
  );

  if (f.tipo_fluxo === 'Entrada') {
    db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [valorParcial]);
  } else {
    db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [valorParcial]);
  }
}

export function deleteFinanceiroAvulso(id) {
  const db = getDb();
  const f = db.getFirstSync('SELECT * FROM financeiro WHERE id = ? AND transacao_id IS NULL', [id]);
  if (!f) return;
  if (f.status === 'Compensado') {
    if (f.tipo_fluxo === 'Entrada') {
      db.runSync('UPDATE saldo_caixa SET saldo = saldo - ? WHERE id = 1', [f.valor_parcela]);
    } else {
      db.runSync('UPDATE saldo_caixa SET saldo = saldo + ? WHERE id = 1', [f.valor_parcela]);
    }
  }
  db.runSync('DELETE FROM financeiro WHERE id = ?', [id]);
}

export function getResumoFinanceiro() {
  const db = getDb();
  const saldo = getSaldoCaixa();
  const hoje = new Date().toISOString().split('T')[0];

  const pendEntrada = db.getFirstSync(
    "SELECT COALESCE(SUM(valor_parcela),0) AS total FROM financeiro WHERE tipo_fluxo='Entrada' AND status='Pendente'"
  );
  const pendSaida = db.getFirstSync(
    "SELECT COALESCE(SUM(valor_parcela),0) AS total FROM financeiro WHERE tipo_fluxo='Saida' AND status='Pendente'"
  );
  const vencHoje = db.getFirstSync(
    "SELECT COUNT(*) AS qtd FROM financeiro WHERE status='Pendente' AND data_vencimento <= ?",
    [hoje]
  );
  const emComp = db.getFirstSync(
    "SELECT COUNT(*) AS qtd FROM financeiro WHERE forma_pagto='Cheque' AND status='Depositado'"
  );

  return {
    saldo,
    aReceber: pendEntrada?.total ?? 0,
    aPagar: pendSaida?.total ?? 0,
    vencidosHoje: vencHoje?.qtd ?? 0,
    chequesEmCompensacao: emComp?.qtd ?? 0,
  };
}
