import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { addMaterial } from '../../database/materials';
import { getDb } from '../../database/db';
import { formatKg } from '../../utils/format';

const C = { primary: '#1B4FD8', success: '#16A34A', warning: '#D97706', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B', border: '#CBD5E1' };

const EXEMPLOS = ['PVC Injetado', 'TR Cristal', 'PU Expandido', 'EVA', 'Borracha', 'TPU', 'PP Reciclado'];

export default function AddMaterialScreen({ route, navigation }) {
  const editando = route.params?.material;
  const [nome, setNome] = useState(editando?.nome_material || '');
  const [estoqueInicial, setEstoqueInicial] = useState('');
  const [novoEstoque, setNovoEstoque] = useState('');

  function salvar() {
    const nomeTrimado = nome.trim();
    if (!nomeTrimado) {
      Alert.alert('Atenção', 'Informe o nome do material.');
      return;
    }
    try {
      if (editando) {
        getDb().runSync('UPDATE materiais SET nome_material = ? WHERE id = ?', [nomeTrimado, editando.id]);
      } else {
        const qtdInicial = parseFloat(estoqueInicial.replace(',', '.')) || 0;
        const res = addMaterial(nomeTrimado);
        if (qtdInicial > 0) {
          getDb().runSync('UPDATE materiais SET quantidade_kg = ? WHERE id = ?', [qtdInicial, res.lastInsertRowId]);
        }
      }
      navigation.goBack();
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        Alert.alert('Atenção', 'Já existe um material com esse nome.');
      } else {
        Alert.alert('Erro', e.message);
      }
    }
  }

  function ajustarEstoque() {
    const novo = parseFloat(novoEstoque.replace(',', '.'));
    if (isNaN(novo) || novo < 0) {
      Alert.alert('Atenção', 'Informe um valor válido em kg.');
      return;
    }
    Alert.alert(
      'Confirmar Ajuste',
      `Alterar estoque de ${formatKg(editando.quantidade_kg)} para ${formatKg(novo)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            getDb().runSync('UPDATE materiais SET quantidade_kg = ? WHERE id = ?', [novo, editando.id]);
            navigation.goBack();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

          <View style={styles.field}>
            <Text style={styles.label}>Nome do Termoplástico *</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: PVC Injetado"
              placeholderTextColor={C.sub}
              autoFocus={!editando}
            />
          </View>

          {!editando && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Estoque Inicial (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={estoqueInicial}
                  onChangeText={setEstoqueInicial}
                  placeholder="0,00 — deixe vazio para começar zerado"
                  placeholderTextColor={C.sub}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.hint}>Informe a quantidade que você já tem em estoque hoje.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Sugestões</Text>
                <View style={styles.chips}>
                  {EXEMPLOS.map((ex) => (
                    <TouchableOpacity key={ex} style={styles.chip} onPress={() => setNome(ex)}>
                      <Text style={styles.chipText}>{ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {editando && (
            <View style={styles.ajusteBox}>
              <Text style={styles.ajusteTitle}>📦 Ajuste de Estoque</Text>
              <Text style={styles.ajusteSub}>
                Estoque atual: <Text style={{ fontWeight: '800', color: C.text }}>{formatKg(editando.quantidade_kg)}</Text>
              </Text>
              <Text style={styles.label} style={{ fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 8, marginTop: 12, textTransform: 'uppercase' }}>
                Novo valor em kg
              </Text>
              <View style={styles.ajusteRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={novoEstoque}
                  onChangeText={setNovoEstoque}
                  placeholder={String(editando.quantidade_kg)}
                  placeholderTextColor={C.sub}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.btnAjuste} onPress={ajustarEstoque}>
                  <Text style={styles.btnAjusteText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ajusteAviso}>
                Use para corrigir o saldo sem gerar movimentação financeira (ex: inventário inicial, contagem física).
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
            <Text style={styles.btnSalvarText}>{editando ? 'Salvar Nome' : 'Cadastrar Material'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 15, color: C.text },
  hint: { fontSize: 12, color: C.sub, marginTop: 6, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  chipText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  ajusteBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  ajusteTitle: { fontSize: 15, fontWeight: '700', color: C.warning, marginBottom: 4 },
  ajusteSub: { fontSize: 14, color: C.sub },
  ajusteRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btnAjuste: { backgroundColor: C.warning, borderRadius: 10, padding: 14, paddingHorizontal: 18 },
  btnAjusteText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ajusteAviso: { fontSize: 12, color: C.sub, marginTop: 10, fontStyle: 'italic', lineHeight: 18 },
  btnSalvar: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
