import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'ta';

const dict = {
  en: {
    customers: 'Customers',
    addCustomer: 'Add customer',
    profile: 'Profile',
    youWillGet: 'You will get',
    search: 'Search name or phone',
    name: 'Customer name',
    phone: 'Phone number',
    pickContacts: 'Pick from contacts',
    contactsAsk: 'Allow contacts so you can add a customer from your phone.',
    contactsDenied: 'Contacts permission was not allowed. Type the phone number instead.',
    contactsUnsupported: 'This browser cannot open contacts. Type the phone number.',
    save: 'Save customer',
    phoneRequired: 'Name and phone number are required',
    added: 'Customer added',
    sendWhatsapp: 'Send UPI on WhatsApp',
    sendSms: 'Send UPI by SMS',
    noUpi: 'Add your UPI ID in Profile before sending a pay link.',
    language: 'Language',
    english: 'English',
    tamil: 'Tamil',
    back: 'Back',
  },
  ta: {
    customers: 'வாடிக்கையாளர்கள்',
    addCustomer: 'வாடிக்கையாளர் சேர்',
    profile: 'சுயவிவரம்',
    youWillGet: 'நீங்கள் பெறுவீர்கள்',
    search: 'பெயர் அல்லது எண் தேடு',
    name: 'வாடிக்கையாளர் பெயர்',
    phone: 'தொலைபேசி எண்',
    pickContacts: 'தொடர்புகளிலிருந்து தேர்வு',
    contactsAsk: 'தொலைபேசி தொடர்புகளை பயன்படுத்த அனுமதி கொடுங்கள்.',
    contactsDenied: 'தொடர்பு அனுமதி இல்லை. எண்ணை தட்டச்சு செய்யுங்கள்.',
    contactsUnsupported: 'இந்த உலாவியில் தொடர்புகள் திறக்க முடியாது. எண்ணை உள்ளிடுங்கள்.',
    save: 'சேமி',
    phoneRequired: 'பெயரும் தொலைபேசி எண்ணும் வேண்டும்',
    added: 'வாடிக்கையாளர் சேர்க்கப்பட்டார்',
    sendWhatsapp: 'வாட்ஸ்அப்பில் UPI அனுப்பு',
    sendSms: 'SMS-ல் UPI அனுப்பு',
    noUpi: 'பணம் கேட்கும் முன் சுயவிவரத்தில் UPI ஐடியை சேர்க்கவும்.',
    language: 'மொழி',
    english: 'English',
    tamil: 'தமிழ்',
    back: 'பின்செல்',
  },
} as const;

type Dict = (typeof dict)['en'];

const LanguageContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: Dict }>({
  lang: 'en',
  setLang: () => {},
  t: dict.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('fm-lang').then((value) => {
      if (value === 'ta' || value === 'en') setLangState(value);
    });
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem('fm-lang', next);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dict[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useI18n = () => useContext(LanguageContext);
