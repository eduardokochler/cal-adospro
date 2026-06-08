import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { addParceiro, updateParceiro } from '../../database/partners';

const C = { primary: '#1B4FD8', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B', border: '#CBD5E1' };

export default function AddPartnerScreen({ route, navigation }) {
  const editando = route.params?.parceiro;
  const [nome, setNome] = useState(editando?.nome || '');
  const [tipo, setTipo] = useState(editando?.tipo || 'Comprador');
  const [telefone, setTelefone] = useState(editando?.telefone || '');

  function salvar() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do parceiro.');
      return;
    }
    if (editando) {
      updateParceiro(editando.id, nome.trim(), tipo, telefone.trim());
    } else {
      addParceiro(nome.trim(), tipo, telefone.trim());
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

          <View style={styles.field}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Fábrica São Paulo"
              placeholderTextColor={C.sub}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.segmented}>
              {['Comprador', 'Vendedor'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segBtn, tipo === t && styles.segBtnActive]}
                  onPress={() => setTipo(t)}
                >
                  <Text style={[styles.segText, tipo === t && styles.segTextActive]}>
                    {t === 'Comprador' ? '🏭 Comprador' : '🏪 Vendedor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {tipo === 'Comprador' ? 'Fábricas de calçados que compram de você.' : 'Fornecedores que vendem matéria-prima para você.'}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(11) 99999-9999"
              placeholderTextColor={C.sub}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
            <Text style={styles.btnSalvarText}>{editando ? 'Salvar Alterações' : 'Cadastrar Parceiro'}</Text>
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
  segmented: { flexDirection: 'row', gap: 10 },
  segBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  segText: { fontSize: 14, fontWeight: '600', color: C.sub },
  segTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: C.sub, marginTop: 8, fontStyle: 'italic' },
  btnSalvar: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
