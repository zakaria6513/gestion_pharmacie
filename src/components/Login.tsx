import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';

export const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!window.api) {
                // Fallback for browser dev mode without Electron
                if (username === 'admin' && password === 'admin') {
                    login({ id: 1, username: 'admin', role: 'admin' });
                    navigate('/');
                    return;
                }
                setError('API non disponible (Dev Mode)');
                return;
            }

            const result = await window.api.login({ username, password });
            if (result.success && result.user) {
                login(result.user);
                navigate('/');
            } else {
                setError(result.message === 'Invalid credentials' ? 'Identifiant ou mot de passe incorrect' : result.message || 'Erreur de connexion');
            }
        } catch (err) {
            setError('Erreur de connexion');
        }
    };

    return (
        <div className="min-h-screen bg-espresso-950 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-espresso-850 via-espresso-950 to-espresso-950 z-0" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-espresso-900 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-espresso-750"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 rounded-full bg-espresso-950 border-2 border-primary-400/50 p-2 flex items-center justify-center shadow-xl mb-4">
                        <img src={logo} alt="Pharmacie Amdjarass" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <h1 className="text-2xl font-bold text-espresso-100">Pharmacie Amdjarass</h1>
                    <p className="text-espresso-400 text-sm">Gestion Professionnelle</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-rose-900/40 border border-rose-700/60 text-rose-300 px-4 py-3 rounded-lg relative font-semibold text-center shadow-sm animate-pulse text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-espresso-300 mb-2">Utilisateur</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-espresso-850 border border-espresso-700 text-espresso-100 placeholder-espresso-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 outline-none transition-all"
                            placeholder="ex. admin"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-espresso-300 mb-2">Mot de passe</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-espresso-850 border border-espresso-700 text-espresso-100 placeholder-espresso-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 outline-none transition-all"
                                placeholder="••••••••"
                            />
                            <Lock className="absolute right-3.5 top-3.5 w-5 h-5 text-espresso-500" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-primary-500 hover:bg-primary-400 text-espresso-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary-500/20"
                    >
                        Se connecter
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-espresso-500">
                    v1.0.0
                </div>
            </motion.div>
        </div>
    );
};
