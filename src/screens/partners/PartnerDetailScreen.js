import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTransacoesPorParceiro, deleteTransacao, getFinanceiroByTransacao } from '../../database/transactions';
import { registrarPagamentoParcial } from '../../database/financial';
import { formatBRL, formatKg, formatDate } from '../../utils/format';
import { compartilharRecibo } from '../../utils/receipt';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

export default function PartnerDetailScreen({ route, navigation }) {
  const { parceiro } = route.params;
  const [transacoes, setTransacoes] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [modalParcial, setModalParcial] = useState(false);
  const [parcialFinanceiro, setParcialFinanceiro] = useState(null);
  const [parcialTransacao, setParcialTransacao] = useState(null);
  const [valorParcial, setValorParcial] = useState('');

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

  function abrirParcial(item) {
    const financeiros = getFinanceiroByTransacao(item.id);
    const pendente = financeiros.find(f => f.status === 'Pendente');
    if (!pendente) {
      Alert.alert('Sem pendências', 'Esta transação não possui valores pendentes.');
      return;
    }
    setParcialFinanceiro(pendente);
    setParcialTransacao(item);
    setValorParcial('');
    setModalParcial(true);
  }

  function confirmarParcial() {
    const v = parseFloat(valorParcial.replace(',', '.'));
    if (!v || v <= 0) { Alert.alert('Atenção', 'Informe um valor válido.'); return; }
    if (v >= parcialFinanceiro.valor_parcela) {
      Alert.alert('Atenção', `O valor deve ser menor que o total pendente (${formatBRL(parcialFinanceiro.valor_parcela)}).\n\nPara quitar totalmente use o botão de confirmar na aba Financeiro.`);
      return;
    }
    registrarPagamentoParcial(parcialFinanceiro.id, v);
    setModalParcial(false);
    setParcialFinanceiro(null);
    setValorParcial('');
  }

  function handleEdit(item) {
    const financeiros = getFinanceiroByTransacao(item.id);
    navigation.navigate('Movimentações', {
      screen: 'NovaMovimentacao',
      params: { editItem: item, editFinanceiro: financeiros },
    });
  }

  function handleDelete(item) {
    Alert.alert(
      'Apagar Transação',
      `Apagar esta ${item.tipo.toLowerCase()} de ${formatBRL(item.valor_total)}?\n\nIsso reverterá o estoque e os lançamentos financeiros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => { deleteTransacao(item.id); carregar(); },
        },
      ]
    );
  }

  const lista = filtro === 'Todos' ? transacoes : transacoes.filter((t) => t.tipo === filtro);

  const totalCompras = transacoes.filter((t) => t.tipo === 'Compra').reduce((s, t) => s + t.valor_total, 0);
  const qtdCompras   = transacoes.filter((t) => t.tipo === 'Compra').length;
  const totalVendas  = transacoes.filter((t) => t.tipo === 'Venda').reduce((s, t) => s + t.valor_total, 0);
  const qtdVendas    = transacoes.filter((t) => t.tipo === 'Venda').length;
  const saldoLiquido = totalVendas - totalCompras;

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
        {item.valor_pendente > 0 && (
          <View style={styles.pagRow}>
            {item.valor_pago > 0 && (
              <Text style={styles.pagChipPago}>✓ Pago {formatBRL(item.valor_pago)}</Text>
            )}
            <Text style={styles.pagChipPendente}>⏳ Pendente {formatBRL(item.valor_pendente)}</Text>
          </View>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.btnRecibo} onPress={() => compartilharRecibo(item)}>
            <Text style={styles.btnReciboText}>📤 Recibo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEditar} onPress={() => handleEdit(item)}>
            <Text style={styles.btnEditarText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAntecipacao} onPress={() => abrirParcial(item)}>
            <Text style={styles.btnAntecipacaoText}>💸 Antecipar</Text>
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

        <View style={styles.header}>
          <Text style={styles.headerNome}>{parceiro.nome}</Text>
          {parceiro.telefone ? (
            <Text style={styles.headerTel}>📞 {parceiro.telefone}</Text>
          ) : null}
        </View>

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
      <Modal visible={modalParcial} animationType="slide" transparent onRequestClose={() => setModalParcial(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>💸 Pagamento Antecipado</Text>
                <TouchableOpacity onPress={() => setModalParcial(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {parcialFinanceiro && parcialTransacao && (
                <View style={styles.parcialInfo}>
                  <Text style={styles.parcialInfoLabel}>Valor total pendente</Text>
                  <Text style={styles.parcialInfoValor}>{formatBRL(parcialFinanceiro.valor_parcela)}</Text>
                  <Text style={styles.parcialInfoSub}>{parcialTransacao.nome_material} · {parcialTransacao.tipo}</Text>
                </View>
              )}
              <Text style={styles.parcialLabel}>Valor antecipado (R$)</Text>
              <TextInput
                style={styles.parcialInput}
                placeholder="0,00"
                keyboardType="decimal-pad"
                value={valorParcial}
                onChangeText={setValorParcial}
                autoFocus
              />
              {parcialFinanceiro && valorParcial ? (
                <View style={styles.parcialRestanteBox}>
                  <Text style={styles.parcialRestanteLabel}>Ficará pendente:</Text>
                  <Text style={styles.parcialRestanteValor}>
                    {formatBRL(Math.max(0, parcialFinanceiro.valor_parcela - (parseFloat(valorParcial.replace(',', '.')) || 0)))}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.btnSalvar} onPress={confirmarParcial}>
                <Text style={styles.btnSalvarText}>Confirmar Antecipação</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  header: { backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerNome: { fontSize: 20, fontWeight: '800', color: C.text },
  headerTel: { fontSize: 13, color: C.sub, marginTop: 4 },
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
  cardActions: { flexDirection: 'row', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, gap: 8 },
  pagRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  pagChipPago: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  pagChipPendente: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  btnRecibo: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnReciboText: { fontSize: 11, fontWeight: '600', color: C.primary },
  btnEditar: { flex: 1, backgroundColor: '#F0FDF4', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnEditarText: { fontSize: 11, fontWeight: '600', color: C.success },
  btnAntecipacao: { flex: 1, backgroundColor: '#FFFBEB', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnAntecipacaoText: { fontSize: 11, fontWeight: '600', color: '#D97706' },
  btnApagar: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnApagarText: { fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  modalClose: { fontSize: 18, color: C.sub, padding: 4 },
  parcialInfo: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  parcialInfoLabel: { fontSize: 11, color: C.sub, fontWeight: '600', textTransform: 'uppercase' },
  parcialInfoValor: { fontSize: 26, fontWeight: '900', color: C.text, marginTop: 2 },
  parcialInfoSub: { fontSize: 13, color: C.sub, marginTop: 4 },
  parcialLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 6, marginTop: 16 },
  parcialInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: C.text, backgroundColor: '#F8FAFC' },
  parcialRestanteBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#FDE68A' },
  parcialRestanteLabel: { fontSize: 13, color: '#D97706', fontWeight: '600' },
  parcialRestanteValor: { fontSize: 16, fontWeight: '800', color: '#D97706' },
  btnSalvar: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
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
