import { getDb } from './db';

export function getAllParceiros() {
  return getDb().getAllSync('SELECT * FROM parceiros ORDER BY nome ASC');
}

export function addParceiro(nome, telefone) {
  return getDb().runSync(
    'INSERT INTO parceiros (nome, tipo, telefone) VALUES (?, ?, ?)',
    [nome, 'Parceiro', telefone || null]
  );
}

export function updateParceiro(id, nome, telefone) {
  getDb().runSync(
    'UPDATE parceiros SET nome = ?, telefone = ? WHERE id = ?',
    [nome, telefone || null, id]
  );
}

export function deleteParceiro(id) {
  getDb().runSync('DELETE FROM parceiros WHERE id = ?', [id]);
}
