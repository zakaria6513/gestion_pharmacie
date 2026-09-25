export interface Product {
    id: number;
    name: string;
    dosage?: string;
    barcode?: string;
    stock_quantity: number;
    expiry_date: string;
    price: number;
    min_stock_threshold: number;
    created_at?: string;
}

export interface User {
    id: number;
    username: string;
    role: 'admin' | 'employee';
    created_at?: string;
}

export interface SaleItem {
    product_id: number;
    name: string;
    dosage?: string;
    barcode?: string;
    quantity: number;
    price_at_sale: number;
}

export interface Sale {
    id: number;
    sale_date: string;
    total_amount: number;
    cashier_name: string;
    items: SaleItem[];
}

export interface IElectronAPI {
    login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; user?: User; message?: string }>;
    printReceipt: (htmlContent: string) => Promise<{ success: boolean; error?: string }>;
    getDashboardStats: () => Promise<{ totalProducts: number; lowStock: number; expired: number; totalRevenue: number }>;
    getProducts: (params?: { search?: string; filter?: string; limit?: number; offset?: number }) => Promise<Product[] | { products: Product[]; total: number }>;
    addProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<{ id: number }>;
    updateProduct: (product: Product) => Promise<{ changes: number }>;
    deleteProduct: (id: number) => Promise<{ changes: number }>;
    createSale: (saleData: { userId: number; items: { productId: number; quantity: number }[]; total: number }) => Promise<number>;
    getSalesHistory: (filters?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) => Promise<Sale[]>;
    getSalesTotal: (filters?: { startDate?: string; endDate?: string }) => Promise<number>;
    updateSale: (data: { saleId: number; items: { product_id: number; quantity: number }[] }) => Promise<{ success: boolean; message?: string }>;
    deleteSale: (saleId: number) => Promise<{ success: boolean; message?: string }>;
    getSalesChart: () => Promise<{ date: string; total: number }[]>;
    getTopProducts: () => Promise<{ name: string; total_sold: number }[]>;
    exportSalesHistory: (filters?: { startDate?: string; endDate?: string }) => Promise<{ success: boolean; filePath?: string; error?: string; reason?: string }>;

    // User Management
    getUsers: () => Promise<User[]>;
    addUser: (user: Omit<User, 'id' | 'created_at'> & { password: string }) => Promise<{ id: number }>;
    updateUser: (user: Partial<User> & { id: number; password?: string }) => Promise<{ changes: number }>;
    deleteUser: (id: number) => Promise<{ changes: number }>;
    backupDb: () => Promise<{ success: boolean; filePath?: string; error?: string; reason?: string }>;
    restoreDb: () => Promise<{ success: boolean; error?: string; reason?: string }>;
    importProducts: () => Promise<{ success: boolean; added?: number; errors?: string[]; error?: string; reason?: string }>;
    downloadTemplate: () => Promise<{ success: boolean; filePath?: string; error?: string; reason?: string }>;
    exportProducts: () => Promise<{ success: boolean; filePath?: string; error?: string; reason?: string }>;
    deduplicateProducts: () => Promise<{ success: boolean; merged: number; message: string }>;
}

declare global {
    interface Window {
        api: IElectronAPI;
    }
}
