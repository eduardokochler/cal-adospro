import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from './db';

export async function exportarBackup() {
  const db = getDb();

  const dados = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    parceiros: db.getAllSync('SELECT * FROM parceiros'),
    materiais: db.getAllSync('SELECT * FROM materiais'),
    transacoes: db.getAllSync('SELECT * FROM transacoes'),
    financeiro: db.getAllSync('SELECT * FROM financeiro'),
    saldo_caixa: db.getAllSync('SELECT * FROM saldo_caixa'),
  };

  const json = JSON.stringify(dados, null, 2);
  const data = new Date().toISOString().slice(0, 10);
  const filename = `calcadospro_backup_${data}.json`;

  const docUri = Paths.document.uri;
  const fileUri = docUri.endsWith('/') ? `${docUri}${filename}` : `${docUri}/${filename}`;
  const file = new File(fileUri);
  file.write(json);

  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) throw new Error('Compartilhamento não disponível neste dispositivo.');

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup CalcadosPro',
  });
}

export async function importarBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return false;

  const pickedFile = new File(result.assets[0].uri);
  let json;
  try {
    json = await pickedFile.text();
  } catch {
    throw new Error('Não foi possível ler o arquivo selecionado.');
  }

  let dados;
  try {
    dados = JSON.parse(json);
  } catch {
    throw new Error('Arquivo inválido. Selecione um arquivo de backup do CalcadosPro.');
  }

  if (!dados.versao || !Array.isArray(dados.parceiros) || !Array.isArray(dados.materiais)) {
    throw new Error('Arquivo de backup inválido ou corrompido.');
  }

  const db = getDb();

  db.execSync('PRAGMA foreign_keys = OFF');
  try {
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM financeiro');
      db.runSync('DELETE FROM transacoes');
      db.runSync('DELETE FROM materiais');
      db.runSync('DELETE FROM parceiros');
      db.runSync('DELETE FROM saldo_caixa');

      for (const p of dados.parceiros) {
        db.runSync(
          'INSERT INTO parceiros (id, nome, tipo, telefone, criado_em) VALUES (?,?,?,?,?)',
          [p.id, p.nome, p.tipo, p.telefone ?? null, p.criado_em ?? null]
        );
      }

      for (const m of dados.materiais) {
        db.runSync(
          'INSERT INTO materiais (id, nome_material, quantidade_kg, criado_em) VALUES (?,?,?,?)',
          [m.id, m.nome_material, m.quantidade_kg, m.criado_em ?? null]
        );
      }

      for (const t of dados.transacoes) {
        db.runSync(
          'INSERT INTO transacoes (id, tipo, parceiro_id, material_id, peso_kg, valor_kg, valor_total, data) VALUES (?,?,?,?,?,?,?,?)',
          [t.id, t.tipo, t.parceiro_id, t.material_id, t.peso_kg, t.valor_kg, t.valor_total, t.data]
        );
      }

      for (const f of dados.financeiro) {
        db.runSync(
          'INSERT INTO financeiro (id, transacao_id, tipo_fluxo, forma_pagto, valor_parcela, data_vencimento, status, parcela_num, total_parcelas, descricao, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [f.id, f.transacao_id ?? null, f.tipo_fluxo, f.forma_pagto, f.valor_parcela, f.data_vencimento ?? null, f.status, f.parcela_num ?? 1, f.total_parcelas ?? 1, f.descricao ?? null, f.criado_em ?? null]
        );
      }

      for (const s of (dados.saldo_caixa ?? [])) {
        db.runSync('INSERT INTO saldo_caixa (id, saldo) VALUES (?,?)', [s.id, s.saldo]);
      }
      if (!dados.saldo_caixa || dados.saldo_caixa.length === 0) {
        db.runSync('INSERT INTO saldo_caixa (id, saldo) VALUES (1, 0)');
      }
    });
  } finally {
    db.execSync('PRAGMA foreign_keys = ON');
  }

  return true;
}
