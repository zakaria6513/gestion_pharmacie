import { useEffect, useState, useMemo, useCallback } from 'react';
import { Calendar, FileDown, Pencil, Trash2, X, Plus, Minus, AlertTriangle, CheckCircle, Receipt, BarChart3, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import type { Sale, SaleItem } from '../types';

// ─── Edit Modal ──────────────────────────────────────────────────────
interface EditModalProps {
    sale: Sale;
    onClose: () => void;
    onSave: (saleId: number, items: { product_id: number; quantity: number }[]) => Promise<void>;
}

const EditSaleModal = ({ sale, onClose, onSave }: EditModalProps) => {
    const [editItems, setEditItems] = useState<(SaleItem & { originalQuantity: number })[]>(
        sale.items.map(item => ({ ...item, originalQuantity: item.quantity }))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateItemQuantity = (productId: number, delta: number) => {
        setEditItems(prev =>
            prev.map(item => {
                if (item.product_id === productId) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            })
        );
        setError(null);
    };

    const setItemQuantity = (productId: number, value: string) => {
        const parsed = parseInt(value, 10);
        const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        setEditItems(prev =>
            prev.map(item =>
                item.product_id === productId ? { ...item, quantity: newQty } : item
            )
        );
        setError(null);
    };

    const newTotal = editItems.reduce((sum, item) => sum + ((Number(item.price_at_sale) || 0) * item.quantity), 0);
    const hasChanges = editItems.some(item => item.quantity !== item.originalQuantity);
    const allZero = editItems.every(item => item.quantity === 0);

    const handleSave = async () => {
        if (!hasChanges) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(
                sale.id,
                editItems.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
            );
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Erreur lors de la modification.');
        } finally {
            setSaving(false);
        }
    };

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-espresso-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-espresso-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-espresso-750"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-espresso-750 bg-espresso-850">
                    <div>
                        <h3 className="text-lg font-bold text-espresso-100">Modifier la Vente #{sale.id}</h3>
                        <p className="text-xs text-espresso-400 mt-0.5">
                            {sale.sale_date} — Caissier: {sale.cashier_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-espresso-750 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-espresso-400" />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {editItems.map(item => {
                        const lineTotal = item.price_at_sale * item.quantity;
                        const isRemoved = item.quantity === 0;
                        const isChanged = item.quantity !== item.originalQuantity;

                        return (
                            <div
                                key={item.product_id}
                                className={`p-4 rounded-xl border transition-all ${
                                    isRemoved
                                        ? 'bg-rose-950/30 border-rose-800/60 opacity-60'
                                        : isChanged
                                            ? 'bg-amber-950/30 border-amber-800/60'
                                            : 'bg-espresso-850 border-espresso-750'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 min-w-0 mr-3">
                                        <span className={`font-semibold text-sm ${isRemoved ? 'line-through text-rose-400' : 'text-espresso-100'}`}>
                                            {item.name}
                                        </span>
                                        {item.dosage && (
                                            <span className="text-xs text-espresso-400 ml-1">{item.dosage}</span>
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold whitespace-nowrap ${isRemoved ? 'text-rose-400' : 'text-primary-400'}`}>
                                        {lineTotal.toLocaleString()} FCFA
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-espresso-400">
                                        P.U: {item.price_at_sale.toLocaleString()} FCFA
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => updateItemQuantity(item.product_id, -1)}
                                            className="p-1.5 rounded-lg bg-espresso-750 hover:bg-rose-900/40 hover:text-rose-300 text-espresso-200 transition-colors"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <input
                                            type="number"
                                            min={0}
                                            value={item.quantity}
                                            onChange={e => setItemQuantity(item.product_id, e.target.value)}
                                            className="w-14 text-center text-sm font-bold bg-espresso-950 border border-espresso-700 text-espresso-100 rounded-lg py-1 outline-none focus:border-primary-400"
                                        />
                                        <button
                                            onClick={() => updateItemQuantity(item.product_id, 1)}
                                            className="p-1.5 rounded-lg bg-espresso-750 hover:bg-primary-500/30 hover:text-primary-300 text-espresso-200 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {isChanged && !isRemoved && (
                                    <div className="mt-2 text-xs text-amber-400 font-medium">
                                        Quantité modifiée: {item.originalQuantity} → {item.quantity}
                                    </div>
                                )}
                                {isRemoved && (
                                    <div className="mt-2 text-xs text-rose-400 font-medium">
                                        ⚠ Ce médicament sera retiré de la vente (stock restauré)
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-espresso-750 bg-espresso-850 space-y-3">
                    {error && (
                        <div className="flex items-start gap-2 bg-rose-900/40 border border-rose-700/60 text-rose-300 px-3 py-2.5 rounded-xl text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-sm text-espresso-400">Nouveau total</span>
                            <div className="text-xl font-bold text-espresso-100">
                                {newTotal.toLocaleString()} <span className="text-sm text-espresso-400 font-normal">FCFA</span>
                            </div>
                        </div>
                        {allZero && (
                            <span className="text-xs text-rose-300 font-medium bg-rose-900/40 px-2.5 py-1 rounded-lg border border-rose-700/50">
                                Vente sera supprimée
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-espresso-800 border border-espresso-700 text-espresso-200 py-2.5 rounded-xl font-medium hover:bg-espresso-750 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className="flex-1 bg-primary-500 hover:bg-primary-400 disabled:bg-espresso-800 disabled:text-espresso-600 disabled:cursor-not-allowed text-espresso-950 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-espresso-950" />
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    {allZero ? 'Supprimer' : 'Enregistrer'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Delete Confirmation Modal ───────────────────────────────────────
interface DeleteModalProps {
    sale: Sale;
    onClose: () => void;
    onConfirm: (saleId: number) => Promise<void>;
}

const DeleteSaleModal = ({ sale, onClose, onConfirm }: DeleteModalProps) => {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        setDeleting(true);
        setError(null);
        try {
            await onConfirm(sale.id);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Erreur lors de la suppression.');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-espresso-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-espresso-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-espresso-750"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-rose-950/50 border border-rose-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-7 h-7 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-espresso-100 mb-2">Supprimer la Vente #{sale.id} ?</h3>
                    <p className="text-sm text-espresso-400 mb-1">
                        Cette action va supprimer la vente et remettre en stock les médicaments suivants :
                    </p>
                    <div className="bg-espresso-850 rounded-xl p-3 mt-3 mb-4 text-left max-h-40 overflow-y-auto border border-espresso-750">
                        {sale.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm py-1 border-b border-espresso-750 last:border-0">
                                <span className="text-espresso-200 font-medium">{item.name}</span>
                                <span className="text-espresso-400">+{item.quantity} unité(s)</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-sm font-bold text-espresso-200 mb-4">
                        Total: {sale.total_amount.toLocaleString()} FCFA
                    </p>

                    {error && (
                        <div className="flex items-start gap-2 bg-rose-900/40 border border-rose-700/60 text-rose-300 px-3 py-2.5 rounded-xl text-sm mb-4">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-espresso-800 border border-espresso-700 text-espresso-200 py-2.5 rounded-xl font-medium hover:bg-espresso-750 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-espresso-800 disabled:text-espresso-600 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {deleting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Success Toast ───────────────────────────────────────────────────
const SuccessToast = ({ message, onDone }: { message: string; onDone: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onDone, 3000);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg shadow-emerald-200 flex items-center gap-2 animate-slide-up">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium text-sm">{message}</span>
        </div>
    );
};

// Helper to determine if a sale is within 24h of creation (editable/deletable)
const isEditable = (saleDate: string): boolean => {
    try {
        // Interpréter la date comme locale (pas UTC) car sale_date est en heure locale SQLite
        const saleTime = new Date(saleDate.replace(' ', 'T')).getTime();
        const diffMs = Date.now() - saleTime;
        return diffMs < 24 * 60 * 60 * 1000; // 24 hours
    } catch (e) {
        return false;
    }
};

// ─── Main History Component ──────────────────────────────────────────
export const History = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [sales, setSales] = useState<Sale[]>([]);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });
    const [quickFilter, setQuickFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'auto' | 'tickets' | 'summary'>('auto');

    // Pagination State
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const LIMIT = 50;

    // Modal State
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchHistory = useCallback(async (reset = false) => {
        if (loading) return;
        if (!reset && !hasMore) return;

        setLoading(true);
        try {
            const currentOffset = reset ? 0 : offset;

            if (!window.api) throw new Error('API non disponible');
            const newSales = await window.api.getSalesHistory({
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
                limit: LIMIT,
                offset: currentOffset
            });

            if (reset) {
                setSales(newSales);
                setOffset(LIMIT);
            } else {
                // Déduplication par sale.id pour éviter les doublons en cas de double-clic
                setSales(prev => {
                    const existingIds = new Set(prev.map(s => s.id));
                    const unique = newSales.filter((s: Sale) => !existingIds.has(s.id));
                    return [...prev, ...unique];
                });
                setOffset(prev => prev + LIMIT);
            }

            if (newSales.length < LIMIT) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setLoading(false);
        }
    }, [hasMore, offset, dateRange]); // Do NOT include `loading` — it causes circular dep

    // Initial load and Filter changes
    useEffect(() => {
        setOffset(0);
        setHasMore(true);
        fetchHistory(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    const applyQuickFilter = (type: string) => {
        const now = new Date();
        let start = '';
        let end = '';

        // Utiliser le format local YYYY-MM-DD sans passer par toISOString (qui convertit en UTC et décale les dates)
        const pad = (n: number) => String(n).padStart(2, '0');
        const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (type === 'thisMonth') {
            start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
            end = toLocalDateStr(now);
        } else if (type === 'lastMonth') {
            const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            start = toLocalDateStr(firstLastMonth);
            end = toLocalDateStr(lastLastMonth);
        } else if (type === 'thisYear') {
            start = `${now.getFullYear()}-01-01`;
            end = toLocalDateStr(now);
        } else if (type === 'all') {
            start = '';
            end = '';
        }
        setDateRange({ startDate: start, endDate: end });
    };

    const handleExport = async () => {
        if (!window.api) { alert('API non disponible.'); return; }
        try {
            const result = await window.api.exportSalesHistory({
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined
            });

            if (result.success) {
                alert(`Exportation réussie !\nFichier : ${result.filePath}`);
            } else if (result.reason === 'canceled') {
                // User canceled, do nothing
            } else {
                alert(`Erreur lors de l'exportation : ${result.error}`);
            }
        } catch (error) {
            console.error("Export failed:", error);
            alert("Erreur technique lors de l'exportation.");
        }
    };

    // ─── Admin Actions ───────────────────────────────────────────
    const handleUpdateSale = async (saleId: number, items: { product_id: number; quantity: number }[]) => {
        if (!window.api) { alert('API non disponible.'); return; }
        try {
            const result = await window.api.updateSale({ saleId, items });
            if (result.success) {
                setSuccessMessage(result.message || 'Vente modifiée.');
                setOffset(0);
                setHasMore(true);
                await fetchHistory(true);
            } else {
                alert('Erreur lors de la modification de la vente.');
            }
        } catch (err: any) {
            alert(`Erreur : ${err.message || 'Inconnue'}`);
        }
    };

    const handleDeleteSale = async (saleId: number) => {
        if (!window.api) { alert('API non disponible.'); return; }
        try {
            const result = await window.api.deleteSale(saleId);
            if (result.success) {
                setSuccessMessage(result.message || 'Vente supprimée.');
                setOffset(0);
                setHasMore(true);
                await fetchHistory(true);
            } else {
                alert('Erreur lors de la suppression de la vente.');
            }
        } catch (err: any) {
            alert(`Erreur : ${err.message || 'Inconnue'}`);
        }
    };

    // ─── Group sales by date for display ─────────────────────────
    const groupedByDate = useMemo(() => {
        const groups: {
            label: string;
            date: string;
            totalRevenue: number;
            sales: Sale[];
            hasEditableSales: boolean;
            consolidatedItems: {
                product_id: number;
                name: string;
                dosage?: string;
                totalQuantity: number;
                price_at_sale: number;
                totalRevenue: number;
            }[];
        }[] = [];

        const pad = (n: number) => String(n).padStart(2, '0');
        const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const today = toLocalStr(new Date());
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = toLocalStr(yesterdayDate);
        const dayBeforeDate = new Date(); dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
        const dayBefore = toLocalStr(dayBeforeDate);

        const groupedMap = new Map<string, { label: string; total: number; sales: Sale[] }>();

        sales.forEach(sale => {
            const saleDateParts = sale.sale_date.split(' ');
            const saleDate = saleDateParts[0];

            let label = '';
            try {
                label = new Date(saleDate + 'T00:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
            } catch {
                label = saleDate;
            }

            if (saleDate === today) label = "Aujourd'hui";
            else if (saleDate === yesterday) label = "Hier";
            else if (saleDate === dayBefore) label = "Avant-hier";

            if (!groupedMap.has(saleDate)) {
                groupedMap.set(saleDate, { label, total: 0, sales: [] });
            }

            const group = groupedMap.get(saleDate)!;
            group.total += Number(sale.total_amount) || 0;
            group.sales.push(sale);
        });

        for (const [date, data] of groupedMap) {
            const hasEditableSales = data.sales.some(s => isEditable(s.sale_date));

            // Consolidate items for this day
            const itemMap = new Map<string, {
                product_id: number;
                name: string;
                dosage?: string;
                totalQuantity: number;
                price_at_sale: number;
                totalRevenue: number;
            }>();

            data.sales.forEach(sale => {
                sale.items?.forEach(item => {
                    const key = `${item.product_id}-${item.price_at_sale}`;
                    if (!itemMap.has(key)) {
                        itemMap.set(key, {
                            product_id: item.product_id,
                            name: item.name,
                            dosage: item.dosage,
                            totalQuantity: 0,
                            price_at_sale: item.price_at_sale,
                            totalRevenue: 0
                        });
                    }
                    const curr = itemMap.get(key)!;
                    curr.totalQuantity += Number(item.quantity) || 0;
                    curr.totalRevenue += (Number(item.quantity) || 0) * (Number(item.price_at_sale) || 0);
                });
            });

            const consolidatedItems = Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);

            groups.push({
                label: data.label,
                date,
                totalRevenue: data.total,
                sales: data.sales.sort((a, b) => b.sale_date.localeCompare(a.sale_date)),
                hasEditableSales,
                consolidatedItems
            });
        }

        return groups.sort((a, b) => b.date.localeCompare(a.date));
    }, [sales]);

    // Helper to extract time from sale_date
    const getSaleTime = (saleDate: string): string => {
        const parts = saleDate.split(' ');
        return parts[1] ? parts[1].substring(0, 5) : '00:00';
    };

    return (
        <div className="space-y-6 pb-10 h-full flex flex-col">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-espresso-100">Journal des Ventes</h1>
                    <p className="text-sm text-espresso-400">
                        Liste détaillée par transaction.
                        {isAdmin && <span className="text-primary-400 font-medium ml-2">Mode Admin</span>}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Mode Selector */}
                    <div className="flex items-center bg-espresso-900 p-1 rounded-xl border border-espresso-750 shadow-md">
                        <button
                            onClick={() => setViewMode('auto')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'auto'
                                    ? 'bg-primary-500 text-espresso-950 shadow-sm'
                                    : 'text-espresso-400 hover:text-espresso-100'
                            }`}
                            title="Auto : Tickets pour <24h, Récapitulatif pour >24h"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Auto
                        </button>
                        <button
                            onClick={() => setViewMode('tickets')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'tickets'
                                    ? 'bg-primary-500 text-espresso-950 shadow-sm'
                                    : 'text-espresso-400 hover:text-espresso-100'
                            }`}
                            title="Afficher chaque ticket séparément"
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            Tickets
                        </button>
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'summary'
                                    ? 'bg-primary-500 text-espresso-950 shadow-sm'
                                    : 'text-espresso-400 hover:text-espresso-100'
                            }`}
                            title="Regrouper tous les médicaments vendus par jour"
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Récapitulatif
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-espresso-900 p-2 rounded-xl border border-espresso-750 shadow-md">
                        <select
                            value={quickFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                setQuickFilter(val);
                                applyQuickFilter(val);
                            }}
                            className="bg-espresso-900 text-espresso-100 text-sm font-medium outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-espresso-900 text-espresso-100">Tout l'historique</option>
                            <option value="thisMonth" className="bg-espresso-900 text-espresso-100">Ce mois-ci</option>
                            <option value="lastMonth" className="bg-espresso-900 text-espresso-100">Le mois dernier</option>
                            <option value="thisYear" className="bg-espresso-900 text-espresso-100">Cette année</option>
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-espresso-950 px-4 py-2 rounded-xl transition-colors shadow-lg shadow-primary-500/20 font-bold"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Exporter CSV</span>
                    </button>
                </div>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {sales.length === 0 && !loading ? (
                    <div className="bg-espresso-900 p-12 rounded-2xl shadow-lg border border-espresso-750 text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-espresso-400" />
                        <p className="text-espresso-400">Aucune vente trouvée.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedByDate.map((group) => {
                            const isSummaryView = viewMode === 'summary' || (viewMode === 'auto' && !group.hasEditableSales);

                            return (
                                <div key={group.date} className="bg-espresso-900 rounded-2xl shadow-lg border border-espresso-750 overflow-hidden">
                                    {/* Day Header */}
                                    <div className="bg-espresso-850 px-6 py-4 border-b border-espresso-750 flex justify-between items-center sticky top-0 z-10">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-espresso-100 capitalize">
                                                {group.label}
                                            </h3>
                                            {isSummaryView ? (
                                                <span className="text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <BarChart3 className="w-3 h-3" />
                                                    Récapitulatif Journée ({group.consolidatedItems.length} produit{group.consolidatedItems.length > 1 ? 's' : ''})
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold bg-espresso-800 text-espresso-300 border border-espresso-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Receipt className="w-3 h-3 text-primary-400" />
                                                    {group.sales.length} Vente{group.sales.length > 1 ? 's' : ''} (Tickets)
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-primary-300 font-bold bg-espresso-900 px-3 py-1 rounded-lg border border-espresso-750 shadow-sm">
                                            Total: {group.totalRevenue.toLocaleString()} FCFA
                                        </div>
                                    </div>

                                    {/* Day Content */}
                                    {isSummaryView ? (
                                        /* Consolidated Summary Table */
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-espresso-400 uppercase tracking-wider border-b border-espresso-800 bg-espresso-900/40">
                                                    <tr>
                                                        <th className="px-6 py-3 font-medium">Médicament Vendue</th>
                                                        <th className="px-6 py-3 font-medium text-center w-32">Qté Totale</th>
                                                        <th className="px-6 py-3 font-medium text-right w-32">Prix U.</th>
                                                        <th className="px-6 py-3 font-medium text-right w-36">Total Journée</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-espresso-800">
                                                    {group.consolidatedItems.map((item, idx) => (
                                                        <tr key={`${item.product_id}-${idx}`} className="hover:bg-espresso-850/50 transition-colors">
                                                            <td className="px-6 py-3 font-semibold text-espresso-100">
                                                                {item.name}
                                                                {item.dosage && (
                                                                    <span className="text-xs text-espresso-400 font-normal ml-1.5">({item.dosage})</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-3 text-center">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                                                                    {item.totalQuantity} unités
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3 text-right text-espresso-300">
                                                                {item.price_at_sale.toLocaleString()} <span className="text-xs text-espresso-500">FCFA</span>
                                                            </td>
                                                            <td className="px-6 py-3 text-right font-bold text-primary-400">
                                                                {item.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-primary-300">FCFA</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        /* Ticket-by-Ticket View */
                                        <div className="divide-y divide-espresso-800">
                                            {group.sales.map((sale) => (
                                                <div key={sale.id} className="group">
                                                    {/* Sale Header */}
                                                    <div className="px-6 py-3 flex items-center justify-between border-b border-espresso-800">
                                                        <div className="flex items-center gap-4">
                                                            <span className="font-mono text-xs text-espresso-400 bg-espresso-950 px-2 py-1 rounded border border-espresso-750">
                                                                {getSaleTime(sale.sale_date)}
                                                            </span>
                                                            <span className="text-sm text-espresso-300">
                                                                Vente <span className="font-bold text-espresso-100">#{sale.id}</span>
                                                            </span>
                                                            <span className="text-xs text-espresso-400">
                                                                par <span className="font-medium text-espresso-300">{sale.cashier_name || 'Inconnu'}</span>
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-primary-400">
                                                                {sale.total_amount.toLocaleString()} FCFA
                                                            </span>

                                                            {/* Admin Actions */}
                                                            {isAdmin && (
                                                                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {isEditable(sale.sale_date) ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => setEditingSale(sale)}
                                                                                className="p-1.5 rounded-lg hover:bg-amber-950/50 text-espresso-400 hover:text-amber-400 transition-colors"
                                                                                title="Modifier cette vente"
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setDeletingSale(sale)}
                                                                                className="p-1.5 rounded-lg hover:bg-rose-950/50 text-espresso-400 hover:text-rose-400 transition-colors"
                                                                                title="Supprimer cette vente"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-xs text-espresso-500 bg-espresso-950 px-2 py-0.5 rounded border border-espresso-800 cursor-not-allowed select-none" title="Cette vente a plus de 24h et ne peut plus être modifiée (même par l'admin)">
                                                                            Non modifiable (&gt;24h)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Sale Items Table */}
                                                    {sale.items && sale.items.length > 0 && (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="text-xs text-espresso-400 uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="px-6 py-2 font-medium">Produit</th>
                                                                        <th className="px-6 py-2 font-medium text-center w-20">Qté</th>
                                                                        <th className="px-6 py-2 font-medium text-right w-28">Prix U.</th>
                                                                        <th className="px-6 py-2 font-medium text-right w-28">Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-espresso-800">
                                                                    {sale.items.map((item, i) => (
                                                                        <tr key={`${sale.id}-${item.product_id}-${i}`} className="hover:bg-espresso-850/50 transition-colors">
                                                                            <td className="px-6 py-2.5 font-medium text-espresso-100">
                                                                                {item.name}
                                                                                {item.dosage && (
                                                                                    <span className="text-xs text-espresso-400 ml-1">({item.dosage})</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-2.5 text-center">
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-espresso-800 text-espresso-200 border border-espresso-700">
                                                                                    {item.quantity}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-6 py-2.5 text-right text-espresso-300">
                                                                                {item.price_at_sale.toLocaleString()} <span className="text-xs text-espresso-500">FCFA</span>
                                                                            </td>
                                                                            <td className="px-6 py-2.5 text-right font-bold text-primary-400">
                                                                                {(item.price_at_sale * item.quantity).toLocaleString()} <span className="text-xs font-normal text-primary-300">FCFA</span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="text-center py-4">
                                <button
                                    onClick={() => fetchHistory(false)}
                                    disabled={loading}
                                    className="bg-espresso-900 border border-espresso-750 text-espresso-300 px-6 py-2 rounded-full hover:bg-espresso-850 hover:text-espresso-100 transition-all font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Chargement...' : 'Voir les ventes plus anciennes'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {editingSale && (
                <EditSaleModal
                    sale={editingSale}
                    onClose={() => setEditingSale(null)}
                    onSave={handleUpdateSale}
                />
            )}

            {deletingSale && (
                <DeleteSaleModal
                    sale={deletingSale}
                    onClose={() => setDeletingSale(null)}
                    onConfirm={handleDeleteSale}
                />
            )}

            {/* Success Toast */}
            {successMessage && (
                <SuccessToast
                    message={successMessage}
                    onDone={() => setSuccessMessage(null)}
                />
            )}
        </div>
    );
};
