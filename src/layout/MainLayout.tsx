import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Package, ShoppingCart, History, LogOut, Users, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import logo from '../assets/logo.png';

export const MainLayout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { label: 'Tableau de bord', icon: LayoutDashboard, path: '/' },
        { label: 'Vente (POS)', icon: ShoppingCart, path: '/pos' },
        { label: 'Historique', icon: History, path: '/history' },
    ];

    if (user?.role === 'admin') {
        menuItems.splice(1, 0, { label: 'Stocks', icon: Package, path: '/products' });
        menuItems.push({ label: 'Gestion Accès', icon: Users, path: '/users' });
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isLight = theme === 'light';

    return (
        <div className="flex h-screen bg-espresso-950 font-sans text-espresso-100 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-primary-900 border-r border-primary-800 text-white flex flex-col shadow-2xl z-20">
                <div className="px-5 py-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-800 border border-primary-700 p-1 flex items-center justify-center shadow-lg">
                        <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-white">Amdjarass</span>
                </div>

                <nav className="flex-1 px-3 py-2 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={clsx(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium',
                                    isActive
                                        ? 'bg-primary-700 text-white'
                                        : 'text-primary-100/70 hover:bg-primary-800 hover:text-white'
                                )}
                            >
                                <item.icon className={clsx(
                                    "w-5 h-5 transition-colors duration-200",
                                    isActive ? "text-white" : "text-primary-300 group-hover:text-white"
                                )} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-auto">
                    <div className="h-px bg-primary-800 mx-4 mb-4"></div>
                    <div className="px-4 pb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-full bg-primary-700 border border-primary-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                                {user?.username ? user.username[0].toUpperCase() : 'U'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-white truncate">{user?.username || 'Utilisateur'}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-300 truncate">{user?.role || 'employé'}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-primary-300 hover:text-white p-2 rounded-lg hover:bg-primary-800 transition-all shrink-0"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-espresso-950">
                <header className="h-16 bg-espresso-900 border-b border-espresso-750 flex items-center justify-between px-8 shadow-sm z-10">
                    <h2 className="text-xl font-semibold text-espresso-100">
                        {menuItems.find(i => i.path === location.pathname)?.label || 'Amdjarass'}
                    </h2>

                    <div className="flex items-center gap-4">
                        {/* Bouton Jour / Nuit */}
                        <button
                            onClick={toggleTheme}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-300',
                                isLight
                                    ? 'bg-espresso-800 border-espresso-700 text-espresso-200 hover:bg-espresso-750'
                                    : 'bg-amber-950/40 border-amber-700/50 text-amber-300 hover:bg-amber-900/50'
                            )}
                            title={isLight ? 'Passer en mode nuit' : 'Passer en mode jour'}
                        >
                            {isLight
                                ? <><Moon className="w-3.5 h-3.5" /> Nuit</>
                                : <><Sun className="w-3.5 h-3.5" /> Jour</>
                            }
                        </button>

                        <div className="text-sm text-espresso-400">
                            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-8 relative flex flex-col bg-espresso-950">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
