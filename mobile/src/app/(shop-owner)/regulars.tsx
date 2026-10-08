import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '../../components/app-shell';
import { customerApi, regularApi } from '../../services/api';
import { soundbox } from '../../services/soundbox';
import { formatMoney, todayInput } from '../../lib/format';
import { body, card, heading, subtle } from '../../lib/ui';

export default function RegularsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [todayStr, setTodayStr] = useState(todayInput());
  const [error, setError] = useState<string | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Item Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [itemName, setItemName] = useState('Full Cream Milk');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pkt');
  const [unitPrice, setUnitPrice] = useState('32');
  const [savingNewItem, setSavingNewItem] = useState(false);

  const load = async () => {
    try {
      const [regRes, custRes] = await Promise.all([
        regularApi.getAll(),
        customerApi.getAll({ limit: 100 }),
      ]);
      if (regRes.success) {
        setItems(regRes.items || []);
        setTodayStr(regRes.today || todayInput());
        // Default select items not yet logged today
        const unlogged = (regRes.items || [])
          .filter((it: any) => it.lastLoggedDate !== regRes.today)
          .map((it: any) => it._id);
        setSelectedIds(unlogged);
      }
      if (custRes.success) {
        setCustomers(custRes.customers || []);
        if (custRes.customers?.length > 0 && !selectedCustId) {
          setSelectedCustId(custRes.customers[0]._id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Could not load regulars');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((it) => it._id));
    }
  };

  const handleBatchRecord = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one regular item.');
      return;
    }
    setSavingBatch(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await regularApi.batchRecord(selectedIds, todayStr);
      if (res.success) {
        setSuccessMsg(`✓ Logged ${res.recordedCount} daily purchases in 1 click!`);
        soundbox.speakAnnouncement(`Logged ${res.recordedCount} daily regular deliveries.`);
        await load();
      }
    } catch (err: any) {
      setError(err.message || 'Could not batch record regulars');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleCreateRegular = async () => {
    if (!selectedCustId || !itemName.trim() || !unitPrice) {
      setError('Please fill in customer, item, and price.');
      return;
    }
    setSavingNewItem(true);
    try {
      await regularApi.addItem({
        customerId: selectedCustId,
        itemName: itemName.trim(),
        quantity: Number(quantity) || 1,
        unit,
        unitPrice: Number(unitPrice),
      });
      setAddModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add regular item');
    } finally {
      setSavingNewItem(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await regularApi.removeItem(id);
      await load();
    } catch {}
  };

  return (
    <AppShell>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-2xl bg-emerald-500/20 items-center justify-center">
            <Ionicons name="cart-outline" size={22} color="#10b981" />
          </View>
          <View>
            <Text className={`text-2xl font-black ${heading}`}>Daily Regulars</Text>
            <Text className="text-slate-500 text-xs">Morning Milk & Water Quick-Tally</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setAddModalOpen(true)}
          className="bg-emerald-600 rounded-xl px-3.5 h-10 flex-row items-center gap-1.5 shadow"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-bold text-xs">Add Regular</Text>
        </TouchableOpacity>
      </View>

      {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}
      {successMsg && <Text className="text-emerald-600 font-bold text-xs mb-3">{successMsg}</Text>}

      {loading ? (
        <ActivityIndicator color="#10b981" className="my-8" />
      ) : items.length === 0 ? (
        <View className={`rounded-3xl p-8 items-center justify-center ${card}`}>
          <Ionicons name="nutrition-outline" size={48} color="#94a3b8" />
          <Text className="text-slate-800 dark:text-slate-200 font-bold text-base mt-3">
            No Daily Regulars Configured
          </Text>
          <Text className="text-slate-500 text-xs text-center mt-1 max-w-xs">
            Add regular customers who take daily milk, water cans, or bread to record their entries in 1 tap every morning!
          </Text>
          <TouchableOpacity
            onPress={() => setAddModalOpen(true)}
            className="bg-emerald-600 rounded-xl px-4 py-2.5 mt-4"
          >
            <Text className="text-white font-bold text-sm">+ Add First Regular</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Action Bar */}
          <View className="flex-row items-center justify-between mb-3 bg-slate-100 dark:bg-slate-900 p-3 rounded-2xl">
            <TouchableOpacity onPress={toggleSelectAll} className="flex-row items-center gap-2">
              <View
                className={`w-5 h-5 rounded-md border items-center justify-center ${
                  selectedIds.length === items.length
                    ? 'bg-emerald-600 border-emerald-600'
                    : 'border-slate-400 dark:border-white/30'
                }`}
              >
                {selectedIds.length === items.length && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {selectedIds.length === items.length ? 'Deselect All' : 'Select All'} ({selectedIds.length}/{items.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBatchRecord}
              disabled={savingBatch || selectedIds.length === 0}
              className="bg-emerald-600 rounded-xl px-4 h-9 flex-row items-center gap-1.5 shadow"
            >
              {savingBatch ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={14} color="#fff" />
                  <Text className="text-white font-black text-xs">
                    Record ({selectedIds.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* List of items */}
          {items.map((item) => {
            const isSelected = selectedIds.includes(item._id);
            const isLoggedToday = item.lastLoggedDate === todayStr;

            return (
              <TouchableOpacity
                key={item._id}
                onPress={() => toggleSelect(item._id)}
                className={`flex-row items-center rounded-2xl p-4 mb-3 border ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-200 dark:border-white/10'
                } ${card}`}
              >
                {/* Checkbox */}
                <View
                  className={`w-6 h-6 rounded-lg border items-center justify-center mr-3 ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-slate-300 dark:border-white/20'
                  }`}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>

                {/* Customer and Item */}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className={`font-bold text-base ${heading}`}>
                      {item.customerName || item.customerId?.name}
                    </Text>
                    {isLoggedToday && (
                      <View className="bg-emerald-500/15 px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          ✓ Logged Today
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className={`${subtle} text-xs mt-0.5`}>
                    {item.quantity} {item.unit} {item.itemName} @ {formatMoney(item.unitPrice)}
                  </Text>
                </View>

                {/* Total Line Price */}
                <View className="items-end mr-2">
                  <Text className="text-slate-900 dark:text-white font-black text-base">
                    {formatMoney(item.quantity * item.unitPrice)}
                  </Text>
                </View>

                {/* Delete button */}
                <TouchableOpacity
                  onPress={() => handleRemove(item._id)}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Add New Regular Modal */}
      {addModalOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6">
            <Text className="text-xl font-black text-slate-900 dark:text-white mb-3">
              Add Regular Customer Item
            </Text>

            <Text className="text-xs font-bold text-slate-500 mb-1">SELECT CUSTOMER</Text>
            <ScrollView className="max-h-28 mb-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-white/10">
              {customers.map((c) => (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setSelectedCustId(c._id)}
                  className={`p-2 rounded-lg mb-1 ${
                    selectedCustId === c._id ? 'bg-emerald-600' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      selectedCustId === c._id ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {c.name} ({c.email})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-xs font-bold text-slate-500 mb-1">ITEM NAME</Text>
            <TextInput
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Milk 500ml"
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-11 text-slate-900 dark:text-white mb-2"
            />

            <View className="flex-row gap-2 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-500 mb-1">QTY</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-11 text-slate-900 dark:text-white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-500 mb-1">PRICE (₹)</Text>
                <TextInput
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="decimal-pad"
                  placeholder="32"
                  placeholderTextColor="#94a3b8"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-11 text-slate-900 dark:text-white"
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setAddModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-white/15 items-center justify-center"
              >
                <Text className="font-bold text-slate-700 dark:text-slate-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateRegular}
                disabled={savingNewItem}
                className="flex-1 h-11 rounded-xl bg-emerald-600 items-center justify-center"
              >
                {savingNewItem ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Save Regular</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}
