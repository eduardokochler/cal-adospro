import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllFinanceiro, compensarCheque, depositarCheque,
  confirmarPagamento, lancamentoAvulso, getResumoFinanceiro,
  deleteFinanceiroAvulso, registrarPagamentoParcial,
} from '../../database/financial';
import { deleteTransacao, getFinanceiroByTransacao, getTransacaoById } from '../../database/transactions';
import { formatBRL, formatDate, todayISO } from '../../utils/format';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', warning: '#D97706', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

const FILTROS = ['Todos', 'Pendente', 'Depositado', 'Compensado'];
const FORMAS = ['PIX', 'Dinheiro', 'Cheque'];

function StatusBadge({ status, vencimento }) {
  const hoje = todayISO();
  const vencido = status === 'Pendente' && vencimento && vencimento < hoje;
  const venceHoje = status === 'Pendente' && vencimento === hoje;
  if (status === 'Compensado') return <View style={[styles.statusBadge, { backgroundColor: '#F0FDF4' }]}><Text style={[styles.statusText, { color: C.success }]}>✓ Compensado</Text></View>;
  if (status === 'Depositado') return <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF' }]}><Text style={[styles.statusText, { color: C.primary }]}>🏦 Depositado</Text></View>;
  if (vencido) return <View style={[styles.statusBadge, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.statusText, { color: C.danger }]}>⚠ Vencido</Text></View>;
  if (venceHoje) return <View style={[styles.statusBadge, { backgroundColor: '#FFFBEB' }]}><Text style={[styles.statusText, { color: C.warning }]}>🔔 Hoje</Text></View>;
  return <View style={[styles.statusBadge, { backgroundColor: '#F8FAFC' }]}><Text style={[styles.statusText, { color: C.sub }]}>⏳ Pendente</Text></View>;
}

const AVULSO_EMPTY = { tipo: 'Entrada', descricao: '', valor: '', forma: 'PIX', venc: '', aPrazo: false };

