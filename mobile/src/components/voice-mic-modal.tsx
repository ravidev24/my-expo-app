import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseVoiceCommand, ParsedVoiceIntent, SpeechListener } from '../services/voiceParser';
import { customerApi, gallaApi, paymentApi, purchaseApi } from '../services/api';
import { soundbox } from '../services/soundbox';
import { formatMoney } from '../lib/format';

interface VoiceMicModalProps {
  visible: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export function VoiceMicModal({ visible, onClose, onActionComplete }: VoiceMicModalProps) {
  const [listener] = useState(() => new SpeechListener());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceIntent | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTranscript('');
      setManualText('');
      setParsed(null);
      setStatusMsg(null);
      setErrorMsg(null);
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [visible]);

  const startListening = () => {
    setErrorMsg(null);
    setStatusMsg('Listening... speak now');
    setIsListening(true);
    listener.start(
      (text, isFinal) => {
        setTranscript(text);
        const result = parseVoiceCommand(text);
        setParsed(result);
        if (isFinal) {
          setIsListening(false);
          setStatusMsg('Voice recognized!');
        }
      },
      (err) => {
        setIsListening(false);
        setStatusMsg(null);
        setErrorMsg('Microphone not recognized or permission denied. You can type below.');
      }
    );
  };

  const stopListening = () => {
    listener.stop();
    setIsListening(false);
  };

  const handleManualParse = (text: string) => {
    setManualText(text);
    setTranscript(text);
    const result = parseVoiceCommand(text);
    setParsed(result);
  };

  const executeAction = async () => {
    if (!parsed || parsed.type === 'unknown') return;
    setSaving(true);
    setErrorMsg(null);

    try {
      if (parsed.type === 'quick_sale') {
        await gallaApi.addQuickSale({
          amount: parsed.amount,
          note: parsed.note,
          source: 'voice',
        });
        soundbox.quickSale(parsed.amount, parsed.note);
        setStatusMsg(`✅ Recorded ₹${parsed.amount} cash sale!`);
      } else if (parsed.type === 'drawer_expense') {
        await gallaApi.addExpense({
          amount: parsed.amount,
          category: parsed.category,
          note: parsed.note,
        });
        soundbox.expensePaid(parsed.amount, parsed.category);
        setStatusMsg(`✅ Recorded ₹${parsed.amount} expense!`);
      } else if (parsed.type === 'customer_payment') {
        // Find matching customer
        const custRes = await customerApi.getAll({ search: parsed.customerName, limit: 1 });
        const customer = custRes.customers?.[0];
        if (!customer) {
          setErrorMsg(`Could not find customer named "${parsed.customerName}".`);
          setSaving(false);
          return;
        }
        await paymentApi.record({
          customerId: customer._id,
          amount: parsed.amount,
          paymentMethod: parsed.method || 'cash',
          notes: 'Voice logged payment',
        });
        soundbox.paymentReceived(parsed.amount, customer.name, parsed.method);
        setStatusMsg(`✅ Recorded ₹${parsed.amount} payment from ${customer.name}!`);
      } else if (parsed.type === 'customer_purchase') {
        // Find matching customer
        const custRes = await customerApi.getAll({ search: parsed.customerName, limit: 1 });
        const customer = custRes.customers?.[0];
        if (!customer) {
          setErrorMsg(`Could not find customer named "${parsed.customerName}".`);
          setSaving(false);
          return;
        }
        await purchaseApi.create({
          customerId: customer._id,
          items: [
            {
              name: parsed.itemName,
              quantity: parsed.quantity,
              unit: parsed.unit,
              unitPrice: parsed.unitPrice,
            },
          ],
          notes: 'Voice logged purchase',
        });
        soundbox.speakAnnouncement(`Recorded ${parsed.quantity} ${parsed.itemName} for ${customer.name}.`);
        setStatusMsg(`✅ Added ${parsed.itemName} (₹${parsed.amount}) for ${customer.name}!`);
      }

      if (onActionComplete) onActionComplete();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save voice entry.');
    } finally {
      setSaving(false);
    }
  };

  const sampleQueries = [
    '56 note on sale',
    '120 sale coconut and oil',
    'Suresh paid 200 rupees',
    'Tea expense 30',
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} className="bg-black/70">
        <View className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-full bg-emerald-500/20 items-center justify-center">
                <Ionicons name="mic" size={20} color="#10b981" />
              </View>
              <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                Voice Assistant
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Voice Wave / Mic Button */}
          <View className="items-center justify-center my-4">
            <TouchableOpacity
              onPress={isListening ? stopListening : startListening}
              className={`w-24 h-24 rounded-full items-center justify-center border-4 ${
                isListening
                  ? 'bg-red-500 border-red-300 animate-pulse shadow-lg'
                  : 'bg-emerald-600 border-emerald-400/50'
              }`}
            >
              <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={40} color="#fff" />
            </TouchableOpacity>
            <Text className="text-slate-600 dark:text-slate-300 text-sm font-semibold mt-3 text-center">
              {statusMsg || (isListening ? 'Listening... Speak clearly' : 'Tap mic to speak')}
            </Text>
          </View>

          {/* Transcript Display */}
          <View className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/10 rounded-2xl p-3 mb-3">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              SPOKEN PHRASE:
            </Text>
            <TextInput
              value={transcript || manualText}
              onChangeText={handleManualParse}
              placeholder="e.g. 56 note sale OR Suresh paid 200"
              placeholderTextColor="#94a3b8"
              className="text-base font-bold text-slate-900 dark:text-white"
            />
          </View>

          {/* Recognized Intent Card */}
          {parsed && parsed.type !== 'unknown' && (
            <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-black uppercase">
                  DETECTED ACTION
                </Text>
                <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  {Math.round(parsed.confidence * 100)}% Match
                </Text>
              </View>

              {parsed.type === 'quick_sale' && (
                <View>
                  <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                    💵 Quick Cash Sale: {formatMoney(parsed.amount)}
                  </Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                    Adds directly to today's Galla cash counter
                  </Text>
                </View>
              )}

              {parsed.type === 'drawer_expense' && (
                <View>
                  <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                    💸 Drawer Expense: {formatMoney(parsed.amount)}
                  </Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                    Category: {parsed.category} · {parsed.note}
                  </Text>
                </View>
              )}

              {parsed.type === 'customer_payment' && (
                <View>
                  <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                    💳 Payment: {formatMoney(parsed.amount)} from {parsed.customerName}
                  </Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                    Method: {parsed.method.toUpperCase()}
                  </Text>
                </View>
              )}

              {parsed.type === 'customer_purchase' && (
                <View>
                  <Text className="text-slate-900 dark:text-white text-lg font-extrabold">
                    🛒 Item: {parsed.quantity} {parsed.unit} {parsed.itemName} (
                    {formatMoney(parsed.amount)})
                  </Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                    Customer: {parsed.customerName}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={executeAction}
                disabled={saving}
                className="bg-emerald-600 rounded-xl h-11 items-center justify-center mt-3 shadow-md"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-black text-sm">✓ Confirm & Record Entry</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {errorMsg && (
            <Text className="text-red-600 dark:text-red-400 text-xs font-semibold mb-3">
              {errorMsg}
            </Text>
          )}

          {/* Quick Try Sample Chips */}
          <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            TRY SAYING OR TAPPING:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {sampleQueries.map((query) => (
              <TouchableOpacity
                key={query}
                onPress={() => handleManualParse(query)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5"
              >
                <Text className="text-slate-700 dark:text-slate-300 text-xs font-medium">
                  "{query}"
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
