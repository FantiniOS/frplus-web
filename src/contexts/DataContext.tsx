'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Toast, ToastType } from '@/components/ui/Toast';

// --- Types ---
export interface Client {
    id: string;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    inscricaoEstadual?: string;
    email: string;
    telefone: string;
    celular: string;
    endereco: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    // Backward compatibility
    nome?: string;
    uf?: string;
    numero?: string;
    status?: string;
    limiteCredito?: number;
    observacoes?: string;
    tabelaPreco?: string;
    ultima_compra?: string;
}

export interface Fabrica {
    id: string;
    nome: string;
    produtosCount?: number;
}

export interface Product {
    id: string;
    codigo: string;
    nome: string;
    preco50a199: number;
    preco200a699: number;
    precoAtacado: number;
    precoAtacadoAVista: number;
    precoRedes: number;
    imagem?: string;
    imagemUrl?: string; // Alias for backward compatibility
    fabricaId: string;
    fabricaNome?: string;
    categoria?: string;
    // Backward compatibility
    unidade?: string;
    descricao?: string;
}

export interface OrderItem {
    id?: string;
    produtoId: string;
    nomeProduto: string;
    quantidade: number;
    precoUnitario: number;
    total: number;
}

export interface Order {
    id: string;
    clienteId: string;
    nomeCliente: string;
    fabricaId?: string;
    data: string;
    status: string;
    valorTotal: number;
    tabelaPreco: string;
    condicaoPagamento: string;
    observacoes?: string;
    itens: OrderItem[];
}

interface DashboardStats {
    totalSales: number;
    totalOrders: number;
    newClients: number;
    totalProducts: number;
}

interface DataContextType {
    // Data
    clients: Client[];
    products: Product[];
    orders: Order[];
    fabricas: Fabrica[];
    loading: boolean;

    // Client CRUD
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (id: string, client: Partial<Client>) => Promise<void>;
    removeClient: (id: string) => Promise<void>;

    // Product CRUD
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    removeProduct: (id: string) => Promise<void>;

    // Order CRUD
    addOrder: (order: Omit<Order, 'id'>) => Promise<void>;
    updateOrder: (id: string, order: Partial<Order>) => Promise<void>;
    removeOrder: (id: string) => Promise<void>;

    // Fabrica CRUD
    addFabrica: (fabrica: Omit<Fabrica, 'id'>) => Promise<void>;
    updateFabrica: (id: string, fabrica: Partial<Fabrica>) => Promise<void>;
    removeFabrica: (id: string) => Promise<void>;

    // Dashboard
    getDashboardStats: () => DashboardStats;

    // Toast
    showToast: (message: string, type: ToastType) => void;

    // Auth (mock for now)
    user: string | null;
    login: (email: string) => void;
    logout: () => void;

