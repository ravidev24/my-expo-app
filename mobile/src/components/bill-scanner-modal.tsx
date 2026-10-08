import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ocrApi } from '../services/api';
import { formatMoney } from '../lib/format';

interface BillScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onItemsExtracted: (items: Array<{ name: string; quantity: number; unit: string; unitPrice: number; amount: number }>) => void;
}

export function BillScannerModal({ visible, onClose, onItemsExtracted }: BillScannerModalProps) {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sampleBills = [
    {
      title: 'Paper Grocery Chit',
      text: `Basmati Rice 5kg 90
Cooking Oil 2L 150 = 300
Toor Dal 1kg 135
Soap Bars 4pcs 35`,
    },
    {
      title: 'Provisions List',
      text: `1. Atta 10kg Rs. 420
2. Sugar 3kg @ 45 = 135
3. Coconut 2pcs 35 = 70`,
    },
  ];

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || rawText;
    if (!text.trim()) {
      setError('Please enter or paste handwritten bill / chit text.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await ocrApi.parseBill({ rawText: text });
      if (res.success && res.items && res.items.length > 0) {
        setExtractedItems(res.items);
      } else {
        setError('Could not detect item names and prices. Try formatting as "Item Qty Price"');
      }
    } catch (err: any) {
      setError(err.message || 'OCR parsing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (extractedItems.length > 0) {
      onItemsExtracted(extractedItems);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} className="bg-black/75">
        <View className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-full bg-emerald-500/20 items-center justify-center">
                <Ionicons name="document-text-outline" size={20} color="#10b981" />
              </View>
              <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                AI Bill / Paper Slip Scanner
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text className="text-slate-600 dark:text-slate-300 text-xs mb-3">
            Paste text from your paper chit, scan photo OCR, or pick a sample to auto-extract items and prices without typing!
          </Text>

          {/* Sample quick picks */}
          <View className="flex-row gap-2 mb-3">
            {sampleBills.map((sample, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setRawText(sample.text);
                  handleParse(sample.text);
                }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 items-center"
              >
                <Text className="text-slate-800 dark:text-slate-200 text-xs font-bold">
                  📋 {sample.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Text Input */}
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={`Enter bill items...\ne.g.\nBasmati Rice 5kg 90\nSugar 2kg 45\nOil 1L 140`}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/10 rounded-2xl p-3 text-slate-900 dark:text-white text-sm min-h-[90px] mb-3"
          />

          <TouchableOpacity
            onPress={() => handleParse()}
            disabled={loading}
            className="bg-emerald-600 rounded-xl h-11 flex-row items-center justify-center gap-2 mb-3 shadow"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text className="text-white font-bold text-sm">Extract Line Items</Text>
              </>
            )}
          </TouchableOpacity>

          {error && <Text className="text-red-600 dark:text-red-400 text-xs mb-3">{error}</Text>}

          {/* Extracted Items List */}
          {extractedItems.length > 0 && (
            <View className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-2xl p-3 mb-4">
              <Text className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 uppercase mb-2">
                ✓ Extracted {extractedItems.length} Item(s):
              </Text>
              {extractedItems.map((item, idx) => (
                <View
                  key={idx}
                  className="flex-row justify-between py-1.5 border-b border-slate-200 dark:border-white/10"
                >
                  <Text className="text-slate-800 dark:text-slate-200 text-sm font-semibold">
                    {item.name} ({item.quantity} {item.unit} @ ₹{item.unitPrice})
                  </Text>
                  <Text className="text-slate-900 dark:text-white font-extrabold text-sm">
                    {formatMoney(item.amount)}
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleApply}
                className="bg-emerald-700 rounded-xl h-11 items-center justify-center mt-3"
              >
                <Text className="text-white font-black text-sm">
                  Add All {extractedItems.length} Items to Purchase
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
