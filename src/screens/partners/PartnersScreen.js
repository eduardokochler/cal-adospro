import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllParceiros, deleteParceiro } from '../../database/partners';

const C = { primary: '#1B4FD8', success: '#16A34A', danger: '#DC2626', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', sub: '#64748B' };

export default function PartnersScreen({ navigation }) {
  const [parceiros, setParceiros] = useState([]);

  const carregar = useCallback(() => {
    setParceiros(getAllParceiros());
  }, []);

  useFocusEffect(carregar);

  function confirmarDelete(id, nome) {
    Alert.alert('Remover Parceiro', `Remover "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => { deleteParceiro(id); carregar(); } },
    ]);
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => confirmarDelete(item.id, item.nome)}
        onPress={() => navigation.navigate('DetalhesParceiro', { parceiro: item })}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.cardName}>{item.nome}</Text>
          {item.telefone ? <Text style={styles.cardPhone}>📞 {item.telefone}</Text> : null}
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <FlatList
          data={parceiros}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>Nenhum parceiro cadastrado</Text>
              <Text style={styles.emptySub}>Toque no + para adicionar</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddParceiro', {})}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.text },
  cardPhone: { fontSize: 12, color: C.sub, marginTop: 3 },
  cardArrow: { fontSize: 20, color: C.sub },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
