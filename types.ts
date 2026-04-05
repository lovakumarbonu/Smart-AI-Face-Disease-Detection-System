
export enum UserRole {
  USER = 'user',
  DOCTOR = 'doctor',
  ADMIN = 'admin'
}

export enum Language {
  ENGLISH = 'en',
  HINDI = 'hi',
  BENGALI = 'bn',
  TELUGU = 'te',
  MARATHI = 'mr',
  TAMIL = 'ta',
  GUJARATI = 'gu',
  KANNADA = 'kn',
  MALAYALAM = 'ml',
  PUNJABI = 'pa'
}

export const LANGUAGES = [
  { code: Language.ENGLISH, name: 'English', native: 'English' },
  { code: Language.HINDI, name: 'Hindi', native: 'हिन्दी' },
  { code: Language.BENGALI, name: 'Bengali', native: 'বাংলা' },
  { code: Language.TELUGU, name: 'Telugu', native: 'తెలుగు' },
  { code: Language.MARATHI, name: 'Marathi', native: 'मరాਠੀ' },
  { code: Language.TAMIL, name: 'Tamil', native: 'தமிழ்' },
  { code: Language.GUJARATI, name: 'Gujarati', native: 'ગુજરાતી' },
  { code: Language.KANNADA, name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: Language.MALAYALAM, name: 'Malayalam', native: 'മലയാളം' },
  { code: Language.PUNJABI, name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  preferredLanguage?: Language;
}

export interface DiseaseRisk {
  category: string;
  riskPercentage: number;
  confidenceScore: number;
  indicators: string[];
  recommendations: string[];
  riskFactors?: { name: string; probability: number }[];
}

export interface PredictionResult {
  id: string;
  userId: string;
  timestamp: string;
  imageUrl: string;
  risks: DiseaseRisk[];
  overallSummary: string;
  potentialDisease?: string;
  educationalLinks?: { title: string; url: string }[];
  videoLinks?: { title: string; url: string }[];
  status: 'pending' | 'reviewed' | 'completed';
  doctorFeedback?: string;
  language?: Language;
  userReportedSymptoms?: string[];
  isSharedWithSpecialist?: boolean;
}

export interface AppState {
  currentUser: User | null;
  history: PredictionResult[];
  predictions: PredictionResult[];
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
