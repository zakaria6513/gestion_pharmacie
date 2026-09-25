
import React, { useEffect, useState, useRef } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { Plus, Search, Edit, Trash, Box, X, Save, Barcode, Upload, FileDown, Database, Merge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

// Virtuoso table components defined OUTSIDE component to avoid recreation on every render
const VirtuosoScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div {...props} ref={ref} className="overflow-y-auto h-full" />);
const VirtuosoTable = (props: React.TableHTMLAttributes<HTMLTableElement>) => <table {...props} className="w-full relative border-collapse" />;
const VirtuosoTableHead = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => <thead {...props} ref={ref} className="bg-espresso-850 border-b border-espresso-750 sticky top-0 z-10 shadow-sm" />);
const VirtuosoTableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => <tbody {...props} ref={ref} className="divide-y divide-espresso-800" />);

export const ProductList = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [products, setProducts] = useState<any[]>([]);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 400);
    const [filterMode, setFilterMode] = useState<'all' | 'expired' | 'lowStock'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Router logic
    const location = useLocation();
    const navigate = useNavigate();

    // New Product Form State
    const [formData, setFormData] = useState<{
        name: string;
        barcode: string;
        stock_quantity: number | string;
        min_stock_threshold: number | string;
        expiry_date: string;
        price: number | string;
    }>({
        name: '',
        barcode: '',
        stock_quantity: '',
        min_stock_threshold: 10,
        expiry_date: '',
        price: ''
    });

    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const fetchProducts = async (queryOverride?: string, forcedFilter?: string) => {
        setIsLoading(true);

        const term = queryOverride !== undefined ? queryOverride : debouncedSearch;
        const activeFilter = forcedFilter !== undefined ? forcedFilter : filterMode;

        try {
            if (window.api) {
                const response = await window.api.getProducts({
                    search: term,
                    filter: activeFilter === 'all' ? undefined : activeFilter,
                    limit: -1
                });

                let list: any[] = Array.isArray(response) ? response : response.products;
                const total = Array.isArray(response) ? response.length : response.total;

                if (activeFilter === 'expired') {
                    list = [...list].sort((a, b) =>
                        (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })
                    );
                }

                setProducts(list);
                setTotalCount(activeFilter === 'expired' ? list.length : total);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Initial load and filter check
    useEffect(() => {
        fetchProducts();
    }, [debouncedSearch, filterMode]);

    useEffect(() => {
        if (location.state?.filter) {
            const newFilter = location.state.filter;
            setFilterMode(newFilter);
            // Force fetch immediately with new filter value (don't wait for state update)
            fetchProducts(undefined, newFilter);
        }
    }, [location.state]);

    // Auto-focus barcode when modal opens
    useEffect(() => {
        if (isModalOpen) {
            setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 100);
        }
    }, [isModalOpen]);

    useBarcodeScanner((barcode) => {
        if (!isModalOpen) {
            setSearch(barcode);
        }
    });

    const handleOpenModal = (product?: any) => {
        if (!isAdmin) return;
        setError(null);
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                barcode: product.barcode || '',
                stock_quantity: product.stock_quantity,
                min_stock_threshold: product.min_stock_threshold,
                expiry_date: product.expiry_date || '',
                price: product.price
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', barcode: '', stock_quantity: '', min_stock_threshold: 10, expiry_date: '', price: '' });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!isAdmin) return;
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce médicament ?')) return;
        if (window.api) {
            try {
                await window.api.deleteProduct(id);
                fetchProducts();
            } catch (err: any) {
                console.error("Delete failed:", err);
                alert("Erreur lors de la suppression : " + (err.message || "Inconnue"));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (window.api && isAdmin) {
            try {
                const parsedPrice = formData.price === '' ? 0 : parseFloat(String(formData.price));
                const parsedStock = formData.stock_quantity === '' ? 0 : parseInt(String(formData.stock_quantity), 10);
                const parsedMinStock = formData.min_stock_threshold === '' ? 10 : parseInt(String(formData.min_stock_threshold), 10);
                const parsedExpiry = formData.expiry_date && formData.expiry_date.trim() !== ''
                    ? formData.expiry_date
                    : new Date(Date.now() + 365 * 2 * 86400000).toISOString().split('T')[0];

                const payload = {
                    ...formData,
                    price: isNaN(parsedPrice) ? 0 : parsedPrice,
                    stock_quantity: isNaN(parsedStock) ? 0 : parsedStock,
                    min_stock_threshold: isNaN(parsedMinStock) ? 10 : parsedMinStock,
                    expiry_date: parsedExpiry
                };

                if (editingProduct) {
                    await window.api.updateProduct({ ...payload, id: editingProduct.id });
                } else {
                    await window.api.addProduct(payload);
                }
                setIsModalOpen(false);
                setEditingProduct(null);
                setFormData({ name: '', barcode: '', stock_quantity: '', min_stock_threshold: 10, expiry_date: '', price: '' });
                fetchProducts();
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Une erreur est survenue.');
            }
        }
    };

    const handleExport = async () => {
        try {
            const result = await window.api.exportProducts();
            if (result.success) {
                alert(`Exportation réussie !\nLes produits ont été exportés vers :\n${result.filePath}`);
            } else if (result.reason !== 'canceled') {
                alert(`Erreur d'exportation : ${result.error || 'Inconnue'}`);
            }
        } catch (err: any) {
            alert(`Erreur technique : ${err.message}`);
        }
    };

    const handleImport = async () => {
        try {
            const result = await window.api.importProducts();
            if (result.success) {
                const errorMsg = result.errors ? `\n\n${result.errors.length} erreurs ignorées (voir logs).` : '';
                alert(`Importation réussie !\n${result.added} produits traités.${errorMsg}`);
                fetchProducts();
            } else if (result.reason !== 'canceled') {
                alert(`Erreur : ${result.error || 'Inconnue'}`);
            }
        } catch (err: any) {
            alert(`Erreur technique : ${err.message}`);
        }
    };

    const handleDeduplicate = async () => {
        if (!window.confirm('Fusionner tous les médicaments en double ?\n\nLes stocks seront additionnés et un seul exemplaire sera conservé.')) return;
        try {
            const result = await window.api.deduplicateProducts();
            alert(result.message);
            fetchProducts();
        } catch (err: any) {
            alert('Erreur : ' + (err.message || 'Inconnue'));
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-espresso-100">Gestion des Stocks</h1>
                    <p className="text-sm text-espresso-400">Gérez le catalogue des médicaments, prix et péremptions</p>
                </div>
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleExport}
                            className="bg-espresso-900 hover:bg-espresso-850 text-espresso-200 border border-espresso-750 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium shadow-sm"
                            title="Exporter en CSV"
                        >
                            <FileDown className="w-5 h-5 text-primary-400" />
                        </button>
                        <button
                            onClick={handleDeduplicate}
                            className="bg-espresso-900 hover:bg-amber-950/40 text-amber-400 border border-amber-800/60 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium shadow-sm"
                            title="Fusionner les médicaments en double (additionne les stocks)"
                        >
                            <Merge className="w-5 h-5" />
                            <span className="hidden sm:inline">Nettoyer doublons</span>
                        </button>
                        <button
                            onClick={handleImport}
                            className="bg-espresso-900 hover:bg-espresso-850 text-espresso-200 border border-espresso-750 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium shadow-sm"
                            title="Importer CSV: Désignation, Stock, Prix, Code-barre, Date..."
                        >
                            <Upload className="w-5 h-5 text-primary-400" />
                            <span className="hidden sm:inline">Importer CSV</span>
                        </button>
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-primary-500 hover:bg-primary-400 text-espresso-950 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-primary-500/20 font-bold"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Nouveau</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-espresso-900 p-4 rounded-2xl shadow-lg border border-espresso-750 flex items-center gap-4 shrink-0">
                <div className="flex-1 relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 w-5 h-5 ${isLoading ? 'animate-pulse text-primary-400' : ''}`} />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="w-full pl-10 pr-4 py-2 bg-espresso-850 rounded-xl border border-espresso-750 text-espresso-100 placeholder-espresso-500 focus:border-primary-400 outline-none transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                fetchProducts(search);
                            }
                        }}
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 bg-espresso-850 px-3 py-2 rounded-xl border border-espresso-750 text-espresso-300 text-xs font-bold whitespace-nowrap">
                    <Database className="w-4 h-4 text-primary-400" />
                    <span>Total: {totalCount}</span>
                </div>
            </div>

            {filterMode !== 'all' && (
                <div className={`flex justify-between items-center px-4 py-2 rounded-xl text-xs font-medium border ${
                    filterMode === 'expired'
                        ? 'bg-rose-950/30 border-rose-800/40 text-rose-400'
                        : 'bg-amber-950/30 border-amber-800/40 text-amber-400'
                }`}>
                    <span>{filterMode === 'expired' ? 'Affichage : Médicaments périmés (A→Z)' : 'Affichage : Stock faible'}</span>
                    <button
                        onClick={() => { setFilterMode('all'); navigate(location.pathname, { replace: true, state: {} }); }}
                        className="hover:underline ml-4"
                    >
                        Tout afficher
                    </button>
                </div>
            )}

            <div className="bg-espresso-900 rounded-2xl shadow-lg border border-espresso-750 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 h-full">
                    {products.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-espresso-500">
                            <Box className="w-12 h-12 mb-3 opacity-30" />
                            <p>{filterMode === 'all' ? 'Aucun médicament trouvé.' : 'Aucun produit ne correspond à ce filtre.'}</p>
                        </div>
                    ) : (
                        <TableVirtuoso
                            data={products}
                            components={{
                                Scroller: VirtuosoScroller,
                                Table: VirtuosoTable,
                                TableHead: VirtuosoTableHead,
                                TableBody: VirtuosoTableBody,
                            }}
                            fixedHeaderContent={() => (
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850 w-1/3">Désignation</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Stock</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Prix (unitaire)</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Code-barre</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Date de péremption</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Status</th>
                                    {isAdmin && <th className="px-6 py-4 text-right text-xs font-bold text-espresso-400 uppercase tracking-wider bg-espresso-850">Modification</th>}
                                </tr>
                            )}
                            itemContent={(_, product) => {
                                if (!product) return null;
                                const isExpired = product.expiry_date && new Date(product.expiry_date) <= new Date();
                                const isLowStock = product.stock_quantity <= product.min_stock_threshold;

                                return (
                                    <>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-espresso-100 break-words">{product.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${product.stock_quantity === 0 ? 'bg-espresso-800 text-espresso-500' : 'bg-primary-500/20 text-primary-300 border border-primary-500/30'}`}>
                                                {product.stock_quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-espresso-100">
                                            {product.price} <span className="text-xs font-normal text-espresso-400">FCFA</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-espresso-400 font-mono">
                                            {product.barcode}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-espresso-300">
                                            {product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {isExpired ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-900/50 text-rose-300 border border-rose-700/60">
                                                    Périmé
                                                </span>
                                            ) : isLowStock ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-900/50 text-amber-300 border border-amber-700/60">
                                                    Stock Bas
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                                                    OK
                                                </span>
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenModal(product)}
                                                    className="text-espresso-400 hover:text-primary-400 mr-3 transition-colors p-1.5 hover:bg-espresso-800 rounded-lg"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="text-espresso-400 hover:text-rose-400 transition-colors p-1.5 hover:bg-espresso-800 rounded-lg"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </>
                                )
                            }}
                        />
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-espresso-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-espresso-750"
                        >
                            <div className="p-6 border-b border-espresso-750 flex justify-between items-center bg-espresso-850">
                                <div>
                                    <h3 className="text-xl font-bold text-espresso-100">
                                        {editingProduct ? 'Modifier le Médicament' : 'Ajouter un Nouveau Médicament'}
                                    </h3>
                                    <p className="text-sm text-espresso-400 mt-1">Remplissez les informations ci-dessous.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-espresso-400 hover:text-espresso-100 p-2 hover:bg-espresso-800 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
                                {error && (
                                    <div className="mb-4 bg-rose-900/40 border border-rose-700/60 text-rose-300 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                        {error}
                                    </div>
                                )}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-espresso-200 mb-2">Nom du produit <span className="text-rose-400">*</span></label>
                                        <input required type="text" className="w-full px-4 py-2.5 bg-espresso-850 border border-espresso-700 rounded-xl text-espresso-100 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/10 outline-none transition-all placeholder-espresso-500"
                                            placeholder="Ex: Paracétamol"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-espresso-850 p-4 rounded-xl border border-espresso-750">
                                        <div>
                                            <label className="block text-sm font-semibold text-espresso-200 mb-2">Prix Unitaire <span className="text-rose-400">*</span></label>
                                            <div className="relative">
                                                <input required type="number" min="0" step="any" className="w-full pl-4 pr-12 py-2.5 bg-espresso-900 border border-espresso-700 rounded-xl text-espresso-100 focus:border-primary-400 outline-none"
                                                    placeholder="0"
                                                    value={formData.price}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-espresso-400 text-sm font-medium">FCFA</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-espresso-200 mb-2">Quantité en Stock <span className="text-rose-400">*</span></label>
                                            <input required type="number" min="0" className="w-full px-4 py-2.5 bg-espresso-900 border border-espresso-700 rounded-xl text-espresso-100 focus:border-primary-400 outline-none"
                                                placeholder="0"
                                                value={formData.stock_quantity}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-espresso-850 p-4 rounded-xl border border-espresso-750">
                                            <label className="block text-sm font-bold text-primary-300 mb-2 flex items-center gap-2">
                                                <Barcode className="w-4 h-4" />
                                                Code-barre
                                            </label>
                                            <input
                                                ref={barcodeInputRef}
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-espresso-900 border border-espresso-700 rounded-xl text-espresso-100 focus:border-primary-400 outline-none font-mono"
                                                placeholder="Scanner..."
                                                value={formData.barcode}
                                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-espresso-200 mb-2">Date Péremption <span className="text-espresso-400 font-normal">(Optionnel)</span></label>
                                            <input type="date" className="w-full px-4 py-3 bg-espresso-850 border border-espresso-700 rounded-xl text-espresso-100 focus:border-primary-400 outline-none"
                                                value={formData.expiry_date} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 border-t border-espresso-750 bg-espresso-850 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-espresso-300 hover:bg-espresso-750 rounded-xl font-medium transition-colors">
                                    Annuler
                                </button>
                                <button type="button" onClick={(e) => handleSubmit(e as any)} className="px-6 py-2.5 bg-primary-500 text-espresso-950 hover:bg-primary-400 font-bold rounded-xl shadow-lg shadow-primary-500/20 flex items-center gap-2 transition-transform active:scale-95">
                                    <Save className="w-4 h-4" />
                                    {editingProduct ? 'Enregistrer les modifications' : 'Ajouter au stock'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
