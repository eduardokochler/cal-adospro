import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllMateriais, deleteMaterial } from '../../database/materials';
import { formatKg } from '../../utils/format';

const C = { primary: '#1B4FD8', success: '#16A34A', warning: '#D97706', danger: '#DC2626', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

function getEstoqueColor(kg) {
  if (kg <= 0) return C.danger;
  if (kg < 500) return C.warning;
  return C.success;
}

export default function InventoryScreen({ navigation }) {
  const [materiais, setMateriais] = useState([]);

  const carregar = useCallback(() => {
    setMateriais(getAllMateriais());
  }, []);

  useFocusEffect(carregar);

  const totalKg = materiais.reduce((s, m) => s + m.quantidade_kg, 0);

  function confirmarDelete(id, nome) {
    Alert.alert('Remover Material', `Remover "${nome}"? O histórico de transações será mantido.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => { deleteMaterial(id); carregar(); } },
    ]);
  }

  function renderItem({ item }) {
    const cor = getEstoqueColor(item.quantidade_kg);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AddMaterial', { material: item })}
        onLongPress={() => confirmarDelete(item.id, item.nome_material)}
      >
        <View style={[styles.indicator, { backgroundColor: cor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.nome_material}</Text>
          <Text style={styles.cardSub}>Toque para editar · Segure para remover</Text>
        </View>
        <Text style={[styles.cardKg, { color: cor }]}>{formatKg(item.quantidade_kg)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryLabel}>Total em estoque</Text>
          <Text style={styles.summaryValue}>{formatKg(totalKg)}</Text>
        </View>

        <FlatList
          data={materiais}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>Nenhum material cadastrado</Text>
              <Text style={styles.emptySub}>Toque no + para adicionar</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddMaterial', {})}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.primary, padding: 16 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, gap: 12 },
  indicator: { width: 6, height: 40, borderRadius: 3 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 11, color: C.sub, marginTop: 2 },
  cardKg: { fontSize: 16, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
