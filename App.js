import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    try {
      initDatabase();
      setPronto(true);
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  if (erro) {
    return (
      <View style={styles.center}>
        <Text style={styles.erroText}>Erro ao inicializar: {erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B4FD8" />
        <Text style={styles.loadingText}>CalcadosPro</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4FF' },
  loadingText: { marginTop: 16, fontSize: 20, fontWeight: '800', color: '#1B4FD8' },
  erroText: { color: '#DC2626', fontSize: 14, textAlign: 'center', padding: 20 },
});
