import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import PartnersScreen from '../screens/partners/PartnersScreen';
import AddPartnerScreen from '../screens/partners/AddPartnerScreen';
import PartnerDetailScreen from '../screens/partners/PartnerDetailScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import AddMaterialScreen from '../screens/inventory/AddMaterialScreen';
import MovementsScreen from '../screens/movements/MovementsScreen';
import NewMovementScreen from '../screens/movements/NewMovementScreen';
import FinancialScreen from '../screens/financial/FinancialScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const COLORS = {
  primary: '#1B4FD8',
  bg: '#F0F4FF',
  tabActive: '#1B4FD8',
  tabInactive: '#94A3B8',
};

function TabIcon({ name, focused }) {
  const icons = {
    Home: focused ? '🏠' : '🏠',
    Parceiros: focused ? '👥' : '👥',
    Estoque: focused ? '📦' : '📦',
    Movimentações: focused ? '🔄' : '🔄',
    Financeiro: focused ? '💰' : '💰',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[name]}</Text>
    </View>
  );
}

function PartnersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
      <Stack.Screen name="ParceirosLista" component={PartnersScreen} options={{ title: 'Parceiros' }} />
      <Stack.Screen name="DetalhesParceiro" component={PartnerDetailScreen} options={({ route }) => ({ title: route.params?.parceiro?.nome || 'Detalhes' })} />
      <Stack.Screen name="AddParceiro" component={AddPartnerScreen} options={({ route }) => ({ title: route.params?.parceiro ? 'Editar Parceiro' : 'Novo Parceiro' })} />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
      <Stack.Screen name="EstoqueLista" component={InventoryScreen} options={{ title: 'Estoque' }} />
      <Stack.Screen name="AddMaterial" component={AddMaterialScreen} options={({ route }) => ({ title: route.params?.material ? 'Editar Material' : 'Novo Material' })} />
    </Stack.Navigator>
  );
}

function MovementsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
      <Stack.Screen name="MovimentacoesLista" component={MovementsScreen} options={{ title: 'Movimentações' }} />
      <Stack.Screen name="NovaMovimentacao" component={NewMovementScreen} options={{ title: 'Nova Movimentação' }} />
    </Stack.Navigator>
  );
}

function AppTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início', tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} /> }} />
      <Tab.Screen name="Parceiros" component={PartnersStack} options={{ tabBarIcon: ({ focused }) => <TabIcon name="Parceiros" focused={focused} /> }} />
      <Tab.Screen name="Estoque" component={InventoryStack} options={{ tabBarIcon: ({ focused }) => <TabIcon name="Estoque" focused={focused} /> }} />
      <Tab.Screen name="Movimentações" component={MovementsStack} options={{ tabBarIcon: ({ focused }) => <TabIcon name="Movimentações" focused={focused} /> }} />
      <Tab.Screen name="Financeiro" component={FinancialScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon name="Financeiro" focused={focused} />, headerShown: true, headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' }, title: 'Financeiro' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <AppTabs />
    </NavigationContainer>
  );
}
