import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getResumoFinanceiro, getChequesVencendo, compensarCheque, depositarCheque } from '../database/financial';
import { exportarBackup, importarBackup } from '../database/backup';
import { formatBRL, formatDate } from '../utils/format';

const C = {
  primary: '#1B4FD8',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
  bg: '#F0F4FF',
  card: '#FFFFFF',
  text: '#1E293B',
  sub: '#64748B',
};

function StatCard({ label, value, color, emoji }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [resumo, setResumo] = useState({ saldo: 0, aReceber: 0, aPagar: 0, vencidosHoje: 0, chequesEmCompensacao: 0 });
  const [chequesHoje, setChequesHoje] = useState([]);
  const [loadingBackup, setLoadingBackup] = useState(false);

  const carregar = useCallback(() => {
    try {
      setResumo(getResumoFinanceiro());
      setChequesHoje(getChequesVencendo());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(carregar);

  function handleAcaoCheque(cheque) {
    if (cheque.status === 'Pendente') {
      Alert.alert(
        'Depositar Cheque',
        `Confirmar depósito do cheque de ${formatBRL(cheque.valor_parcela)} de ${cheque.parceiro_nome}?\n\nO saldo será atualizado após confirmar a compensação.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sim, depositei', onPress: () => { depositarCheque(cheque.id); carregar(); } },
        ]
      );
    } else {
      Alert.alert(
        'Confirmar Compensação',
        `O banco compensou o cheque de ${formatBRL(cheque.valor_parcela)} de ${cheque.parceiro_nome}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => { compensarCheque(cheque.id); carregar(); } },
        ]
      );
    }
  }

  async function handleExportar() {
    setLoadingBackup(true);
    try {
      await exportarBackup();
    } catch (e) {
      Alert.alert('Erro ao exportar', e.message);
    } finally {
      setLoadingBackup(false);
    }
  }

  async function handleImportar() {
    Alert.alert(
      'Importar Backup',
      'Isso substituirá TODOS os dados atuais pelos dados do backup. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          style: 'destructive',
          onPress: async () => {
            setLoadingBackup(true);
            try {
              const ok = await importarBackup();
              if (ok) {
                carregar();
                Alert.alert('Sucesso!', 'Dados restaurados com sucesso.');
              }
            } catch (e) {
              Alert.alert('Erro ao importar', e.message);
            } finally {
              setLoadingBackup(false);
            }
          },
        },
      ]
    );
  }

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CalcadosPro</Text>
          <Text style={styles.headerDate}>{hoje}</Text>
        </View>

        {chequesHoje.length > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>📅 Cheques vencendo hoje!</Text>
            {chequesHoje.map((c) => (
              <View key={c.id} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertName}>{c.parceiro_nome}</Text>
                  <Text style={styles.alertInfo}>
                    {c.tipo_fluxo === 'Entrada' ? '↗ A Receber' : '↙ A Pagar'} · {formatDate(c.data_vencimento)}
                    {c.total_parcelas > 1 ? ` · Parcela ${c.parcela_num}/${c.total_parcelas}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.alertValue, { color: c.tipo_fluxo === 'Entrada' ? C.success : C.danger }]}>
                    {formatBRL(c.valor_parcela)}
                  </Text>
                  <TouchableOpacity style={[styles.btnCompensar, { backgroundColor: c.status === 'Depositado' ? C.success : C.primary }]} onPress={() => handleAcaoCheque(c)}>
                    <Text style={styles.btnCompensarText}>{c.status === 'Depositado' ? 'Compensou?' : 'Depositei'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Resumo Financeiro</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Saldo em Caixa" value={formatBRL(resumo.saldo)} color={resumo.saldo >= 0 ? C.success : C.danger} emoji="💵" />
          <StatCard label="A Receber" value={formatBRL(resumo.aReceber)} color={C.primary} emoji="📥" />
          <StatCard label="A Pagar" value={formatBRL(resumo.aPagar)} color={C.warning} emoji="📤" />
          <StatCard label="Venc. em Atraso" value={`${resumo.vencidosHoje} título(s)`} color={resumo.vencidosHoje > 0 ? C.danger : C.sub} emoji="⏰" />
        </View>

        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Nova Compra', emoji: '🛒', tab: 'Movimentações', screen: 'NovaMovimentacao', params: { tipo: 'Compra' } },
            { label: 'Nova Venda', emoji: '🏷️', tab: 'Movimentações', screen: 'NovaMovimentacao', params: { tipo: 'Venda' } },
            { label: 'Ver Estoque', emoji: '📦', tab: 'Estoque' },
            { label: 'Ver Financeiro', emoji: '💰', tab: 'Financeiro' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickCard}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.tab, { screen: item.screen, params: item.params });
                } else {
                  navigation.navigate(item.tab);
                }
              }}
            >
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Dados e Backup</Text>
        <View style={styles.backupBox}>
          <Text style={styles.backupDesc}>
            Exporte seus dados para salvar no Google Drive, WhatsApp ou e-mail. Importe para restaurar em um novo celular.
          </Text>
          {loadingBackup ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.backupBtns}>
              <TouchableOpacity style={[styles.backupBtn, { backgroundColor: C.primary }]} onPress={handleExportar}>
                <Text style={styles.backupBtnEmoji}>📤</Text>
                <Text style={styles.backupBtnText}>Exportar Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.backupBtn, { backgroundColor: C.success }]} onPress={handleImportar}>
                <Text style={styles.backupBtnEmoji}>📥</Text>
                <Text style={styles.backupBtnText}>Importar Backup</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 20, paddingTop: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: C.primary },
  headerDate: { fontSize: 13, color: C.sub, marginTop: 2, textTransform: 'capitalize' },
  alertBox: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  alertTitle: { fontSize: 15, fontWeight: '700', color: C.warning, marginBottom: 10 },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  alertName: { fontSize: 14, fontWeight: '600', color: C.text },
  alertInfo: { fontSize: 12, color: C.sub, marginTop: 2 },
  alertValue: { fontSize: 15, fontWeight: '700' },
  btnCompensar: { backgroundColor: C.success, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  btnCompensarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, width: '47%', borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statEmoji: { fontSize: 20, marginBottom: 6 },
  statLabel: { fontSize: 11, color: C.sub, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, width: '47%', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  quickEmoji: { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'center' },
  backupBox: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  backupDesc: { fontSize: 13, color: C.sub, lineHeight: 20, marginBottom: 4 },
  backupBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  backupBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  backupBtnEmoji: { fontSize: 22, marginBottom: 4 },
  backupBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
