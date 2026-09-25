import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface User {
    id: number;
    username: string;
    role: 'admin' | 'employee';
}

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    // Persist session in sessionStorage to survive Electron window.reload() (e.g. after DB restore)
    const [user, setUser] = useState<User | null>(() => {
        try { return JSON.parse(sessionStorage.getItem('pharmacy_user') || 'null'); }
        catch { return null; }
    });

    const login = (userData: User) => {
        setUser(userData);
        sessionStorage.setItem('pharmacy_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('pharmacy_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
