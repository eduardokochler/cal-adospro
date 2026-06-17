import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllTransacoes, deleteTransacao, getFinanceiroByTransacao } from '../../database/transactions';
import { formatBRL, formatKg, formatDate } from '../../utils/format';
import { compartilharRecibo } from '../../utils/receipt';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

const TIPOS = ['Todos', 'Compra', 'Venda'];
const PERIODOS = ['Tudo', 'Hoje', '7 dias', 'Este mês', 'Mês ant.'];

function getPeriodRange(periodo) {
  const hoje = new Date();
  const todayStr = hoje.toISOString().split('T')[0];
  if (periodo === 'Hoje') return { inicio: todayStr, fim: todayStr };
  if (periodo === '7 dias') {
    const d = new Date(hoje); d.setDate(d.getDate() - 6);
    return { inicio: d.toISOString().split('T')[0], fim: todayStr };
  }
  if (periodo === 'Este mês') {
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    return { inicio, fim: todayStr };
  }
  if (periodo === 'Mês ant.') {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { inicio: d.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
  }
  return null;
}

export default function MovementsScreen({ navigation }) {
  const [transacoes, setTransacoes] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [periodo, setPeriodo] = useState('Tudo');

  const carregar = useCallback(() => { setTransacoes(getAllTransacoes()); }, []);
  useFocusEffect(carregar);

  function handleEdit(item) {
    const financeiros = getFinanceiroByTransacao(item.id);
    navigation.navigate('NovaMovimentacao', { editItem: item, editFinanceiro: financeiros });
  }

  function handleDelete(item) {
    Alert.alert(
      'Apagar movimentação?',
      `${item.tipo} de ${formatBRL(item.valor_total)} com ${item.parceiro_nome} será apagada. O estoque e saldo serão revertidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar', style: 'destructive',
          onPress: () => { deleteTransacao(item.id); carregar(); },
        },
      ]
    );
  }

  const range = getPeriodRange(periodo);
  const periodFiltered = range
    ? transacoes.filter((t) => t.data >= range.inicio && t.data <= range.fim)
    : transacoes;

  const lista = filtro === 'Todos' ? periodFiltered : periodFiltered.filter((t) => t.tipo === filtro);
  const totalCompras = periodFiltered.filter((t) => t.tipo === 'Compra').reduce((s, t) => s + t.valor_total, 0);
  const totalVendas = periodFiltered.filter((t) => t.tipo === 'Venda').reduce((s, t) => s + t.valor_total, 0);
  const periodoLabel = periodo !== 'Tudo' ? ` · ${periodo}` : '';

  function renderItem({ item }) {
    const isCompra = item.tipo === 'Compra';
    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <View style={[styles.badge, { backgroundColor: isCompra ? '#EFF6FF' : '#F0FDF4' }]}>
            <Text style={{ fontSize: 18 }}>{isCompra ? '📥' : '📤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.parceiro_nome}</Text>
            <Text style={styles.cardSub}>{item.nome_material} · {formatKg(item.peso_kg)} · {formatDate(item.data)}</Text>
            <Text style={styles.cardKg}>{formatBRL(item.valor_kg)}/kg</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cardTotal, { color: isCompra ? C.danger : C.success }]}>
              {isCompra ? '-' : '+'}{formatBRL(item.valor_total)}
            </Text>
            <View style={[styles.tipoBadge, { backgroundColor: isCompra ? '#EFF6FF' : '#F0FDF4' }]}>
              <Text style={[styles.tipoBadgeText, { color: isCompra ? C.primary : C.success }]}>{item.tipo}</Text>
            </View>
          </View>
        </View>
        {item.valor_pendente > 0 && (
          <View style={styles.pagRow}>
            {item.valor_pago > 0 && (
              <View style={styles.pagChip}>
                <Text style={styles.pagChipPago}>✓ Pago {formatBRL(item.valor_pago)}</Text>
              </View>
            )}
            <View style={styles.pagChip}>
              <Text style={styles.pagChipPendente}>⏳ Pendente {formatBRL(item.valor_pendente)}</Text>
            </View>
          </View>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.btnRecibo} onPress={() => compartilharRecibo(item)}>
            <Text style={styles.btnReciboText}>📤 Recibo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEditar} onPress={() => handleEdit(item)}>
            <Text style={styles.btnEditarText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnApagar} onPress={() => handleDelete(item)}>
            <Text style={styles.btnApagarText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: C.danger }]}>
            <Text style={styles.summaryLabel} numberOfLines={1}>Total Compras{periodoLabel}</Text>
            <Text style={[styles.summaryValue, { color: C.danger }]} numberOfLines={1} adjustsFontSizeToFit>{formatBRL(totalCompras)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: C.success }]}>
            <Text style={styles.summaryLabel} numberOfLines={1}>Total Vendas{periodoLabel}</Text>
            <Text style={[styles.summaryValue, { color: C.success }]} numberOfLines={1} adjustsFontSizeToFit>{formatBRL(totalVendas)}</Text>
          </View>
        </View>

        <View style={styles.filtros}>
          {TIPOS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodos} style={{ flexShrink: 0 }}>
          {PERIODOS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.filtroBtn, styles.periodoBtn, periodo === p && styles.periodoBtnActive]}
              onPress={() => setPeriodo(p)}
            >
              <Text style={[styles.filtroText, periodo === p && styles.periodoTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          data={lista}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔄</Text>
              <Text style={styles.emptyText}>Nenhuma movimentação{periodo !== 'Tudo' ? ` em "${periodo}"` : ''}</Text>
              <Text style={styles.emptySub}>Toque no + para registrar</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NovaMovimentacao', {})}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  summaryRow: { flexDirection: 'row', padding: 12, gap: 10 },
  summaryCard: { flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  summaryLabel: { fontSize: 11, color: C.sub, fontWeight: '600' },
  summaryValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  filtros: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexWrap: 'wrap' },
  periodos: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2, gap: 8, alignItems: 'center' },
  filtroBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filtroBtnActive: { backgroundColor: C.primary },
  periodoBtn: { backgroundColor: '#F1F5F9' },
  periodoBtnActive: { backgroundColor: '#0F172A' },
  filtroText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filtroTextActive: { color: '#fff' },
  periodoTextActive: { color: '#fff' },
  card: { backgroundColor: C.card, marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActions: { flexDirection: 'row', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, alignItems: 'center' },
  btnRecibo: { flex: 1, alignItems: 'center' },
  btnReciboText: { fontSize: 13, fontWeight: '600', color: C.primary },
  btnEditar: { paddingHorizontal: 12, paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  btnEditarText: { fontSize: 18 },
  btnApagar: { paddingHorizontal: 12, paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  btnApagarText: { fontSize: 18 },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  cardKg: { fontSize: 11, color: C.sub, marginTop: 2 },
  cardTotal: { fontSize: 15, fontWeight: '800' },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  tipoBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4 },
  pagRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  pagChip: { flexDirection: 'row', alignItems: 'center' },
  pagChipPago: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  pagChipPendente: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
