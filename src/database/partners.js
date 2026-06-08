import { getDb } from './db';

export function getAllParceiros() {
  return getDb().getAllSync('SELECT * FROM parceiros ORDER BY nome ASC');
}

export function getParceiroPorTipo(tipo) {
  return getDb().getAllSync('SELECT * FROM parceiros WHERE tipo = ? ORDER BY nome ASC', [tipo]);
}

export function addParceiro(nome, tipo, telefone) {
  return getDb().runSync(
    'INSERT INTO parceiros (nome, tipo, telefone) VALUES (?, ?, ?)',
    [nome, tipo, telefone || null]
  );
}

export function updateParceiro(id, nome, tipo, telefone) {
  getDb().runSync(
    'UPDATE parceiros SET nome = ?, tipo = ?, telefone = ? WHERE id = ?',
    [nome, tipo, telefone || null, id]
  );
}

export function deleteParceiro(id) {
  getDb().runSync('DELETE FROM parceiros WHERE id = ?', [id]);
}
