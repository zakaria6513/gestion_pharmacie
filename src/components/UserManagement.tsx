import React, { useEffect, useState } from 'react';
import { User, Plus, Edit, Trash, Save, X, Shield, ShieldAlert, Key, DatabaseBackup, RefreshCw, CheckCircle, AlertTriangle, HardDrive, FolderOpen, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const UserManagement = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showBackupList, setShowBackupList] = useState(false);
    const [backupStatus, setBackupStatus] = useState<{
        backups: { filename: string; date: string; sizeKb: number; createdAt: string }[];
        backupDir: string;
    } | null>(null);

    const [formData, setFormData] = useState<{
        username: string;
        password: string;
        role: 'admin' | 'employee';
    }>({
        username: '',
        password: '',
        role: 'employee',
    });

    const fetchUsers = async () => {
        if (window.api) {
            const data = await window.api.getUsers();
            setUsers(data);
        }
    };

    const fetchBackupStatus = async () => {
        if (window.api) {
            try {
                const status = await (window.api as any).getBackupStatus();
                setBackupStatus(status);
            } catch (_) {}
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchBackupStatus();
    }, []);

    const handleOpenModal = (user?: any) => {
        setError(null);
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                password: '', // Don't show current password
                role: user.role,
            });
        } else {
            setEditingUser(null);
            setFormData({ username: '', password: '', role: 'employee' });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) return;
        try {
            if (window.api) {
                await window.api.deleteUser(id);
                fetchUsers();
            }
        } catch (err: any) {
            alert(`Erreur : ${err.message || 'Une erreur est survenue.'}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (window.api) {
                if (editingUser) {
                    await window.api.updateUser({ ...formData, id: editingUser.id });
                } else {
                    if (!formData.password) {
                        setError('Le mot de passe est obligatoire pour un nouvel utilisateur.');
                        return;
                    }
                    await window.api.addUser(formData);
                }
                setIsModalOpen(false);
                fetchUsers();
            }
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue.');
        }
    };

    const handleBackup = async () => {
        if (!window.api) { alert('API non disponible.'); return; }
        try {
            const result = await window.api.backupDb();
            if (result.success) {
                alert(`Sauvegarde réussie !\nFichier : ${result.filePath}`);
            } else if (result.error) {
                alert(`Erreur : ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la sauvegarde.");
        }
    };

    const handleRestore = async () => {
        if (!window.api) { alert('API non disponible.'); return; }
        if (!window.confirm("ATTENTION : Cette action va remplacer toutes les données actuelles par celles de la sauvegarde.\n\nL'application va redémarrer automatiquement.\n\nÊtes-vous sûr ?")) return;

        try {
            const result = await window.api.restoreDb();
            if (result.success) {
                // App should reload, but if not:
                alert('Restauration réussie. L\'application va redémarrer.');
            } else if (result.error) {
                alert(`Erreur : ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la restauration.");
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-espresso-100">Gestion des Utilisateurs</h1>
                    <p className="text-sm text-espresso-400">Ajoutez des employés et gérez l'accès.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary-500 hover:bg-primary-400 text-espresso-950 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-primary-500/20 font-bold"
                >
                    <Plus className="w-5 h-5" />
                    Nouvel Utilisateur
                </button>
            </div>

            <div className="bg-espresso-900 rounded-2xl shadow-lg border border-espresso-750 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full">
                        <thead className="bg-espresso-850 border-b border-espresso-750 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider">Utilisateur</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider">Rôle</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider">Créé le</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-espresso-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-espresso-800">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-espresso-850/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30' : 'bg-espresso-800 text-espresso-300'}`}>
                                                <User className="w-5 h-5" />
                                            </div>
                                            <span className="font-bold text-espresso-100">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.role === 'admin' ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 gap-1">
                                                <Shield className="w-3 h-3 text-primary-400" /> Admin
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-espresso-800 text-espresso-300 border border-espresso-700 gap-1">
                                                <User className="w-3 h-3" /> Employé
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-espresso-400">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => handleOpenModal(user)}
                                            className="text-espresso-400 hover:text-primary-400 mr-3 transition-colors p-2 hover:bg-espresso-800 rounded-lg"
                                            title="Modifier / Changer MDP"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="text-espresso-400 hover:text-rose-400 transition-colors p-2 hover:bg-espresso-800 rounded-lg"
                                            title="Supprimer"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* System Maintenance Section */}
            <div className="bg-espresso-900 border border-espresso-750 rounded-2xl p-6 shrink-0 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-espresso-100 flex items-center gap-2">
                            <DatabaseBackup className="w-5 h-5 text-primary-400" />
                            Maintenance &amp; Sauvegarde
                        </h3>
                        <p className="text-espresso-400 text-sm">Sauvegardez vos données ou restaurez une version précédente.</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleBackup}
                            className="flex items-center gap-2 px-4 py-2 bg-espresso-850 border border-espresso-700 rounded-xl text-espresso-100 font-medium hover:bg-espresso-800 transition-colors shadow-sm"
                        >
                            <DatabaseBackup className="w-4 h-4 text-primary-400" />
                            Sauvegarder
                        </button>
                        <button
                            onClick={handleRestore}
                            className="flex items-center gap-2 px-4 py-2 bg-espresso-850 border border-espresso-700 rounded-xl text-espresso-100 font-medium hover:bg-rose-950/40 hover:text-rose-300 transition-colors shadow-sm"
                        >
                            <RefreshCw className="w-4 h-4 text-rose-400" />
                            Restaurer
                        </button>
                    </div>
                </div>

                {/* Auto-Backup Status Panel */}
                <div className="bg-espresso-850 rounded-xl border border-espresso-750 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-primary-400" />
                            <span className="text-sm font-bold text-espresso-200">Sauvegarde Automatique</span>
                            {backupStatus && backupStatus.backups.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-900/50 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3" /> Aucun backup auto
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowBackupList(v => !v)}
                            className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                        >
                            {showBackupList ? 'Masquer' : 'Voir les backups'}
                        </button>
                    </div>

                    {/* Summary line */}
                    {backupStatus && backupStatus.backups.length > 0 && (
                        <div className="flex items-center gap-4 text-xs text-espresso-400 mb-2">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Dernier backup :
                                <span className="text-espresso-200 font-semibold ml-1">
                                    {new Date(backupStatus.backups[0].date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {backupStatus.backups.length} / 7 copies
                            </span>
                        </div>
                    )}

                    {backupStatus && backupStatus.backups.length === 0 && (
                        <p className="text-xs text-espresso-500 italic">
                            Aucune sauvegarde automatique trouvée. Un backup sera créé automatiquement au prochain démarrage de l'app (version installée uniquement).
                        </p>
                    )}

                    {/* Expandable list */}
                    <AnimatePresence>
                        {showBackupList && backupStatus && backupStatus.backups.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 space-y-1.5">
                                    {backupStatus.backups.map((b, i) => (
                                        <div key={b.filename} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-espresso-900 border border-espresso-750">
                                            <div className="flex items-center gap-2">
                                                {i === 0 && <span className="text-xs bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Récent</span>}
                                                <span className="text-xs font-mono text-espresso-300">{b.filename}</span>
                                            </div>
                                            <span className="text-xs text-espresso-500">{b.sizeKb.toLocaleString()} Ko</span>
                                        </div>
                                    ))}
                                    {backupStatus.backupDir && (
                                        <p className="text-xs text-espresso-600 mt-2 italic">
                                            📂 Dossier : {backupStatus.backupDir}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-espresso-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-espresso-750"
                        >
                            <div className="p-6 border-b border-espresso-750 flex justify-between items-center bg-espresso-850">
                                <h3 className="text-lg font-bold text-espresso-100">
                                    {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-espresso-400 hover:text-espresso-100 p-2 hover:bg-espresso-800 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {error && (
                                    <div className="bg-rose-900/40 text-rose-300 p-3 rounded-xl text-sm border border-rose-700/60 flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-espresso-200 mb-2">Nom d'utilisateur</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-500 w-5 h-5" />
                                        <input required type="text" className="w-full pl-10 pr-4 py-2.5 bg-espresso-850 border border-espresso-700 text-espresso-100 rounded-xl focus:border-primary-400 outline-none transition-all placeholder-espresso-500"
                                            value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-espresso-200 mb-2">
                                        {editingUser ? 'Nouveau Mot de passe (Laisser vide pour garder)' : 'Mot de passe'}
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-500 w-5 h-5" />
                                        <input
                                            type="password"
                                            className="w-full pl-10 pr-4 py-2.5 bg-espresso-850 border border-espresso-700 text-espresso-100 rounded-xl focus:border-primary-400 outline-none transition-all placeholder-espresso-500"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-espresso-200 mb-2">Rôle</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-espresso-850 border border-espresso-700 text-espresso-100 rounded-xl focus:border-primary-400 outline-none"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                                    >
                                        <option value="employee" className="bg-espresso-900 text-espresso-100">Employé</option>
                                        <option value="admin" className="bg-espresso-900 text-espresso-100">Administrateur</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-espresso-300 hover:bg-espresso-800 rounded-lg transition-colors">
                                        Annuler
                                    </button>
                                    <button type="submit" className="px-6 py-2 bg-primary-500 text-espresso-950 font-bold rounded-lg hover:bg-primary-400 shadow-lg shadow-primary-500/20 flex items-center gap-2 transition-transform active:scale-95">
                                        <Save className="w-4 h-4" />
                                        Enregistrer
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
