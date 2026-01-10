import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { encryptApiKey, decryptApiKey } from '@/app/actions';
import { EncryptedData } from '@/lib/encryption';

interface AISettings {
    apiKey: string | null;
    outputLanguage: string;
    isConfigured: boolean;
    isLoading: boolean;
}

interface SettingsStore extends AISettings {
    setApiKey: (key: string) => void;
    setLanguage: (lang: string) => void;
    loadSettings: (userId: string) => Promise<void>;
    saveSettings: (userId: string, apiKey: string, language: string) => Promise<void>;
    clearSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
    apiKey: null,
    outputLanguage: 'English',
    isConfigured: false,
    isLoading: false,

    setApiKey: (key) => set({ apiKey: key }),
    setLanguage: (lang) => set({ outputLanguage: lang }),

    loadSettings: async (userId: string) => {
        if (!userId) return;
        set({ isLoading: true });
        try {
            const docRef = doc(db, 'users', userId, 'settings', 'ai');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                let decryptedKey = null;

                if (data.encryptedKey) {
                    try {
                        // Decrypt server-side
                        decryptedKey = await decryptApiKey(data.encryptedKey as EncryptedData);
                    } catch (err) {
                        console.error("Failed to decrypt API Key on load:", err);
                    }
                }

                set({
                    apiKey: decryptedKey,
                    outputLanguage: data.outputLanguage || 'English',
                    isConfigured: !!decryptedKey,
                });
            } else {
                set({ isConfigured: false });
            }
        } catch (error) {
            console.error('Error loading AI settings:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    saveSettings: async (userId: string, apiKey: string, language: string) => {
        if (!userId) return;
        set({ isLoading: true });
        try {
            // 1. Encrypt API Key Server-Side
            const encryptedKey = await encryptApiKey(apiKey);

            // 2. Save to Firestore
            const docRef = doc(db, 'users', userId, 'settings', 'ai');
            await setDoc(docRef, {
                encryptedKey,
                outputLanguage: language,
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            // 3. Update Local State
            set({
                apiKey,
                outputLanguage: language,
                isConfigured: true
            });
        } catch (error) {
            console.error('Error saving AI settings:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    clearSettings: () => set({ apiKey: null, isConfigured: false })
}));
