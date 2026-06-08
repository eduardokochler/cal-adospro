const KEY = 'calcadospro_v1';
let mem = null;

function load() {
  if (mem) return mem;
  try {
    const s = localStorage.getItem(KEY);
    if (s) { mem = JSON.parse(s); return mem; }
  } catch (_) {}
  mem = {
    parceiros: [], materiais: [], transacoes: [],
    financeiro: [], saldo_caixa: [{ id: 1, saldo: 0 }], _seq: {},
  };
  return mem;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (_) {}
}

function nextId(table) {
  const m = load();
  const max = (m[table] || []).reduce((x, r) => Math.max(x, r.id || 0), 0);
  m._seq[table] = Math.max(max, m._seq[table] || 0) + 1;
  return m._seq[table];
}

function bind(sql, params) {
  if (!params || !params.length) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v == null) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

function lit(s) {
  if (s === 'NULL' || s == null) return null;
  const n = Number(s);
  if (!isNaN(n) && s !== '') return n;
  if ((s[0] === "'" && s.slice(-1) === "'") || (s[0] === '"' && s.slice(-1) === '"'))
    return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function splitComma(str) {
  const out = []; let buf = '', depth = 0, inQ = false, qc = '';
  for (const ch of str) {
    if (inQ) { buf += ch; if (ch === qc) inQ = false; }
    else if (ch === "'" || ch === '"') { inQ = true; qc = ch; buf += ch; }
    else if (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseConds(where) {
  if (!where || !where.trim()) return [];
  return where.split(/\s+AND\s+/i).map(c => {
    const m = c.trim().match(/^(\w+(?:\.\w+)?)\s*(<=|>=|!=|<>|=|<|>)\s*(.+)$/);
    if (!m) return null;
    const col = m[1].includes('.') ? m[1].split('.')[1] : m[1];
    return { col, op: m[2], val: lit(m[3].trim()) };
  }).filter(Boolean);
}

function matches(row, conds) {
  for (const { col, op, val } of conds) {
    const rv = row[col];
    if (op === '=' && rv != val) return false;
    if ((op === '!=' || op === '<>') && rv == val) return false;
    if (op === '<' && !(rv < val)) return false;
    if (op === '>' && !(rv > val)) return false;
    if (op === '<=' && !(rv <= val)) return false;
    if (op === '>=' && !(rv >= val)) return false;
  }
  return true;
}

function sortRows(rows, orderStr) {
  const parts = orderStr.split(',').map(p => {
    const m = p.trim().match(/^(\w+(?:\.\w+)?)\s*(ASC|DESC)?$/i);
    if (!m) return null;
    const col = m[1].includes('.') ? m[1].split('.')[1] : m[1];
    return { col, asc: (m[2] || 'ASC').toUpperCase() !== 'DESC' };
  }).filter(Boolean);
  return [...rows].sort((a, b) => {
    for (const { col, asc } of parts) {
      const va = a[col], vb = b[col];
      let c = 0;
      if (va == null && vb == null) c = 0;
      else if (va == null) c = -1;
      else if (vb == null) c = 1;
      else if (typeof va === 'string') c = va.localeCompare(vb);
      else c = va < vb ? -1 : va > vb ? 1 : 0;
      if (c !== 0) return asc ? c : -c;
    }
    return 0;
  });
}

function doInsert(sql) {
  const m = sql.match(/^INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/i);
  if (!m) return { lastInsertRowId: -1, changes: 0 };
  const db = load();
  const table = m[1].toLowerCase();
  const cols = m[2].split(',').map(s => s.trim());
  const vals = splitComma(m[3]);
  const row = {};
  cols.forEach((c, i) => { row[c] = lit(vals[i]); });
  if (!db[table]) db[table] = [];
  if (/INSERT\s+OR\s+IGNORE/i.test(sql) && row.id != null && db[table].some(r => r.id == row.id))
    return { lastInsertRowId: row.id, changes: 0 };
  if (row.id == null) row.id = nextId(table);
  if (row.criado_em == null && table !== 'saldo_caixa')
    row.criado_em = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db[table].push(row);
  persist();
  return { lastInsertRowId: row.id, changes: 1 };
}

function doUpdate(sql) {
  const m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
  if (!m) return { changes: 0 };
  const db = load();
  const table = m[1].toLowerCase();
  const conds = parseConds(m[3]);
  const sets = splitComma(m[2]).map(s => {
    const sm = s.trim().match(/^(\w+)\s*=\s*(.+)$/);
    return sm ? { col: sm[1].trim(), expr: sm[2].trim() } : null;
  }).filter(Boolean);
  let changes = 0;
  for (const row of (db[table] || [])) {
    if (!matches(row, conds)) continue;
    for (const { col, expr } of sets) {
      const add = expr.match(/^(\w+)\s*\+\s*(.+)$/);
      const sub = expr.match(/^(\w+)\s*-\s*(.+)$/);
      if (add) row[col] = (row[add[1]] || 0) + lit(add[2]);
      else if (sub) row[col] = (row[sub[1]] || 0) - lit(sub[2]);
      else row[col] = lit(expr);
    }
    changes++;
  }
  if (changes) persist();
  return { changes };
}

function doDelete(sql) {
  const m = sql.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (!m) return { changes: 0 };
  const db = load();
  const table = m[1].toLowerCase();
  const conds = parseConds(m[2]);
  const before = (db[table] || []).length;
  db[table] = (db[table] || []).filter(r => !matches(r, conds));
  const changes = before - db[table].length;
  if (changes) persist();
  return { changes };
}

function doSimple(s) {
  const db = load();
  const fm = s.match(/FROM\s+(\w+)/i);
  if (!fm) return [];
  const table = fm[1].toLowerCase();
  const wm = s.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|$)/i);
  const om = s.match(/ORDER\s+BY\s+(.+)$/i);
  const sm = s.match(/^SELECT\s+(.+?)\s+FROM/i);
  let rows = (db[table] || []).map(r => ({ ...r }));
  if (wm) rows = rows.filter(r => matches(r, parseConds(wm[1])));
  if (om) rows = sortRows(rows, om[1]);
  const cols = sm ? sm[1].trim() : '*';
  if (cols === '*') return rows;
  return rows.map(r => {
    const o = {};
    for (const c of splitComma(cols)) {
      const asM = c.match(/^(.+?)\s+AS\s+(\w+)$/i);
      const src = (asM ? asM[1] : c).trim();
      const alias = asM ? asM[2] : (src.includes('.') ? src.split('.')[1] : src);
      o[alias] = r[src.includes('.') ? src.split('.')[1] : src];
    }
    return o;
  });
}

function doAgg(s) {
  const db = load();
  const fm = s.match(/FROM\s+(\w+)/i);
  if (!fm) return [{}];
  let rows = db[fm[1].toLowerCase()] || [];
  const wm = s.match(/WHERE\s+(.+)$/i);
  if (wm) rows = rows.filter(r => matches(r, parseConds(wm[1])));
  const res = {};
  const coalM = s.match(/COALESCE\(SUM\((\w+)\),(\d+)\)\s+AS\s+(\w+)/i);
  if (coalM) res[coalM[3]] = rows.reduce((a, r) => a + (r[coalM[1]] || 0), 0) || Number(coalM[2]);
  const cntM = s.match(/COUNT\(\*\)\s+AS\s+(\w+)/i);
  if (cntM) res[cntM[1]] = rows.length;
  return [res];
}

function doJoin(s) {
  const db = load();
  const fm = s.match(/FROM\s+(\w+)(?:\s+(\w+))?/i);
  if (!fm) return [];
  const mainTable = fm[1].toLowerCase();
  const mainAlias = (fm[2] && !/^(LEFT|JOIN|WHERE|ORDER)$/i.test(fm[2])) ? fm[2] : mainTable;
  const joins = [];
  const jr = /(?:LEFT\s+)?JOIN\s+(\w+)(?:\s+(\w+))?\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/gi;
  let jm;
  while ((jm = jr.exec(s)) !== null) {
    const jt = jm[1].toLowerCase();
    const ja = (jm[2] && !/^ON$/i.test(jm[2])) ? jm[2] : jt;
    joins.push({ table: jt, alias: ja, lk: jm[3], rk: jm[4], left: jm[0].toLowerCase().includes('left') });
  }
  let rows = (db[mainTable] || []).map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) { o[`${mainAlias}.${k}`] = v; o[k] = v; }
    return o;
  });
  for (const j of joins) {
    const jdata = db[j.table] || [];
    const lkAlias = j.lk.includes('.') ? j.lk.split('.')[0] : mainAlias;
    const lkCol = j.lk.includes('.') ? j.lk.split('.')[1] : j.lk;
    const rkCol = j.rk.includes('.') ? j.rk.split('.')[1] : j.rk;
    rows = rows.flatMap(row => {
      const lv = row[`${lkAlias}.${lkCol}`] ?? row[lkCol];
      const matched = jdata.filter(jr => jr[rkCol] == lv);
      if (matched.length) {
        return matched.map(jr => {
          const o = { ...row };
          for (const [k, v] of Object.entries(jr)) { o[`${j.alias}.${k}`] = v; if (!(k in row)) o[k] = v; }
          return o;
        });
      }
      return j.left ? [{ ...row }] : [];
    });
  }
  const wm = s.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|$)/i);
  if (wm) rows = rows.filter(r => matches(r, parseConds(wm[1])));
  const om = s.match(/ORDER\s+BY\s+(.+)$/i);
  if (om) rows = sortRows(rows, om[1]);
  const cm = s.match(/^SELECT\s+(.+?)\s+FROM\s+/i);
  const colsStr = cm ? cm[1].trim() : '*';
  if (colsStr === '*') {
    return rows.map(r => { const o = {}; for (const [k, v] of Object.entries(r)) if (!k.includes('.')) o[k] = v; return o; });
  }
  return rows.map(row => {
    const o = {};
    for (const c of splitComma(colsStr)) {
      const p = c.trim();
      if (p.endsWith('.*')) {
        const a = p.slice(0, -2);
        for (const [k, v] of Object.entries(row)) if (k.startsWith(`${a}.`)) o[k.slice(a.length + 1)] = v;
      } else {
        const asM = p.match(/^(.+?)\s+AS\s+(\w+)$/i);
        const src = (asM ? asM[1] : p).trim();
        const alias = asM ? asM[2] : (src.includes('.') ? src.split('.')[1] : src);
        o[alias] = row[src] ?? row[src.includes('.') ? src.split('.')[1] : src] ?? null;
      }
    }
    return o;
  });
}

function doSelect(sql, params) {
  const s = bind(sql, params).replace(/\s+/g, ' ').trim();
  if (/SELECT\s+(COALESCE|COUNT|SUM)/i.test(s)) return doAgg(s);
  if (/JOIN/i.test(s)) return doJoin(s);
  return doSimple(s);
}

export const webDb = {
  execSync(sql) {
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      if (/^INSERT/i.test(stmt)) doInsert(stmt);
    }
  },
  runSync(sql, params = []) {
    const s = bind(sql, params).trim();
    if (/^INSERT/i.test(s)) return doInsert(s);
    if (/^UPDATE/i.test(s)) return doUpdate(s);
    if (/^DELETE/i.test(s)) return doDelete(s);
    return { lastInsertRowId: -1, changes: 0 };
  },
  getAllSync(sql, params = []) { return doSelect(sql, params); },
  getFirstSync(sql, params = []) { return doSelect(sql, params)[0] ?? null; },
};
