import { getDb } from './db';

export function getAllMateriais() {
  return getDb().getAllSync('SELECT * FROM materiais ORDER BY nome_material ASC');
}

export function getMaterial(id) {
  return getDb().getFirstSync('SELECT * FROM materiais WHERE id = ?', [id]);
}

export function addMaterial(nome) {
  return getDb().runSync(
    'INSERT INTO materiais (nome_material, quantidade_kg) VALUES (?, 0)',
    [nome]
  );
}

export function updateEstoque(id, delta) {
  getDb().runSync(
    'UPDATE materiais SET quantidade_kg = quantidade_kg + ? WHERE id = ?',
    [delta, id]
  );
}

export function deleteMaterial(id) {
  getDb().runSync('DELETE FROM materiais WHERE id = ?', [id]);
}