export default function FinancialScreen({ navigation }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [resumo, setResumo] = useState({ saldo: 0, aReceber: 0, aPagar: 0, vencidosHoje: 0, chequesEmCompensacao: 0 });
  const [filtro, setFiltro] = useState('Todos');
  const [modal, setModal] = useState(false);
  const [avulso, setAvulso] = useState(AVULSO_EMPTY);
  const [modalParcial, setModalParcial] = useState(false);
  const [parcialItem, setParcialItem] = useState(null);
  const [valorParcial, setValorParcial] = useState('');

  const carregar = useCallback(() => {
    setLancamentos(getAllFinanceiro());
    setResumo(getResumoFinanceiro());
  }, []);

  useFocusEffect(carregar);

  const lista = filtro === 'Todos' ? lancamentos : lancamentos.filter((l) => l.status === filtro);

  function handleDepositar(item) {
    const acao = item.tipo_fluxo === 'Entrada' ? 'depositar este cheque' : 'confirmar entrega deste cheque';
    Alert.alert(
      'Depositar Cheque',
      `Confirmar que foi possível ${acao} de ${formatBRL(item.valor_parcela)}?\n\nO saldo só será atualizado após confirmar a compensação.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, depositei', onPress: () => { depositarCheque(item.id); carregar(); } },
      ]
    );
  }

  function handleCompensar(item) {
    Alert.alert(
      'Confirmar Compensação',
      `O banco confirmou a compensação de ${formatBRL(item.valor_parcela)}?\n\nIsso atualizará o saldo em caixa.${item.total_parcelas > 1 ? `\nParcela ${item.parcela_num}/${item.total_parcelas}` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => { compensarCheque(item.id); carregar(); } },
      ]
    );
  }

  function handleConfirmarPixDinheiro(item) {
    const acao = item.tipo_fluxo === 'Entrada' ? 'recebimento' : 'pagamento';
    Alert.alert(
      item.tipo_fluxo === 'Entrada' ? 'Confirmar Recebimento' : 'Confirmar Pagamento',
      `Confirmar ${acao} de ${formatBRL(item.valor_parcela)} via ${item.forma_pagto}?\n\nIsso atualizará o saldo em caixa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => { confirmarPagamento(item.id); carregar(); } },
      ]
    );
  }

  function abrirParcial(item) {
    setParcialItem(item);
    setValorParcial('');
    setModalParcial(true);
  }

  function confirmarParcial() {
    const v = parseFloat(valorParcial.replace(',', '.'));
    if (!v || v <= 0) { Alert.alert('Atenção', 'Informe um valor válido.'); return; }
    if (v >= parcialItem.valor_parcela) {
      Alert.alert('Atenção', `O valor deve ser menor que o total pendente (${formatBRL(parcialItem.valor_parcela)}).\n\nPara quitar totalmente, use o botão de confirmar recebimento.`);
      return;
    }
    registrarPagamentoParcial(parcialItem.id, v);
    setModalParcial(false);
    setParcialItem(null);
    setValorParcial('');
    carregar();
  }

  function handleEdit(item) {
    const transacao = getTransacaoById(item.transacao_id);
    if (!transacao) return;
    const financeiros = getFinanceiroByTransacao(item.transacao_id);
    navigation.navigate('Movimentações', {
      screen: 'NovaMovimentacao',
      params: { editItem: transacao, editFinanceiro: financeiros },
    });
  }

  function handleDelete(item) {
    if (item.transacao_id) {
      const tipo = item.transacao_tipo === 'Venda' ? 'venda' : 'compra';
      Alert.alert(
        'Apagar Transação',
        `Apagar esta ${tipo} de ${formatBRL(item.valor_parcela)}?\n\nTodos os lançamentos vinculados e o estoque serão revertidos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: () => { deleteTransacao(item.transacao_id); carregar(); } },
        ]
      );
    } else {
      Alert.alert(
        'Apagar Lançamento',
        `Apagar este lançamento de ${formatBRL(item.valor_parcela)}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: () => { deleteFinanceiroAvulso(item.id); carregar(); } },
        ]
      );
    }
  }

  function salvarAvulso() {
    const valor = parseFloat(avulso.valor.replace(',', '.'));
    if (!avulso.descricao.trim()) { Alert.alert('Atenção', 'Informe uma descrição.'); return; }
    if (!valor || valor <= 0) { Alert.alert('Atenção', 'Informe um valor válido.'); return; }
    const precisaVenc = avulso.forma === 'Cheque' || avulso.aPrazo;
    if (precisaVenc && !avulso.venc.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Atenção', 'Informe o vencimento no formato AAAA-MM-DD.'); return;
    }
    lancamentoAvulso({
      tipo_fluxo: avulso.tipo,
      descricao: avulso.descricao.trim(),
      valor,
      forma_pagto: avulso.forma,
      data_vencimento: precisaVenc ? avulso.venc : null,
      a_prazo: avulso.aPrazo,
    });
    setModal(false);
    setAvulso(AVULSO_EMPTY);
    carregar();
  }

  function set(field) {
    return (val) => setAvulso((prev) => ({ ...prev, [field]: val }));
  }

  function renderItem({ item }) {
    const isEntrada = item.tipo_fluxo === 'Entrada';
    const hoje = todayISO();
    const vencido = item.status === 'Pendente' && item.data_vencimento && item.data_vencimento < hoje;
    const nomeExibido = item.parceiro_nome || item.descricao || 'Lançamento';
    const isAvulso = !item.transacao_id;

    return (
      <View style={[styles.card, vencido && styles.cardVencido]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>
              {isEntrada ? '↗' : '↙'} {nomeExibido}
            </Text>
            <Text style={styles.cardSub}>
              {item.nome_material ? `${item.nome_material} · ` : ''}
              {item.forma_pagto}
              {item.total_parcelas > 1 ? ` · Parcela ${item.parcela_num}/${item.total_parcelas}` : ''}
            </Text>
            {item.data_vencimento && (
              <Text style={styles.cardData}>Venc: {formatDate(item.data_vencimento)}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cardValor, { color: isEntrada ? C.success : C.danger }]}>
              {isEntrada ? '+' : '-'}{formatBRL(item.valor_parcela)}
            </Text>
            <StatusBadge status={item.status} vencimento={item.data_vencimento} />
          </View>
        </View>

        {item.forma_pagto === 'Cheque' && item.status === 'Pendente' && (
          <TouchableOpacity style={[styles.btnCompensar, { backgroundColor: C.primary }]} onPress={() => handleDepositar(item)}>
            <Text style={styles.btnCompensarText}>{isEntrada ? '🏦 Depositar Cheque' : '🏦 Entregar Cheque'}</Text>
          </TouchableOpacity>
        )}
        {item.forma_pagto === 'Cheque' && item.status === 'Depositado' && (
          <TouchableOpacity style={[styles.btnCompensar, { backgroundColor: isEntrada ? C.success : C.danger }]} onPress={() => handleCompensar(item)}>
            <Text style={styles.btnCompensarText}>✓ Confirmar Compensação</Text>
          </TouchableOpacity>
        )}
        {(item.forma_pagto === 'PIX' || item.forma_pagto === 'Dinheiro') && item.status === 'Pendente' && (
          <TouchableOpacity style={[styles.btnCompensar, { backgroundColor: isEntrada ? C.success : C.danger }]} onPress={() => handleConfirmarPixDinheiro(item)}>
            <Text style={styles.btnCompensarText}>{isEntrada ? '✓ Confirmar Recebimento' : '✓ Confirmar Pagamento'}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardActions}>
          {!isAvulso && (
            <TouchableOpacity style={styles.btnEditar} onPress={() => handleEdit(item)}>
              <Text style={styles.btnEditarText}>✏️ Editar</Text>
            </TouchableOpacity>
          )}
          {item.status === 'Pendente' && (
            <TouchableOpacity style={styles.btnAntecipacao} onPress={() => abrirParcial(item)}>
              <Text style={styles.btnAntecipacaoText}>💸 Antecipar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnApagar} onPress={() => handleDelete(item)}>
            <Text style={styles.btnApagarText}>🗑️ Apagar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.saldoCard, { backgroundColor: resumo.saldo >= 0 ? C.success : C.danger }]}>
          <Text style={styles.saldoLabel}>Saldo em Caixa (PIX/Dinheiro)</Text>
          <Text style={styles.saldoValue}>{formatBRL(resumo.saldo)}</Text>
          <View style={styles.saldoRow}>
            <Text style={styles.saldoSub}>A receber: {formatBRL(resumo.aReceber)}</Text>
            <Text style={styles.saldoSub}>A pagar: {formatBRL(resumo.aPagar)}</Text>
          </View>
          {resumo.vencidosHoje > 0 && (
            <Text style={[styles.saldoSub, { marginTop: 6, textAlign: 'center' }]}>
              ⚠ {resumo.vencidosHoje} vencimento(s) em atraso ou hoje
            </Text>
          )}
          {resumo.chequesEmCompensacao > 0 && (
            <Text style={[styles.saldoSub, { marginTop: 4, textAlign: 'center' }]}>
              🏦 {resumo.chequesEmCompensacao} cheque(s) aguardando compensação
            </Text>
          )}
        </View>

        <View style={styles.filtros}>
          {FILTROS.map((f) => (
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
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💰</Text>
              <Text style={styles.emptyText}>Nenhum lançamento</Text>
              <Text style={styles.emptySub}>Os lançamentos aparecem ao registrar movimentações</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => setModal(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Modal pagamento antecipado */}
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
              {parcialItem && (
                <View style={styles.parcialInfo}>
                  <Text style={styles.parcialInfoLabel}>Valor total pendente</Text>
                  <Text style={styles.parcialInfoValor}>{formatBRL(parcialItem.valor_parcela)}</Text>
                  {parcialItem.parceiro_nome ? (
                    <Text style={styles.parcialInfoSub}>{parcialItem.parceiro_nome} · {parcialItem.forma_pagto}</Text>
                  ) : (
                    <Text style={styles.parcialInfoSub}>{parcialItem.descricao} · {parcialItem.forma_pagto}</Text>
                  )}
                </View>
              )}
              <Text style={styles.label}>Valor antecipado (R$)</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                keyboardType="decimal-pad"
                value={valorParcial}
                onChangeText={setValorParcial}
                autoFocus
              />
              {parcialItem && valorParcial ? (
                <View style={styles.parcialRestanteBox}>
                  <Text style={styles.parcialRestanteLabel}>Ficará pendente:</Text>
                  <Text style={styles.parcialRestanteValor}>
                    {formatBRL(Math.max(0, parcialItem.valor_parcela - (parseFloat(valorParcial.replace(',', '.')) || 0)))}
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

      {/* Modal lançamento avulso */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lançamento Avulso</Text>
                <TouchableOpacity onPress={() => { setModal(false); setAvulso(AVULSO_EMPTY); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.toggleRow}>
                {['Entrada', 'Saída'].map((t) => {
                  const val = t === 'Saída' ? 'Saida' : t;
                  const ativo = avulso.tipo === val;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.toggleBtn, ativo && { backgroundColor: val === 'Entrada' ? C.success : C.danger }]}
                      onPress={() => set('tipo')(val)}
                    >
                      <Text style={[styles.toggleText, ativo && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Frete, retirada, despesa..."
                value={avulso.descricao}
                onChangeText={set('descricao')}
              />

              <Text style={styles.label}>Valor (R$)</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                keyboardType="numeric"
                value={avulso.valor}
                onChangeText={set('valor')}
              />

              <Text style={styles.label}>Forma de Pagamento</Text>
              <View style={styles.toggleRow}>
                {FORMAS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.toggleBtn, avulso.forma === f && { backgroundColor: C.primary }]}
                    onPress={() => setAvulso((prev) => ({ ...prev, forma: f, aPrazo: false, venc: '' }))}
                  >
                    <Text style={[styles.toggleText, avulso.forma === f && { color: '#fff' }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(avulso.forma === 'PIX' || avulso.forma === 'Dinheiro') && (
                <>
                  <Text style={styles.label}>Quando receberá?</Text>
                  <View style={styles.toggleRow}>
                    {['À Vista', 'A Prazo'].map((op) => {
                      const isAVista = op === 'À Vista';
                      const ativo = isAVista ? !avulso.aPrazo : avulso.aPrazo;
                      return (
                        <TouchableOpacity
                          key={op}
                          style={[styles.toggleBtn, ativo && { backgroundColor: C.primary }]}
                          onPress={() => set('aPrazo')(!isAVista)}
                        >
                          <Text style={[styles.toggleText, ativo && { color: '#fff' }]}>{op}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {avulso.aPrazo && (avulso.forma === 'PIX' || avulso.forma === 'Dinheiro') && (
                <>
                  <Text style={styles.label}>Data Prevista (AAAA-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2025-12-31"
                    value={avulso.venc}
                    onChangeText={set('venc')}
                    maxLength={10}
                  />
                  <Text style={styles.labelHint}>O saldo será atualizado ao confirmar o recebimento.</Text>
                </>
              )}

              {avulso.forma === 'Cheque' && (
                <>
                  <Text style={styles.label}>Vencimento (AAAA-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2025-12-31"
                    value={avulso.venc}
                    onChangeText={set('venc')}
                    maxLength={10}
                  />
                  <Text style={styles.labelHint}>O saldo será atualizado ao confirmar a compensação.</Text>
                </>
              )}

              <TouchableOpacity style={styles.btnSalvar} onPress={salvarAvulso}>
                <Text style={styles.btnSalvarText}>Salvar Lançamento</Text>
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
  saldoCard: { padding: 20, margin: 12, borderRadius: 16 },
  saldoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase' },
  saldoValue: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 4 },
  saldoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  saldoSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  filtros: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexWrap: 'wrap' },
  filtroBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filtroBtnActive: { backgroundColor: C.primary },
  filtroText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filtroTextActive: { color: '#fff' },
  card: { backgroundColor: C.card, marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardVencido: { borderWidth: 1, borderColor: '#FECACA' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardName: { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  cardData: { fontSize: 12, color: C.sub, marginTop: 2, fontWeight: '600' },
  cardValor: { fontSize: 16, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  btnCompensar: { borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  btnCompensarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardActions: { flexDirection: 'row', marginTop: 8, gap: 8 },
  btnEditar: { flex: 1, backgroundColor: '#F0FDF4', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnEditarText: { fontSize: 12, fontWeight: '600', color: C.success },
  btnAntecipacao: { flex: 1, backgroundColor: '#FFFBEB', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnAntecipacaoText: { fontSize: 12, fontWeight: '600', color: C.warning },
  btnApagar: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  btnApagarText: { fontSize: 12, fontWeight: '600', color: C.danger },
  parcialInfo: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  parcialInfoLabel: { fontSize: 11, color: C.sub, fontWeight: '600', textTransform: 'uppercase' },
  parcialInfoValor: { fontSize: 26, fontWeight: '900', color: C.text, marginTop: 2 },
  parcialInfoSub: { fontSize: 13, color: C.sub, marginTop: 4 },
  parcialRestanteBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#FDE68A' },
  parcialRestanteLabel: { fontSize: 13, color: C.warning, fontWeight: '600' },
  parcialRestanteValor: { fontSize: 16, fontWeight: '800', color: C.warning },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  modalClose: { fontSize: 18, color: C.sub, padding: 4 },
  label: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 6, marginTop: 16 },
  labelHint: { fontSize: 12, color: C.sub, marginTop: 4, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: C.text, backgroundColor: '#F8FAFC' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '700', color: C.sub },
  btnSalvar: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
