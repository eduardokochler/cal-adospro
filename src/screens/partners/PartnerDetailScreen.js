import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTransacoesPorParceiro } from '../../database/transactions';
import { formatBRL, formatKg, formatDate } from '../../utils/format';
import { compartilharRecibo } from '../../utils/receipt';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

const TIPO_COLORS = {
  Comprador: { bg: '#EFF6FF', text: '#1D4ED8' },
  Vendedor:  { bg: '#F0FDF4', text: '#15803D' },
};

export default function PartnerDetailScreen({ route, navigation }) {
  const { parceiro } = route.params;
  const [transacoes, setTransacoes] = useState([]);
  const [filtro, setFiltro] = useState('Todos');

  const carregar = useCallback(() => {
    setTransacoes(getTransacoesPorParceiro(parceiro.id));
  }, [parceiro.id]);

  useFocusEffect(carregar);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddParceiro', { parceiro })}
          style={{ marginRight: 4, padding: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✏️ Editar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, parceiro]);

  const lista = filtro === 'Todos' ? transacoes : transacoes.filter((t) => t.tipo === filtro);

  const totalCompras = transacoes.filter((t) => t.tipo === 'Compra').reduce((s, t) => s + t.valor_total, 0);
  const qtdCompras   = transacoes.filter((t) => t.tipo === 'Compra').length;
  const totalVendas  = transacoes.filter((t) => t.tipo === 'Venda').reduce((s, t) => s + t.valor_total, 0);
  const qtdVendas    = transacoes.filter((t) => t.tipo === 'Venda').length;
  const saldoLiquido = totalVendas - totalCompras;

  const cores = TIPO_COLORS[parceiro.tipo] || TIPO_COLORS.Comprador;

  function renderItem({ item }) {
    const isCompra = item.tipo === 'Compra';
    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <View style={[styles.cardBadge, { backgroundColor: isCompra ? '#EFF6FF' : '#F0FDF4' }]}>
            <Text style={{ fontSize: 18 }}>{isCompra ? '📥' : '📤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardMaterial}>{item.nome_material}</Text>
            <Text style={styles.cardSub}>{formatKg(item.peso_kg)} · {formatBRL(item.valor_kg)}/kg · {formatDate(item.data)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cardValor, { color: isCompra ? C.danger : C.success }]}>
              {isCompra ? '-' : '+'}{formatBRL(item.valor_total)}
            </Text>
            <View style={[styles.tipoBadge, { backgroundColor: isCompra ? '#EFF6FF' : '#F0FDF4' }]}>
              <Text style={[styles.tipoBadgeText, { color: isCompra ? C.primary : C.success }]}>{item.tipo}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.btnRecibo} onPress={() => compartilharRecibo(item)}>
          <Text style={styles.btnReciboText}>📤 Compartilhar Recibo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Cabeçalho do parceiro */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerNome}>{parceiro.nome}</Text>
            <View style={[styles.badge, { backgroundColor: cores.bg }]}>
              <Text style={[styles.badgeText, { color: cores.text }]}>{parceiro.tipo}</Text>
            </View>
          </View>
          {parceiro.telefone ? (
            <Text style={styles.headerTel}>📞 {parceiro.telefone}</Text>
          ) : null}
        </View>

        {/* Cards de resumo */}
        <View style={styles.resumoRow}>
          <View style={[styles.resumoCard, { borderLeftColor: C.danger }]}>
            <Text style={styles.resumoLabel}>Compras</Text>
            <Text style={[styles.resumoValor, { color: C.danger }]}>{formatBRL(totalCompras)}</Text>
            <Text style={styles.resumoQtd}>{qtdCompras} transação(ões)</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: C.success }]}>
            <Text style={styles.resumoLabel}>Vendas</Text>
            <Text style={[styles.resumoValor, { color: C.success }]}>{formatBRL(totalVendas)}</Text>
            <Text style={styles.resumoQtd}>{qtdVendas} transação(ões)</Text>
          </View>
          <View style={[styles.resumoCard, { borderLeftColor: saldoLiquido >= 0 ? C.success : C.danger }]}>
            <Text style={styles.resumoLabel}>Saldo líquido</Text>
            <Text style={[styles.resumoValor, { color: saldoLiquido >= 0 ? C.success : C.danger }]}>
              {saldoLiquido >= 0 ? '+' : ''}{formatBRL(saldoLiquido)}
            </Text>
            <Text style={styles.resumoQtd}>{transacoes.length} no total</Text>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filtros}>
          {['Todos', 'Compra', 'Venda'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        <FlatList
          data={lista}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>Nenhuma transação ainda</Text>
              <Text style={styles.emptySub}>As movimentações com este parceiro aparecerão aqui</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  header: { backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerNome: { fontSize: 20, fontWeight: '800', color: C.text, flex: 1, marginRight: 10 },
  headerTel: { fontSize: 13, color: C.sub, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  resumoRow: { flexDirection: 'row', padding: 12, gap: 8 },
  resumoCard: { flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 10, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  resumoLabel: { fontSize: 10, color: C.sub, fontWeight: '600', textTransform: 'uppercase' },
  resumoValor: { fontSize: 13, fontWeight: '800', marginTop: 3 },
  resumoQtd: { fontSize: 10, color: C.sub, marginTop: 2 },
  filtros: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  filtroBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filtroBtnActive: { backgroundColor: C.primary },
  filtroText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filtroTextActive: { color: '#fff' },
  card: { backgroundColor: C.card, marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnRecibo: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, alignItems: 'center' },
  btnReciboText: { fontSize: 13, fontWeight: '600', color: C.primary },
  cardBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMaterial: { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  cardValor: { fontSize: 15, fontWeight: '800' },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  tipoBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
});
