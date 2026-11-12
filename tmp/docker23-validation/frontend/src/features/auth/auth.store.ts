import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/lib/types';

type AuthState = {
    token: string | null;
    user: AuthUser | null;
    setAuth: (token: string, user: AuthUser) => void;
    updateUser: (user: AuthUser) => void;
    logout: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setAuth: (token, user) => set({ token, user }),
            updateUser: (user) => set({ user }),
            logout: () => set({ token: null, user: null }),
        }),
        { name: 'brewlite-auth' },
    ),
);