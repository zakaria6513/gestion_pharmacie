import { useEffect, useState } from 'react';
import { Package, AlertTriangle, TrendingUp, AlertOctagon, DollarSign, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ title, value, icon: Icon, color, delay, onClick, subValue }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        onClick={onClick}
        className={`bg-espresso-900 p-6 rounded-2xl shadow-lg border border-espresso-750 flex items-start justify-between cursor-pointer hover:border-primary-400/50 hover:shadow-xl transition-all group`}
    >
        <div>
            <p className="text-espresso-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-espresso-100">{value}</h3>
            {subValue && <p className="text-xs text-espresso-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform shadow-md`}>
            <Icon className="w-6 h-6 text-espresso-950" />
        </div>
    </motion.div>
);

export const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, expired: 0, totalRevenue: 0 });
    const [salesChart, setSalesChart] = useState<{ date: string, total: number }[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string, total_sold: number }[]>([]);
    const navigate = useNavigate();

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        const fetchStats = async () => {
            if (window.api) {
                try {
                    const data = await window.api.getDashboardStats();
                    setStats(data);
                    const chart = await window.api.getSalesChart();
                    setSalesChart(chart);
                    const top = await window.api.getTopProducts();
                    setTopProducts(top);
                } catch (err) {
                    console.error('Erreur chargement dashboard:', err);
                }
            }
        };
        fetchStats();
    }, []);

    const navigateToProducts = (filter: string) => {
        navigate('/products', { state: { filter } });
    };

    // Calculate max value for chart scaling
    const maxSale = Math.max(...salesChart.map(d => d.total), 100);

    return (
        <div className="space-y-6 h-full overflow-auto pb-4 pr-2">
            <div>
                <h1 className="text-2xl font-bold text-espresso-100">Tableau de bord</h1>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
                {isAdmin && (
                    <StatCard
                        title="Chiffre d'Affaires"
                        value={`${stats.totalRevenue.toLocaleString()} FCFA`}
                        icon={DollarSign}
                        color="bg-primary-400"
                        delay={0.1}
                    />
                )}
                <StatCard
                    title="Total Produits"
                    value={stats.totalProducts}
                    icon={Package}
                    color="bg-primary-500"
                    delay={0.2}
                    onClick={() => navigateToProducts('all')}
                />
                <StatCard
                    title="Stock Faible"
                    value={stats.lowStock}
                    icon={AlertTriangle}
                    color="bg-amber-500"
                    delay={0.3}
                    onClick={() => navigateToProducts('lowStock')}
                    subValue="Cliquez pour détail"
                />
                <StatCard
                    title="Périmés"
                    value={stats.expired}
                    icon={AlertOctagon}
                    color="bg-rose-500"
                    delay={0.4}
                    onClick={() => navigateToProducts('expired')}
                    subValue="Action requise !"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sales Chart */}
                {isAdmin && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-espresso-900 p-6 rounded-2xl shadow-lg border border-espresso-750 lg:col-span-2"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-espresso-100 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary-400" />
                                Ventes (7 jours)
                            </h3>
                        </div>

                        <div className="h-64 flex items-end justify-between gap-2">
                            {salesChart.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-espresso-500 text-sm">
                                    Aucune vente récente.
                                </div>
                            ) : (
                                salesChart.map((day, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                        <div
                                            className="w-full bg-primary-500/30 border-t-2 border-primary-400 rounded-t-lg hover:bg-primary-400/40 transition-all relative group-hover:shadow-lg"
                                            style={{ height: `${(day.total / maxSale) * 100}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-espresso-800 text-espresso-100 border border-espresso-700 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                                                {day.total.toLocaleString()} FCFA
                                            </div>
                                        </div>
                                        <span className="text-xs text-espresso-400 font-medium rotate-0 sm:rotate-0">
                                            {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Top Products */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className={`bg-espresso-900 p-6 rounded-2xl shadow-lg border border-espresso-750 ${!isAdmin ? 'lg:col-span-3' : ''}`}
                >
                    <h3 className="text-lg font-bold text-espresso-100 mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-primary-400" />
                        Top 5 Ventes
                    </h3>

                    <div className="space-y-4">
                        {topProducts.length === 0 ? (
                            <p className="text-sm text-espresso-500 text-center py-8">Aucune vente.</p>
                        ) : (
                            topProducts.map((product, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-espresso-850 border border-espresso-750">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-espresso-800 border border-espresso-700 flex items-center justify-center text-sm font-bold text-primary-400">
                                            {i + 1}
                                        </div>
                                        <span className="font-medium text-espresso-200 text-sm">{product.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary-300 bg-primary-500/20 border border-primary-500/30 px-3 py-1 rounded-lg">
                                        {product.total_sold}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
