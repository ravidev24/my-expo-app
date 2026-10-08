import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export type ParsedVoiceIntent =
  | {
      type: 'quick_sale';
      amount: number;
      note: string;
      confidence: number;
    }
  | {
      type: 'customer_purchase';
      customerName: string;
      itemName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      amount: number;
      confidence: number;
    }
  | {
      type: 'customer_payment';
      customerName: string;
      amount: number;
      method: string;
      confidence: number;
    }
  | {
      type: 'drawer_expense';
      amount: number;
      category: string;
      note: string;
      confidence: number;
    }
  | {
      type: 'unknown';
      rawText: string;
    };

// Extract numbers from spoken words (e.g., "fifty six" or "56")
const extractNumber = (str: string): number | null => {
  const directMatch = str.match(/\b(\d+(?:\.\d+)?)\b/);
  if (directMatch) return parseFloat(directMatch[1]);
  return null;
};

// Main Intent Parser for Spoken English / Hinglish / Tanglish phrases
export const parseVoiceCommand = (transcript: string): ParsedVoiceIntent => {
  if (!transcript || typeof transcript !== 'string') {
    return { type: 'unknown', rawText: '' };
  }

  const clean = transcript.trim().toLowerCase();

  // 1. Check for Drawer Expenses (e.g. "Tea 20", "20 rupees tea", "helper 150", "electricity 200")
  if (/\b(tea|chai|coffee|snacks|helper|wage|salary|electricity|bulb|rent|shop expense|cleaning|auto|petrol)\b/i.test(clean)) {
    const amount = extractNumber(clean);
    if (amount && amount > 0) {
      let category = 'Other';
      if (/\b(tea|chai|coffee|snacks)\b/i.test(clean)) category = 'Tea/Snacks';
      else if (/\b(helper|wage|salary|cleaning)\b/i.test(clean)) category = 'Helper Wages';
      else if (/\b(electricity|bulb|bill)\b/i.test(clean)) category = 'Electricity/Bill';
      else if (/\b(shop|rent|supplies)\b/i.test(clean)) category = 'Shop Supplies';

      return {
        type: 'drawer_expense',
        amount,
        category,
        note: transcript.trim(),
        confidence: 0.9,
      };
    }
  }

  // 2. Check for Customer Payment (e.g. "Suresh paid 200", "200 received from Suresh", "Ramesh pay 500")
  if (/\b(paid|pay|received|jama|kodu|payment)\b/i.test(clean)) {
    const amount = extractNumber(clean);
    if (amount && amount > 0) {
      // Find customer name by stripping out keywords and numbers
      const nameParts = clean
        .replace(/\b(paid|pay|received|jama|kodu|payment|rupees|rs|via|cash|upi|from|by|\d+(\.\d+)?)\b/gi, '')
        .trim()
        .split(/\s+/);
      const customerName = nameParts.length > 0 && nameParts[0].length >= 2 ? nameParts[0] : 'Customer';

      return {
        type: 'customer_payment',
        customerName: customerName.charAt(0).toUpperCase() + customerName.slice(1),
        amount,
        method: /\b(upi|gpay|phonepe|online)\b/i.test(clean) ? 'upi' : 'cash',
        confidence: 0.88,
      };
    }
  }

  // 3. Check for Customer Purchase with Item (e.g. "Ramesh 2kg sugar 80", "Suresh 50 rice")
  const purchaseMatch = clean.match(
    /^([a-z]+)\s+(?:(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs|pkt|packet)?\s+)?([a-z\s]+?)\s*(?:rs\.?|₹|for|of)?\s*(\d+(?:\.\d+)?)$/i
  );
  if (purchaseMatch) {
    const customerName = purchaseMatch[1].trim();
    const qty = parseFloat(purchaseMatch[2]) || 1;
    const unit = purchaseMatch[3] || 'pcs';
    const itemName = purchaseMatch[4].trim();
    const totalOrPrice = parseFloat(purchaseMatch[5]) || 0;

    if (customerName && itemName && totalOrPrice > 0) {
      return {
        type: 'customer_purchase',
        customerName: customerName.charAt(0).toUpperCase() + customerName.slice(1),
        itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
        quantity: qty,
        unit,
        unitPrice: Math.round((totalOrPrice / qty) * 100) / 100,
        amount: totalOrPrice,
        confidence: 0.92,
      };
    }
  }

  // 4. Check for Quick Cash Sale (e.g. "56 note sale", "56 sale", "56 cash", "56 rupees", "sale 100", "56")
  const isSaleWord = /\b(sale|note|cash|galla|roker|vilpanai|rupees|rs)\b/i.test(clean);
  const num = extractNumber(clean);
  if (num && (isSaleWord || clean.split(/\s+/).length <= 2)) {
    return {
      type: 'quick_sale',
      amount: num,
      note: clean.includes('sale') || clean.includes('note') ? transcript.trim() : `Quick Sale ₹${num}`,
      confidence: 0.95,
    };
  }

  return { type: 'unknown', rawText: transcript };
};

// Web Speech Recognition Controller
export class SpeechListener {
  private recognition: any = null;
  private nativeSubs: { remove: () => void }[] = [];
  public isListening: boolean = false;
  private onResultCb?: (text: string, isFinal: boolean) => void;
  private onErrorCb?: (err: any) => void;
  private readonly native = Platform.OS !== 'web';

  constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN'; // Indian English / Hinglish

        this.recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const text = final || interim;
          if (this.onResultCb) {
            this.onResultCb(text, Boolean(final));
          }
        };

        this.recognition.onerror = (event: any) => {
          this.isListening = false;
          if (this.onErrorCb) this.onErrorCb(event.error);
        };

        this.recognition.onend = () => {
          this.isListening = false;
        };
      }
    }
  }

  public isSupported(): boolean {
    return this.native || Boolean(this.recognition);
  }

  public async start(onResult: (text: string, isFinal: boolean) => void, onError?: (err: any) => void) {
    this.onResultCb = onResult;
    this.onErrorCb = onError;
    if (this.native) {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        this.isListening = false;
        onError?.('not-allowed');
        return;
      }
      this.nativeSubs.forEach((sub) => sub.remove());
      this.nativeSubs = [
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const text = event.results?.[0]?.transcript || '';
          if (text) onResult(text, event.isFinal);
        }),
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          this.isListening = false;
          onError?.(event.error);
        }),
      ];
      ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: false });
      this.isListening = true;
      return;
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
      }
    }
  }

  public stop() {
    if (this.native) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
      this.isListening = false;
      return;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch {}
    }
  }
}
