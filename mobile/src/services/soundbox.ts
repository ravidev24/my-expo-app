import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_ENABLED = 'grocery_soundbox_enabled';
const STORAGE_KEY_LANG = 'grocery_soundbox_lang';

let soundboxEnabled = true;
let soundboxLanguage = 'en-IN'; // Default to Indian English, supports 'hi-IN', 'ta-IN', etc.

// Initialize stored settings
export const initSoundbox = async () => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEY_ENABLED);
    if (enabled !== null) {
      soundboxEnabled = enabled === 'true';
    }
    const lang = await AsyncStorage.getItem(STORAGE_KEY_LANG);
    if (lang) {
      soundboxLanguage = lang;
    }
  } catch {}
};

export const isSoundboxEnabled = () => soundboxEnabled;

export const setSoundboxEnabled = async (enabled: boolean) => {
  soundboxEnabled = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch {}
};

export const getSoundboxLanguage = () => soundboxLanguage;

export const setSoundboxLanguage = async (lang: string) => {
  soundboxLanguage = lang;
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LANG, lang);
  } catch {}
};

// Play a pleasant digital soundbox payment chime using Web Audio API
export const playSoundboxChime = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Two-tone payment success chime (587.33Hz D5 -> 880Hz A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.35, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.45);
      }
    } catch {}
  }
};

// Speak text using SpeechSynthesis
export const speakAnnouncement = (text: string) => {
  if (!soundboxEnabled) return;

  playSoundboxChime();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      // Delay speech slightly to let the chime ring
      setTimeout(() => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.lang = soundboxLanguage;

        // Try to pick a natural regional voice if available
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(
          (v) => v.lang.includes(soundboxLanguage) || v.lang.includes('en-IN') || v.lang.includes('hi-IN')
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        window.speechSynthesis.speak(utterance);
      }, 350);
    } catch (err) {
      console.warn('[Soundbox TTS Error]:', err);
    }
  }
};

// Specific Audio Trigger Helpers
export const soundbox = {
  paymentReceived: (amount: number, customerName: string, method: string = 'cash') => {
    const formattedAmount = `${amount} rupees`;
    const cleanMethod = method.toUpperCase() === 'UPI' ? 'UPI' : 'Cash';
    const text = `Received ${formattedAmount} from ${customerName} on ${cleanMethod}.`;
    speakAnnouncement(text);
  },

  quickSale: (amount: number, note?: string) => {
    const formattedAmount = `${amount} rupees`;
    const text = `${formattedAmount} cash sale recorded.`;
    speakAnnouncement(text);
  },

  expensePaid: (amount: number, category?: string) => {
    const formattedAmount = `${amount} rupees`;
    const text = `${formattedAmount} expense recorded.`;
    speakAnnouncement(text);
  },

  testVoice: () => {
    speakAnnouncement('FreshMart Soundbox active. All payments will be announced aloud.');
  },

  speakAnnouncement: (text: string) => {
    speakAnnouncement(text);
  },
};

// Auto-initialize on import
initSoundbox();
