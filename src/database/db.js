import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { webDb } from './webDb';

let _db = null;

export function getDb() {
  if (Platform.OS === 'web') return webDb;
  if (!_db) _db = SQLite.openDatabaseSync('calcadospro.db');
  return _db;
}

export function initDatabase() {
  const db = getDb();
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS parceiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      telefone TEXT,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS materiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_material TEXT NOT NULL UNIQUE,
      quantidade_kg REAL NOT NULL DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      parceiro_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      peso_kg REAL NOT NULL,
      valor_kg REAL NOT NULL,
      valor_total REAL NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY (parceiro_id) REFERENCES parceiros(id),
      FOREIGN KEY (material_id) REFERENCES materiais(id)
    );

    CREATE TABLE IF NOT EXISTS financeiro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transacao_id INTEGER,
      tipo_fluxo TEXT NOT NULL,
      forma_pagto TEXT NOT NULL,
      valor_parcela REAL NOT NULL,
      data_vencimento TEXT,
      status TEXT NOT NULL DEFAULT 'Pendente',
      parcela_num INTEGER DEFAULT 1,
      total_parcelas INTEGER DEFAULT 1,
      descricao TEXT,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (transacao_id) REFERENCES transacoes(id)
    );

    CREATE TABLE IF NOT EXISTS saldo_caixa (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      saldo REAL NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO saldo_caixa (id, saldo) VALUES (1, 0);
  `);
}
