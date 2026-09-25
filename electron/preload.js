"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    login: (credentials) => electron_1.ipcRenderer.invoke('login', credentials),
    getDashboardStats: () => electron_1.ipcRenderer.invoke('get-dashboard-stats'),
    getProducts: (search) => electron_1.ipcRenderer.invoke('get-products', { search }),
    addProduct: (product) => electron_1.ipcRenderer.invoke('add-product', product),
    createSale: (saleData) => electron_1.ipcRenderer.invoke('create-sale', saleData),
    getSalesHistory: () => electron_1.ipcRenderer.invoke('get-sales-history'),
});
