import React, { useState, useEffect, useRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { Search, ShoppingCart, Plus, Minus, CreditCard, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

import { useDebounce } from '../hooks/useDebounce';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export const POS = () => {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 400); // 400ms wait for typing
    const [products, setProducts] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<number | null>(null);
    const [lastCartSnapshot, setLastCartSnapshot] = useState<any[]>([]);
    const [lastTotal, setLastTotal] = useState(0);
    const [lastCashier, setLastCashier] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    // Fetch Products (All at once)
    const fetchProducts = async (queryOverride?: string) => {
        setError(null);
        const term = queryOverride !== undefined ? queryOverride : debouncedSearch;

        try {
            if (window.api) {
                // Limit 50 results for instant response and ultra-low RAM usage
                const response = await window.api.getProducts({
                    search: term,
                    limit: 50
                });

                let resultList: any[] = [];
                if (Array.isArray(response)) {
                    resultList = response;
                } else {
                    resultList = response.products;
                }
                setProducts(resultList);
                return resultList;
            }
        } catch (err: any) {
            console.error("Failed to fetch products:", err);
            setError("Erreur de chargement des produits. Veuillez réessayer.");
            return [];
        }
    };

    // Trigger search when debounced value changes
    useEffect(() => {
        fetchProducts();
    }, [debouncedSearch]);

    // Focus search on mount
    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    const addToCart = (product: any) => {
        let isExpired = false;
        try { if (product.expiry_date) isExpired = new Date(product.expiry_date) <= new Date(); } catch (e) { }

        const stock = Number(product.stock_quantity) || 0;
        if (stock <= 0 || isExpired) return;

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.cartQuantity >= (Number(product.stock_quantity) || 0)) return prev;
                return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
            }
            return [...prev, { ...product, cartQuantity: 1 }];
        });
        setSearch(''); // Clear search after adding (useful for scanners)
        searchInputRef.current?.focus();
    };

    useBarcodeScanner(async (barcode) => {
        setSearch(barcode);
        const results = await fetchProducts(barcode);
        if (results && results.length === 1) {
            addToCart(results[0]);
        }
    });

    const updateQuantity = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.cartQuantity + delta;
                if (newQty <= 0) return null;
                if (newQty > (Number(item.stock_quantity) || 0)) return item;
                return { ...item, cartQuantity: newQty };
            }
            return item;
        }).filter(Boolean) as any[]);
    };

    const total = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * item.cartQuantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0 || !window.api) return;
        setIsProcessing(true);
        setCheckoutError(null);
        // Snapshot cart BEFORE clearing so we can print later if needed
        const cartSnapshot = [...cart];
        const totalSnapshot = total;
        const cashierName = user?.username || 'Employe';
        try {
            const saleData = {
                userId: user?.id || 0,
                items: cartSnapshot.map(item => ({ productId: item.id, quantity: item.cartQuantity, price: item.price })),
                total: totalSnapshot
            };
            const saleId = await window.api.createSale(saleData);
            const saleIdNum = typeof saleId === 'bigint' ? Number(saleId) : saleId;
            // Save snapshot for optional printing
            setLastSaleId(saleIdNum);
            setLastCartSnapshot(cartSnapshot);
            setLastTotal(totalSnapshot);
            setLastCashier(cashierName);
            setCart([]);
            // Refresh product stocks
            fetchProducts();
            // NO automatic print — user chooses to print
        } catch (err: any) {
            console.error('Checkout error:', err);
            const msg = err?.message || 'Erreur inconnue lors de la vente.';
            setCheckoutError(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const printReceipt = async (saleId: number, items: any[], total: number, cashier: string) => {
        // Escape HTML special chars to prevent XSS in the print window
        const escHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const receiptContent = `
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { margin: 0; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body {
                        width: 78mm;
                        margin: 0 auto;
                        padding: 0;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 18px;
                        padding: 10px 8px;
                        color: #000;
                        background: #fff;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .bold { font-weight: 900; }
                    .large { font-size: 24px; font-weight: 900; }
                    .small { font-size: 15px; }
                    .italic { font-style: italic; }
                    .mt { margin-top: 8px; }
                    .mb { margin-bottom: 8px; }
                    .cross {
                        display: inline-block;
                        width: 38px; height: 38px;
                        border-radius: 50%;
                        background: #000;
                        color: #fff;
                        font-size: 24px;
                        line-height: 38px;
                        text-align: center;
                        font-weight: bold;
                        margin-bottom: 6px;
                    }
                    .divider { border-top: 2px solid #000; margin: 8px 0; }
                    .dashed { border-top: 2px dashed #000; margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; color: #000; }
                    th { font-size: 15px; font-weight: 900; padding: 4px 0; border-bottom: 2px solid #000; color: #000; }
                    td { padding: 4px 0; font-size: 16px; vertical-align: top; color: #000; }
                    .col-name { width: 46%; font-weight: 900; }
                    .col-name strong { font-weight: 900; font-size: 17px; }
                    .col-qty  { width: 10%; text-align: center; }
                    .col-pu   { width: 20%; text-align: right; }
                    .col-tot  { width: 24%; text-align: right; }
                    .total-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 18px; color: #000; }
                    .total-line.big { font-size: 24px; font-weight: 900; color: #000; }
                    .footer { margin-top: 12px; text-align: center; font-size: 15px; color: #000; }
                </style>
            </head>
            <body>
                <div class="center mb">
                    <div class="cross">+</div>
                    <div class="bold large">PHARMACIE AMDJARASS</div>
                    <div class="small mt">KLEMAT, Amdjarass</div>
                </div>

                <div class="divider"></div>

                <div class="center bold mt mb" style="font-size:17px; letter-spacing:1px;">
                    ** RECU DE VENTE **
                </div>

                <div class="dashed"></div>

                <table>
                    <tr>
                        <td>Date: ${dateStr} ${timeStr}</td>
                        <td class="right">Reçu #${saleId}</td>
                    </tr>
                    <tr>
                        <td>Caissier: <strong>${cashier}</strong></td>
                    </tr>
                </table>

                <div class="dashed"></div>

                <table>
                    <thead>
                        <tr>
                            <th class="col-name" style="text-align:left;">PRODUIT</th>
                            <th class="col-qty">QTÉ</th>
                            <th class="col-pu">P.U</th>
                            <th class="col-tot">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td class="col-name" style="font-weight:900; font-family:'Arial Black',Arial,sans-serif; font-size:17px;"><b>${escHtml(item.name)}</b></td>
                                <td class="col-qty">${item.cartQuantity}</td>
                                <td class="col-pu">${(item.price || 0).toLocaleString('fr-FR')}</td>
                                <td class="col-tot bold">${((item.price || 0) * item.cartQuantity).toLocaleString('fr-FR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="dashed"></div>

                <div class="total-line" style="font-size:17px;">
                    <span>Articles</span>
                    <span>${items.reduce((s, i) => s + i.cartQuantity, 0)}</span>
                </div>

                <div class="dashed"></div>

                <div class="total-line big">
                    <span>TOTAL</span>
                    <span>${total.toLocaleString('fr-FR')} FCFA</span>
                </div>

                <div class="dashed"></div>

                <div class="footer italic">
                    <div class="bold" style="font-size:16px;">Merci pour votre confiance !</div>
                    <div class="mt">Bonne sante a vous !</div>
                    <div class="mt small">Pharmacie Amdjarass &mdash; Amdjarass</div>
                </div>
            </body>
            </html>
        `;

        if (window.api && window.api.printReceipt) {
            try {
                await window.api.printReceipt(receiptContent);
            } catch (err: any) {
                console.error("Native printing failed:", err);
                alert("Erreur lors du lancement de l'impression : " + (err.message || err));
            }
        } else {
            alert("L'impression n'est pas prise en charge dans ce mode.");
        }
    };


    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Left: Product List */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="bg-espresso-900 p-4 rounded-xl shadow-lg border border-espresso-750 flex items-center gap-4">
                    <Search className="text-espresso-400 w-5 h-5" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Scanner code-barre ou taper nom..."
                        className="w-full bg-transparent outline-none text-lg text-espresso-100 placeholder-espresso-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                const results = await fetchProducts(search);
                                if (results && results.length === 1) {
                                    addToCart(results[0]);
                                }
                            }
                        }}
                    />
                </div>

                <div className="flex-1 overflow-hidden bg-espresso-900 rounded-xl shadow-lg border border-espresso-750 p-2">
                    {products.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-espresso-500">
                            {error ? <p className="text-rose-400">{error}</p> : <p>Aucun produit trouvé</p>}
                        </div>
                    ) : (
                        <VirtuosoGrid
                            style={{ height: '100%' }}
                            data={products}
                            components={{
                                List: React.forwardRef((props, ref) => <div {...props} ref={ref} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pb-2" />),
                                Item: ({ children, ...props }) => <div {...props} className="p-0.5">{children}</div>
                            }}
                            itemContent={(_, product) => {
                                if (!product) return null;

                                let isExpired = false;
                                try {
                                    if (product.expiry_date) {
                                        isExpired = new Date(product.expiry_date) <= new Date();
                                    }
                                } catch (e) { console.warn('Invalid date for product', product.name); }

                                const isOutOfStock = (product.stock_quantity || 0) <= 0;
                                const isDisabled = isOutOfStock || isExpired;
                                const price = Number(product.price) || 0;

                                return (
                                    <button
                                        onClick={() => addToCart(product)}
                                        disabled={isDisabled}
                                        className={`w-full p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col h-32 justify-between ${isDisabled
                                            ? 'opacity-50 cursor-not-allowed bg-espresso-950 border-espresso-800'
                                            : 'bg-espresso-850 border-espresso-750 hover:bg-espresso-800 hover:border-primary-400/50 shadow-sm'
                                            } ${isExpired ? 'border-rose-700/60 bg-rose-950/30' : ''}`}
                                    >
                                        {isExpired && (
                                            <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">
                                                PÉRIMÉ
                                            </div>
                                        )}
                                        <div className="font-medium text-espresso-100 line-clamp-2 mb-2 leading-tight">{product.name || 'Nom inconnu'}</div>

                                        <div className="flex justify-between items-end w-full mt-auto">
                                            <div className="font-bold text-primary-400">{price} <span className="text-xs text-espresso-400">FCFA</span></div>
                                            <div className={`text-xs px-2 py-1 rounded shadow-sm border ${isOutOfStock ? 'bg-espresso-800 text-espresso-500 border-espresso-700' : 'bg-espresso-800 text-espresso-200 border-espresso-700'
                                                }`}>
                                                {isOutOfStock ? 'Épuisé' : `${product.stock_quantity || 0}`}
                                            </div>
                                        </div>
                                    </button>
                                );
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Right: Cart */}
            <div className="w-96 bg-espresso-900 rounded-xl shadow-2xl border border-espresso-750 flex flex-col overflow-hidden">
                <div className="p-4 bg-espresso-850 border-b border-espresso-750 text-espresso-100 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-primary-400" />
                        Panier Actuel
                    </h2>
                    <span className="bg-espresso-750 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary-300">{cart.length} articles</span>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3">
                    <AnimatePresence>
                        {cart.length === 0 ? (
                            <div className="text-center text-espresso-500 mt-10">
                                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Le panier est vide</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex justify-between items-center p-3 bg-espresso-850 rounded-xl border border-espresso-750"
                                >
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="font-medium text-sm truncate text-espresso-100">{item.name}</div>
                                        <div className="text-xs text-espresso-400">{item.price} FCFA</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-espresso-750 rounded-lg text-espresso-300 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                        <span className="w-6 text-center text-sm font-semibold text-espresso-100">{item.cartQuantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-espresso-750 rounded-lg text-espresso-300 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-6 bg-espresso-850 border-t border-espresso-750">
                    {/* Show total + validate button when cart has items */}
                    {cart.length > 0 && (
                        <>
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-espresso-400">Total à payer</span>
                                <span className="text-3xl font-bold text-espresso-100">{total.toLocaleString()} <span className="text-sm text-espresso-400 font-normal">FCFA</span></span>
                            </div>
                            {checkoutError && (
                                <div className="mb-3 bg-rose-900/40 border border-rose-700/60 text-rose-300 px-3 py-2 rounded-xl text-sm font-medium">
                                    ⚠️ {checkoutError}
                                </div>
                            )}
                            <button
                                onClick={handleCheckout}
                                disabled={isProcessing}
                                className="w-full bg-primary-500 hover:bg-primary-400 disabled:bg-espresso-800 disabled:text-espresso-600 disabled:cursor-not-allowed text-espresso-950 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-all"
                            >
                                {isProcessing
                                    ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-espresso-950"></div>
                                    : <><CreditCard className="w-6 h-6" /> Valider la Vente</>}
                            </button>
                        </>
                    )}

                    {/* After sale success — cart is empty */}
                    {lastSaleId && cart.length === 0 && !checkoutError && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-center gap-2 py-3 bg-primary-500/20 border border-primary-500/30 rounded-xl text-primary-300 font-bold">
                                <CheckCircle className="w-5 h-5 text-primary-400" />
                                Vente #{lastSaleId} validée !
                            </div>
                            <button
                                onClick={() => printReceipt(lastSaleId!, lastCartSnapshot, lastTotal, lastCashier)}
                                className="w-full bg-espresso-800 hover:bg-espresso-750 border border-espresso-700 text-espresso-100 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-md"
                            >
                                🖨️ Imprimer le reçu
                            </button>
                            <button
                                onClick={() => { setLastSaleId(null); setCheckoutError(null); searchInputRef.current?.focus(); }}
                                className="w-full bg-espresso-750 hover:bg-espresso-700 border border-espresso-600 text-espresso-100 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                + Nouvelle vente
                            </button>
                        </div>
                    )}

                    {/* Error with empty cart */}
                    {checkoutError && cart.length === 0 && (
                        <div className="bg-rose-900/40 border border-rose-700/60 text-rose-300 px-3 py-3 rounded-xl text-sm font-medium">
                            ⚠️ {checkoutError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
