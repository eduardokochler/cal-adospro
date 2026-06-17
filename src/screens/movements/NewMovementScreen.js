import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Alert,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllMateriais } from '../../database/materials';
import { getAllParceiros } from '../../database/partners';
import { registrarCompra, registrarVenda, deleteTransacao } from '../../database/transactions';
import { formatBRL, formatKg } from '../../utils/format';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', warning: '#D97706', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B', border: '#CBD5E1' };

function SelectModal({ visible, title, data, onSelect, onClose, labelKey = 'nome' }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalBox, { paddingBottom: 20 + insets.bottom }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.modalItemText}>{item[labelKey]}</Text>
                {item.quantidade_kg !== undefined && (
                  <Text style={styles.modalItemSub}>{formatKg(item.quantidade_kg)} disponível</Text>
                )}
                {item.tipo !== undefined && item.quantidade_kg === undefined && (
                  <Text style={styles.modalItemSub}>{item.tipo}</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhum cadastrado.</Text>}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function maskDate(val) {
  const nums = val.replace(/\D/g, '').slice(0, 8);
  if (nums.length <= 2) return nums;
  if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
  return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
}

function parseDateBR(str) {
  const parts = str.replace(/\D/g, '');
  if (parts.length < 8) return null;
  return `${parts.slice(4, 8)}-${parts.slice(2, 4)}-${parts.slice(0, 2)}`;
}

function formatYMDtoBR(str) {
  if (!str || str.length < 10) return '';
  return `${str.slice(8, 10)}/${str.slice(5, 7)}/${str.slice(0, 4)}`;
}

function buildFromFinanceiro(financeiros) {
  const formas = { PIX: false, Dinheiro: false, Cheque: false };
  const config = defaultConfig();
  const grouped = {};
  for (const f of financeiros) {
    if (!grouped[f.forma_pagto]) grouped[f.forma_pagto] = [];
    grouped[f.forma_pagto].push(f);
  }
  for (const forma of ['PIX', 'Dinheiro']) {
    if (grouped[forma]) {
      formas[forma] = true;
      const f = grouped[forma][0];
      config[forma] = {
        valor: String(f.valor_parcela),
        aPrazo: f.status === 'Pendente',
        dataPrazo: f.status === 'Pendente' ? formatYMDtoBR(f.data_vencimento) : '',
      };
    }
  }
  if (grouped['Cheque']) {
    formas.Cheque = true;
    const cheques = grouped['Cheque'];
    config.Cheque = {
      valor: String(cheques.reduce((s, c) => s + c.valor_parcela, 0)),
      entradas: cheques.map(c => ({ valor: String(c.valor_parcela), data: formatYMDtoBR(c.data_vencimento) })),
    };
  }
  return { formas, config };
}

function ChequeEntradas({ entradas, onChange }) {
  function atualizar(idx, campo, val) {
    const novo = [...entradas];
    if (campo === 'data') val = maskDate(val);
    novo[idx] = { ...novo[idx], [campo]: val };
    onChange(novo);
  }
  function remover(idx) {
    onChange(entradas.filter((_, i) => i !== idx));
  }
  function adicionar() {
    onChange([...entradas, { valor: '', data: '' }]);
  }
  return (
    <View>
      {entradas.map((p, idx) => (
        <View key={idx} style={styles.parcelaRow}>
          <Text style={styles.parcelaNum}>{idx + 1}</Text>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.parcelaInput}
              value={p.valor}
              onChangeText={(v) => atualizar(idx, 'valor', v)}
              placeholder="Valor R$"
              placeholderTextColor={C.sub}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextInput
              style={styles.parcelaInput}
              value={p.data}
              onChangeText={(v) => atualizar(idx, 'data', v)}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={C.sub}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          {entradas.length > 1 && (
            <TouchableOpacity style={styles.btnRemover} onPress={() => remover(idx)}>
              <Text style={styles.btnRemoverText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.btnAddParcela} onPress={adicionar}>
        <Text style={styles.btnAddParcelaText}>+ Adicionar cheque</Text>
      </TouchableOpacity>
    </View>
  );
}

const defaultConfig = () => ({
  PIX: { valor: '', aPrazo: false, dataPrazo: '' },
  Dinheiro: { valor: '', aPrazo: false, dataPrazo: '' },
  Cheque: { valor: '', entradas: [{ valor: '', data: '' }] },
});

export default function NewMovementScreen({ route, navigation }) {
  const tipoInicial = route.params?.tipo || 'Compra';
  const editItem = route.params?.editItem || null;
  const editFinanceiro = route.params?.editFinanceiro || [];
  const isEditing = !!editItem;

  const [tipo, setTipo] = useState(editItem?.tipo || tipoInicial);
  const [parceiros, setParceiros] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [parceiro, setParceiro] = useState(null);
  const [material, setMaterial] = useState(null);
  const [pesoKg, setPesoKg] = useState('');
  const [valorKg, setValorKg] = useState('');
  const [formas, setFormas] = useState({ PIX: true, Dinheiro: false, Cheque: false });
  const [pagConfig, setPagConfig] = useState(defaultConfig());
  const [modalParceiro, setModalParceiro] = useState(false);
  const [modalMaterial, setModalMaterial] = useState(false);

  // Roda no mount e toda vez que editItem muda (nova edição ou nova transação)
  useEffect(() => {
    const allP = getAllParceiros();
    const allM = getAllMateriais();
    setParceiros(allP);
    setMateriais(allM);
    if (isEditing) {
      setTipo(editItem.tipo);
      setParceiro(allP.find(p => p.id === editItem.parceiro_id) || null);
      setMaterial(allM.find(m => m.id === editItem.material_id) || null);
      setPesoKg(String(editItem.peso_kg).replace('.', ','));
      setValorKg(String(editItem.valor_kg).replace('.', ','));
      const { formas: f, config: c } = buildFromFinanceiro(editFinanceiro);
      setFormas(f);
      setPagConfig(c);
    } else {
      setTipo(tipoInicial);
      setParceiro(null);
      setMaterial(null);
      setPesoKg('');
      setValorKg('');
      setFormas({ PIX: true, Dinheiro: false, Cheque: false });
      setPagConfig(defaultConfig());
    }
  }, [editItem?.id]); // eslint-disable-line

  // Só atualiza as listas ao ganhar foco — nunca toca no estado do form
  useFocusEffect(
    useCallback(() => {
      setMateriais(getAllMateriais());
      setParceiros(getAllParceiros());
    }, [])
  );

  // Material com estoque atualizado derivado da lista fresca
  const materialAtual = material ? materiais.find(m => m.id === material.id) || material : null;

  function onChangeTipo(novoTipo) {
    setTipo(novoTipo);
    if (!isEditing) {
      setParceiro(null);
      setMaterial(null);
      setFormas({ PIX: true, Dinheiro: false, Cheque: false });
      setPagConfig(defaultConfig());
    }
  }

  const peso = parseFloat(pesoKg.replace(',', '.')) || 0;
  const vkg = parseFloat(valorKg.replace(',', '.')) || 0;
  const valorTotal = peso * vkg;
  const estoqueInsuficiente = tipo === 'Venda' && materialAtual && peso > 0 && peso > materialAtual.quantidade_kg;

  const formasAtivas = ['PIX', 'Dinheiro', 'Cheque'].filter(f => formas[f]);
  const soloForma = formasAtivas.length === 1;

  function updateConfig(forma, field, value) {
    setPagConfig(prev => ({ ...prev, [forma]: { ...prev[forma], [field]: value } }));
  }

  const totalCoberto = soloForma
    ? valorTotal
    : formasAtivas.reduce((sum, f) => {
        if (f === 'Cheque') {
          return sum + pagConfig.Cheque.entradas.reduce((s, p) => s + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
        }
        return sum + (parseFloat(pagConfig[f].valor.replace(',', '.')) || 0);
      }, 0);

  const falta = valorTotal - totalCoberto;
  const coberturaOk = soloForma || totalCoberto >= valorTotal - 0.01;
  const coberturaExcede = !soloForma && totalCoberto > valorTotal + 0.01;

  function validar() {
    if (formasAtivas.length === 0) {
      Alert.alert('Atenção', 'Selecione ao menos uma forma de pagamento.'); return false;
    }

    for (const f of formasAtivas) {
      const cfg = pagConfig[f];

      if (!soloForma && f !== 'Cheque') {
        const v = parseFloat(cfg.valor.replace(',', '.')) || 0;
        if (v <= 0) { Alert.alert('Atenção', `Informe o valor pago em ${f}.`); return false; }
      }

      if (f === 'PIX' || f === 'Dinheiro') {
        if (cfg.aPrazo) {
          if (!cfg.dataPrazo || cfg.dataPrazo.length < 10 || !parseDateBR(cfg.dataPrazo)) {
            Alert.alert('Atenção', `Informe uma data válida para ${f} a prazo (DD/MM/AAAA).`); return false;
          }
        }
      }

      if (f === 'Cheque') {
        for (const p of cfg.entradas) {
          if (!p.valor || parseFloat(p.valor.replace(',', '.')) <= 0) {
            Alert.alert('Atenção', 'Informe o valor de todos os cheques.'); return false;
          }
          if (!p.data || p.data.length < 10 || !parseDateBR(p.data)) {
            Alert.alert('Atenção', 'Informe a data válida de todos os cheques (DD/MM/AAAA).'); return false;
          }
        }
        if (!soloForma) {
          const somaEntradas = cfg.entradas.reduce((s, p) => s + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
          const valorMultiForma = parseFloat(cfg.valor.replace(',', '.')) || 0;
          if (somaEntradas < valorMultiForma - 0.01) {
            Alert.alert('Atenção', `A soma dos cheques (${formatBRL(somaEntradas)}) é menor que o valor em Cheque (${formatBRL(valorMultiForma)}).`);
            return false;
          }
        }
      }
    }

    if (!coberturaOk) {
      Alert.alert('Atenção', `Faltam ${formatBRL(falta)} para cobrir o total da ${tipo.toLowerCase()}.`); return false;
    }

    return true;
  }

  function buildPagamentos() {
    return formasAtivas.map(f => {
      const cfg = pagConfig[f];

      if (f === 'Cheque') {
        const somaEntradas = cfg.entradas.reduce((s, p) => s + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
        return {
          forma: 'Cheque',
          valor: soloForma ? somaEntradas : (somaEntradas || parseFloat(cfg.valor.replace(',', '.')) || 0),
          parcelasCustom: cfg.entradas.map((p, i) => ({
            valor: parseFloat(p.valor.replace(',', '.')),
            data: parseDateBR(p.data),
            num: i + 1,
            total: cfg.entradas.length,
          })),
        };
      }

      return {
        forma: f,
        valor: soloForma ? valorTotal : (parseFloat(cfg.valor.replace(',', '.')) || 0),
        aPrazo: cfg.aPrazo,
        dataVencimento: cfg.aPrazo ? parseDateBR(cfg.dataPrazo) : null,
      };
    });
  }

  function salvar() {
    if (!parceiro) { Alert.alert('Atenção', `Selecione o ${tipo === 'Compra' ? 'fornecedor' : 'cliente'}.`); return; }
    if (!material) { Alert.alert('Atenção', 'Selecione o material.'); return; }
    if (peso <= 0) { Alert.alert('Atenção', 'Informe o peso em kg.'); return; }
    if (vkg <= 0) { Alert.alert('Atenção', 'Informe o valor por kg.'); return; }
    if (estoqueInsuficiente) {
      Alert.alert('⚠️ Estoque Insuficiente', `Você possui apenas ${formatKg(materialAtual?.quantidade_kg ?? 0)} de ${materialAtual?.nome_material} disponível.`);
      return;
    }
    if (!validar()) return;

    try {
      const params = {
        parceiro_id: parceiro.id,
        material_id: material.id,
        peso_kg: peso,
        valor_kg: vkg,
        pagamentos: buildPagamentos(),
      };

      if (isEditing) deleteTransacao(editItem.id);
      if (tipo === 'Compra') registrarCompra(params);
      else registrarVenda(params);

      if (isEditing) {
        navigation.goBack();
      } else {
        setParceiro(null);
        setMaterial(null);
        setPesoKg('');
        setValorKg('');
        setFormas({ PIX: true, Dinheiro: false, Cheque: false });
        setPagConfig(defaultConfig());
        Alert.alert('Sucesso!', `${tipo} registrada com sucesso.`);
      }
    } catch (e) {
      if (e.message?.startsWith('ESTOQUE_INSUFICIENTE')) {
        const disp = parseFloat(e.message.split(':')[1]);
        Alert.alert('⚠️ Estoque Insuficiente', `Você possui apenas ${formatKg(disp)} de ${material?.nome_material} disponível.`);
      } else {
        Alert.alert('Erro', e.message);
      }
    }
  }

  function renderPIXDinheiro(f) {
    const cfg = pagConfig[f];
    const emoji = f === 'PIX' ? '⚡' : '💵';
    return (
      <View style={styles.prazoBtnBox} key={f}>
        <Text style={styles.pagtoCardTitle}>{emoji} {f}</Text>
        {!soloForma && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.label}>Valor em {f} (R$)</Text>
            <TextInput
              style={styles.input}
              value={cfg.valor}
              onChangeText={(v) => updateConfig(f, 'valor', v)}
              placeholder="0,00"
              placeholderTextColor={C.sub}
              keyboardType="decimal-pad"
            />
          </View>
        )}
        <View style={styles.modoToggle}>
          <TouchableOpacity
            style={[styles.modoBtn, !cfg.aPrazo && styles.modoBtnActive]}
            onPress={() => updateConfig(f, 'aPrazo', false)}
          >
            <Text style={[styles.modoText, !cfg.aPrazo && styles.modoTextActive]}>À Vista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modoBtn, cfg.aPrazo && styles.modoBtnActive]}
            onPress={() => updateConfig(f, 'aPrazo', true)}
          >
            <Text style={[styles.modoText, cfg.aPrazo && styles.modoTextActive]}>A Prazo</Text>
          </TouchableOpacity>
        </View>
        {cfg.aPrazo && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Data Prevista</Text>
            <TextInput
              style={styles.input}
              value={cfg.dataPrazo}
              onChangeText={(v) => updateConfig(f, 'dataPrazo', maskDate(v))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={C.sub}
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              O saldo só é atualizado ao confirmar o recebimento.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          <View style={styles.field}>
            <Text style={styles.label}>Tipo de Movimentação</Text>
            <View style={styles.segmented}>
              {['Compra', 'Venda'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segBtn, tipo === t && (t === 'Compra' ? styles.segBtnCompra : styles.segBtnVenda)]}
                  onPress={() => onChangeTipo(t)}
                >
                  <Text style={[styles.segText, tipo === t && styles.segTextActive]}>
                    {t === 'Compra' ? '📥 Compra' : '📤 Venda'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{tipo === 'Compra' ? 'Fornecedor / Parceiro' : 'Cliente / Parceiro'}</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setModalParceiro(true)}>
              <Text style={parceiro ? styles.selectText : styles.selectPlaceholder}>
                {parceiro ? parceiro.nome : 'Selecionar parceiro...'}
              </Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Material</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setModalMaterial(true)}>
              <Text style={materialAtual ? styles.selectText : styles.selectPlaceholder}>
                {materialAtual ? `${materialAtual.nome_material} (${formatKg(materialAtual.quantidade_kg)})` : 'Selecionar material...'}
              </Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Peso (kg)</Text>
              <TextInput
                style={[styles.input, estoqueInsuficiente && styles.inputError]}
                value={pesoKg}
                onChangeText={setPesoKg}
                placeholder="0,00"
                placeholderTextColor={C.sub}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Valor por kg (R$)</Text>
              <TextInput
                style={styles.input}
                value={valorKg}
                onChangeText={setValorKg}
                placeholder="0,00"
                placeholderTextColor={C.sub}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {estoqueInsuficiente && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ Estoque insuficiente! Disponível: {formatKg(materialAtual?.quantidade_kg ?? 0)}</Text>
            </View>
          )}

          {valorTotal > 0 && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Valor Total</Text>
              <Text style={styles.totalValue}>{formatBRL(valorTotal)}</Text>
              <Text style={styles.totalCalc}>{formatKg(peso)} × {formatBRL(vkg)}/kg</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Forma de Pagamento</Text>
            <View style={styles.pagtoGrid}>
              {[
                { f: 'PIX', emoji: '⚡' },
                { f: 'Dinheiro', emoji: '💵' },
                { f: 'Cheque', emoji: '📝' },
              ].map(({ f, emoji }) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pagtoBtn, formas[f] && styles.pagtoBtnActive]}
                  onPress={() => setFormas(prev => ({ ...prev, [f]: !prev[f] }))}
                >
                  <Text style={styles.pagtoEmoji}>{emoji}</Text>
                  <Text style={[styles.pagtoText, formas[f] && styles.pagtoTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!soloForma && valorTotal > 0 && (
              <View style={[styles.coverageBox, coberturaOk ? styles.coverageOk : styles.coverageFalta]}>
                <Text style={styles.coverageText}>
                  Coberto: {formatBRL(totalCoberto)} / {formatBRL(valorTotal)}
                </Text>
                {!coberturaOk && <Text style={styles.coverageMsg}>Faltam {formatBRL(falta)}</Text>}
                {coberturaOk && !coberturaExcede && <Text style={styles.coverageMsgOk}>✓ Total coberto</Text>}
                {coberturaExcede && <Text style={styles.coverageMsgWarn}>Troco: {formatBRL(-falta)}</Text>}
              </View>
            )}
          </View>

          {formas.PIX && renderPIXDinheiro('PIX')}
          {formas.Dinheiro && renderPIXDinheiro('Dinheiro')}

          {formas.Cheque && (
            <View style={styles.chequeBox}>
              <Text style={styles.chequeTitle}>📝 Cheque</Text>
              {!soloForma && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>Valor total em Cheque (R$) — referência</Text>
                  <TextInput
                    style={styles.input}
                    value={pagConfig.Cheque.valor}
                    onChangeText={(v) => updateConfig('Cheque', 'valor', v)}
                    placeholder="0,00"
                    placeholderTextColor={C.sub}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
              <Text style={styles.label}>Cheques</Text>
              <ChequeEntradas
                entradas={pagConfig.Cheque.entradas}
                onChange={(novas) => updateConfig('Cheque', 'entradas', novas)}
              />
              {(() => {
                const soma = pagConfig.Cheque.entradas.reduce((s, p) => s + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
                const target = soloForma ? valorTotal : (parseFloat(pagConfig.Cheque.valor.replace(',', '.')) || 0);
                const restante = target - soma;
                const ok = soma >= target - 0.01;
                const excede = soma > target + 0.01;
                if (soma === 0 || target === 0) return null;
                return (
                  <View style={styles.totalLivreRow}>
                    <Text style={styles.totalLivreLabel}>Total cheques:</Text>
                    <Text style={[styles.totalLivreValor, { color: ok ? C.success : C.danger }]}>{formatBRL(soma)}</Text>
                    {!ok && <Text style={styles.totalLivreRestante}>Faltam {formatBRL(restante)}</Text>}
                    {ok && !excede && <Text style={{ color: C.success, fontSize: 13, fontWeight: '700' }}>✓ Ok</Text>}
                    {excede && <Text style={{ color: C.warning, fontSize: 13, fontWeight: '700' }}>Troco {formatBRL(-restante)}</Text>}
                  </View>
                );
              })()}
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnSalvar, estoqueInsuficiente && styles.btnDisabled]}
            onPress={salvar}
            disabled={estoqueInsuficiente}
          >
            <Text style={styles.btnSalvarText}>
              {isEditing ? '💾 Salvar Edição' : (tipo === 'Compra' ? '💾 Registrar Compra' : '💾 Registrar Venda')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal visible={modalParceiro} title="Selecionar Parceiro" data={parceiros} onSelect={setParceiro} onClose={() => setModalParceiro(false)} labelKey="nome" />
      <SelectModal visible={modalMaterial} title="Selecionar Material" data={materiais} onSelect={setMaterial} onClose={() => setModalMaterial(false)} labelKey="nome_material" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 15, color: C.text },
  inputError: { borderColor: C.danger },
  row: { flexDirection: 'row' },
  segmented: { flexDirection: 'row', gap: 10 },
  segBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segBtnCompra: { backgroundColor: '#EFF6FF', borderColor: C.primary },
  segBtnVenda: { backgroundColor: '#F0FDF4', borderColor: C.success },
  segText: { fontSize: 14, fontWeight: '600', color: C.sub },
  segTextActive: { color: C.text, fontWeight: '800' },
  selectBtn: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { fontSize: 15, color: C.text, fontWeight: '500' },
  selectPlaceholder: { fontSize: 15, color: C.sub },
  selectArrow: { fontSize: 12, color: C.sub },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: C.danger, fontSize: 13, fontWeight: '600' },
  totalBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  totalLabel: { fontSize: 12, fontWeight: '700', color: C.primary, textTransform: 'uppercase' },
  totalValue: { fontSize: 28, fontWeight: '800', color: C.primary, marginTop: 4 },
  totalCalc: { fontSize: 12, color: C.sub, marginTop: 4 },
  pagtoGrid: { flexDirection: 'row', gap: 8 },
  pagtoBtn: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  pagtoBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  pagtoEmoji: { fontSize: 20, marginBottom: 4 },
  pagtoText: { fontSize: 12, fontWeight: '700', color: C.sub },
  pagtoTextActive: { color: '#fff' },
  pagtoCardTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 },
  coverageBox: { marginTop: 10, borderRadius: 10, padding: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  coverageOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  coverageFalta: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  coverageText: { fontSize: 13, color: C.text, fontWeight: '600' },
  coverageMsg: { fontSize: 13, color: C.danger, fontWeight: '700' },
  coverageMsgOk: { fontSize: 13, color: C.success, fontWeight: '700' },
  coverageMsgWarn: { fontSize: 13, color: C.warning, fontWeight: '700' },
  prazoBtnBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  chequeBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  chequeTitle: { fontSize: 14, fontWeight: '700', color: C.warning, marginBottom: 12 },
  modoToggle: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, marginBottom: 14 },
  modoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modoBtnActive: { backgroundColor: C.warning },
  modoText: { fontSize: 13, fontWeight: '600', color: C.sub },
  modoTextActive: { color: '#fff' },
  parcelaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  parcelaNum: { fontSize: 13, fontWeight: '800', color: C.warning, width: 20, textAlign: 'center' },
  parcelaInput: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 14, color: C.text },
  btnRemover: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  btnRemoverText: { color: C.danger, fontSize: 14, fontWeight: '700' },
  totalLivreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  totalLivreLabel: { fontSize: 13, color: C.sub, fontWeight: '600' },
  totalLivreValor: { fontSize: 14, fontWeight: '800' },
  totalLivreRestante: { fontSize: 12, color: C.danger, fontWeight: '600' },
  btnAddParcela: { backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', padding: 10, alignItems: 'center', marginTop: 4 },
  btnAddParcelaText: { color: C.warning, fontWeight: '700', fontSize: 14 },
  btnSalvar: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#94A3B8' },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemText: { fontSize: 15, color: C.text, fontWeight: '500' },
  modalItemSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  modalEmpty: { fontSize: 14, color: C.sub, textAlign: 'center', paddingVertical: 20 },
});