    // Refresh
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [fabricas, setFabricas] = useState<Fabrica[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<string | null>(null);

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = useCallback((message: string, type: ToastType) => {
        setToast({ message, type });
    }, []);

    const closeToast = () => setToast(null);

    // Fetch all data from APIs
    const refreshData = useCallback(async () => {
        setLoading(true);
        try {
            const [clientsRes, productsRes, ordersRes, fabricasRes] = await Promise.all([
                fetch('/api/clients'),
                fetch('/api/products'),
                fetch('/api/orders'),
                fetch('/api/fabricas')
            ]);

            if (clientsRes.ok) setClients(await clientsRes.json());
            if (productsRes.ok) setProducts(await productsRes.json());
            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (fabricasRes.ok) setFabricas(await fabricasRes.json());
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Erro ao carregar dados', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // Load data on mount
    useEffect(() => {
        refreshData();
        // Check auth
        const savedUser = localStorage.getItem('frplus_user');
        if (savedUser) setUser(savedUser);
    }, [refreshData]);

    // --- Client CRUD ---
    const addClient = async (client: Omit<Client, 'id'>) => {
        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
            if (res.ok) {
                const newClient = await res.json();
                setClients(prev => [...prev, newClient]);
                showToast('Cliente cadastrado com sucesso!', 'success');
            } else {
                showToast('Erro ao cadastrar cliente', 'error');
            }
        } catch (error) {
            console.error('Error adding client:', error);
            showToast('Erro ao cadastrar cliente', 'error');
        }
    };

    const updateClient = async (id: string, data: Partial<Client>) => {
        try {
            const res = await fetch(`/api/clients/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedClient = await res.json();
                setClients(prev => prev.map(c => c.id === id ? updatedClient : c));
                showToast('Cliente atualizado com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error updating client:', error);
            showToast('Erro ao atualizar cliente', 'error');
        }
    };

    const removeClient = async (id: string) => {
        try {
            const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setClients(prev => prev.filter(c => c.id !== id));
                showToast('Cliente excluído com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error removing client:', error);
            showToast('Erro ao excluir cliente', 'error');
        }
    };

    // --- Product CRUD ---
    const addProduct = async (product: Omit<Product, 'id'>) => {
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (res.ok) {
                await refreshData(); // Refresh to get fabricaNome
                showToast('Produto cadastrado com sucesso!', 'success');
            } else {
                showToast('Erro ao cadastrar produto', 'error');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            showToast('Erro ao cadastrar produto', 'error');
        }
    };

    const updateProduct = async (id: string, data: Partial<Product>) => {
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                await refreshData();
                showToast('Produto atualizado com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            showToast('Erro ao atualizar produto', 'error');
        }
    };

    const removeProduct = async (id: string) => {
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProducts(prev => prev.filter(p => p.id !== id));
                showToast('Produto excluído com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error removing product:', error);
            showToast('Erro ao excluir produto', 'error');
        }
    };

    // --- Order CRUD ---
    const addOrder = async (order: Omit<Order, 'id'>) => {
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });
            if (res.ok) {
                await refreshData();
                showToast('Pedido cadastrado com sucesso!', 'success');
            } else {
                showToast('Erro ao cadastrar pedido', 'error');
            }
        } catch (error) {
            console.error('Error adding order:', error);
            showToast('Erro ao cadastrar pedido', 'error');
        }
    };

    const updateOrder = async (id: string, data: Partial<Order>) => {
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                await refreshData();
                showToast('Pedido atualizado com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error updating order:', error);
            showToast('Erro ao atualizar pedido', 'error');
        }
    };

    const removeOrder = async (id: string) => {
        try {
            const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setOrders(prev => prev.filter(o => o.id !== id));
                showToast('Pedido excluído com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error removing order:', error);
            showToast('Erro ao excluir pedido', 'error');
        }
    };

    // --- Fabrica CRUD ---
    const addFabrica = async (fabrica: Omit<Fabrica, 'id'>) => {
        try {
            const res = await fetch('/api/fabricas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fabrica)
            });
            if (res.ok) {
                const newFabrica = await res.json();
                setFabricas(prev => [...prev, newFabrica]);
                showToast('Fábrica cadastrada com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error adding fabrica:', error);
            showToast('Erro ao cadastrar fábrica', 'error');
        }
    };

    const updateFabrica = async (id: string, data: Partial<Fabrica>) => {
        try {
            const res = await fetch(`/api/fabricas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                await refreshData();
                showToast('Fábrica atualizada com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error updating fabrica:', error);
            showToast('Erro ao atualizar fábrica', 'error');
        }
    };

    const removeFabrica = async (id: string) => {
        try {
            const res = await fetch(`/api/fabricas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setFabricas(prev => prev.filter(f => f.id !== id));
                showToast('Fábrica excluída com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error removing fabrica:', error);
            showToast('Erro ao excluir fábrica', 'error');
        }
    };

    // --- Auth (mock) ---
    const login = (email: string) => {
        setUser(email);
        localStorage.setItem('frplus_user', email);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('frplus_user');
    };

    // --- Dashboard Stats ---
    const getDashboardStats = (): DashboardStats => {
        return {
            totalSales: orders.reduce((acc, o) => acc + o.valorTotal, 0),
            totalOrders: orders.length,
            newClients: clients.length,
            totalProducts: products.length
        };
    };

    return (
        <DataContext.Provider
            value={{
                clients,
                products,
                orders,
                fabricas,
                loading,
                addClient,
                updateClient,
                removeClient,
                addProduct,
                updateProduct,
                removeProduct,
                addOrder,
                updateOrder,
                removeOrder,
                addFabrica,
                updateFabrica,
                removeFabrica,
                getDashboardStats,
                showToast,
                user,
                login,
                logout,
                refreshData
            }}
        >
            {children}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={closeToast}
                />
            )}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
