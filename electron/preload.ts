import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    login: (credentials: any) => ipcRenderer.invoke('login', credentials),
    printReceipt: (htmlContent: string) => ipcRenderer.invoke('print-receipt', htmlContent),
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    getProducts: (params?: any) => ipcRenderer.invoke('get-products', params),
    addProduct: (product: any) => ipcRenderer.invoke('add-product', product),
    updateProduct: (product: any) => ipcRenderer.invoke('update-product', product),
    deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
    createSale: (saleData: any) => ipcRenderer.invoke('create-sale', saleData),
    getSalesHistory: (filters?: any) => ipcRenderer.invoke('get-sales-history', filters),
    getSalesTotal: (filters?: any) => ipcRenderer.invoke('get-sales-total', filters),
    getSalesChart: () => ipcRenderer.invoke('get-sales-chart'),
    getTopProducts: () => ipcRenderer.invoke('get-top-products'),
    exportSalesHistory: (filters?: any) => ipcRenderer.invoke('export-sales-history', filters),
    updateSale: (data: any) => ipcRenderer.invoke('update-sale', data),
    deleteSale: (saleId: number) => ipcRenderer.invoke('delete-sale', saleId),

    // User Management
    getUsers: () => ipcRenderer.invoke('get-users'),
    addUser: (user: any) => ipcRenderer.invoke('add-user', user),
    updateUser: (user: any) => ipcRenderer.invoke('update-user', user),
    deleteUser: (id: number) => ipcRenderer.invoke('delete-user', id),
    backupDb: () => ipcRenderer.invoke('backup-db'),
    restoreDb: () => ipcRenderer.invoke('restore-db'),
    getBackupStatus: () => ipcRenderer.invoke('get-backup-status'),
    importProducts: () => ipcRenderer.invoke('import-products'),
    downloadTemplate: () => ipcRenderer.invoke('download-template'),
    exportProducts: () => ipcRenderer.invoke('export-products'),
    deduplicateProducts: () => ipcRenderer.invoke('deduplicate-products'),
});
