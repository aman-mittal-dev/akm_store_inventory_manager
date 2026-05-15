import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import {
  InventoryItem,
  InventoryContextType,
  IncomingTransaction,
  OutgoingTransaction,
  NewInventoryItemInput,
  StoreSettings,
} from '../types';
import {
  createIncomingTransactionApi,
  createItemApi,
  createOutgoingTransactionApi,
  deleteItemApi,
  getItemsApi,
  getTransactionsApi,
  mapIncomingTransaction,
  mapOutgoingTransaction,
  updateItemApi,
} from '../services/inventoryService';
import { humanizeApiError } from '../utils/apiErrors';

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const initialStoreSettings: StoreSettings = {
  storeName: 'Store Inventory Manager',
  gstNumber: '29XXXXX1234X1ZX',
  address: '123 Main Street, City, State - 560001',
  phone: '+91 9876543210',
  email: 'store@example.com',
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [incomingTransactions, setIncomingTransactions] = useState<IncomingTransaction[]>([]);
  const [outgoingTransactions, setOutgoingTransactions] = useState<OutgoingTransaction[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(initialStoreSettings);

  const loadData = async () => {
    try {
      const [fetchedItems, fetchedTransactions] = await Promise.all([
        getItemsApi(),
        getTransactionsApi(),
      ]);
      setItems(fetchedItems);
      setIncomingTransactions(
        fetchedTransactions
          .filter((tx) => tx.transactionType === 'incoming')
          .map(mapIncomingTransaction),
      );
      setOutgoingTransactions(
        fetchedTransactions
          .filter((tx) => tx.transactionType === 'outgoing')
          .map(mapOutgoingTransaction),
      );
    } catch (error) {
      setItems([]);
      setIncomingTransactions([]);
      setOutgoingTransactions([]);
      toast.error(humanizeApiError(error, 'Could not load inventory or transactions.'));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addItem = async (item: NewInventoryItemInput): Promise<InventoryItem> => {
    try {
      const created = await createItemApi(item);
      setItems((prev) => [created, ...prev]);
      toast.success('Item added successfully.');
      return created;
    } catch (error) {
      const msg = humanizeApiError(error, 'Could not add this item.');
      toast.error(msg);
      throw error;
    }
  };

  const updateItem = async (id: string, updatedData: Partial<InventoryItem>): Promise<InventoryItem> => {
    try {
      const updated = await updateItemApi(id, updatedData);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      toast.success('Item updated successfully.');
      return updated;
    } catch (error) {
      const msg = humanizeApiError(error, 'Could not update this item.');
      toast.error(msg);
      throw error;
    }
  };

  const deleteItem = async (id: string): Promise<void> => {
    try {
      await deleteItemApi(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Item removed from inventory.');
    } catch (error) {
      const msg = humanizeApiError(error, 'Could not delete this item.');
      toast.error(msg);
      throw error;
    }
  };

  const getItemById = (id: string) => {
    return items.find((item) => item.id === id);
  };

  const addIncomingTransaction = (transaction: Omit<IncomingTransaction, 'id'>) => {
    void createIncomingTransactionApi(transaction)
      .then(() => {
        toast.success('Purchase saved successfully.');
        return loadData();
      })
      .catch((error) => {
        toast.error(humanizeApiError(error, 'Could not save this purchase.'));
      });
  };

  const addOutgoingTransaction = (transaction: Omit<OutgoingTransaction, 'id'>) => {
    void createOutgoingTransactionApi(transaction)
      .then(() => {
        toast.success('Sale recorded successfully.');
        return loadData();
      })
      .catch((error) => {
        toast.error(humanizeApiError(error, 'Could not record this sale.'));
      });
  };

  const updateIncomingTransaction = (id: string, updatedData: Partial<IncomingTransaction>) => {
    setIncomingTransactions(
      incomingTransactions.map((transaction) =>
        transaction.id === id ? { ...transaction, ...updatedData } : transaction,
      ),
    );
  };

  const updateOutgoingTransaction = (id: string, updatedData: Partial<OutgoingTransaction>) => {
    setOutgoingTransactions(
      outgoingTransactions.map((transaction) =>
        transaction.id === id ? { ...transaction, ...updatedData } : transaction,
      ),
    );
  };

  const getTransactionsByItemId = (itemId: string) => {
    return {
      incoming: incomingTransactions.filter((t) => t.items.some((i) => i.itemId === itemId)),
      outgoing: outgoingTransactions.filter((t) => t.items.some((i) => i.itemId === itemId)),
    };
  };

  const updateStoreSettings = (settings: Partial<StoreSettings>) => {
    setStoreSettings((prev) => ({ ...prev, ...settings }));
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        incomingTransactions,
        outgoingTransactions,
        storeSettings,
        addItem,
        updateItem,
        deleteItem,
        getItemById,
        addIncomingTransaction,
        addOutgoingTransaction,
        updateIncomingTransaction,
        updateOutgoingTransaction,
        getTransactionsByItemId,
        updateStoreSettings,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
