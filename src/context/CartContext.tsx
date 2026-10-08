import React, { createContext, useContext, useState } from 'react';
import { CartItem, MenuItem, Bill } from '../types/models';
import { calculateGST } from '../lib/money';

interface CartContextType {
  cart: CartItem[];
  addItem: (item: MenuItem, isHalf?: boolean) => void;
  addCustomItem: (amount: number) => void;
  increaseQty: (key: string) => void;
  decreaseQty: (key: string) => void;
  decreaseItem: (itemId: string) => void;
  clearCart: () => void;
  getItemQty: (itemId: string) => number;
  subtotal: number;
  totalCount: number;
  selectedTable: string | null;
  setSelectedTable: (table: string | null) => void;
  toastMessage: string | null;
  flash: (msg: string) => void;
  editingBill: Bill | null;
  startEditingBill: (bill: Bill) => void;
  cancelEditingBill: () => void;
}

const CartContext = createContext<CartContextType>({} as any);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const startEditingBill = (bill: Bill) => {
    setEditingBill(bill);
    setSelectedTable(bill.tableNumber || null);
    if (bill.items && bill.items.length > 0) {
      const mappedItems: CartItem[] = bill.items.map((item, idx) => ({
        key: `${item.id || item.menuItemId || idx}_${Date.now()}_${idx}`,
        itemId: item.menuItemId || item.id || `item_${idx}`,
        name: item.itemName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        isHalf: item.isHalf || false,
        lineTotal: item.lineTotal || item.unitPrice * item.quantity,
      }));
      setCart(mappedItems);
    } else {
      setCart([]);
    }
  };

  const cancelEditingBill = () => {
    setEditingBill(null);
    setSelectedTable(null);
    setCart([]);
  };

  const flash = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2200);
  };

  const getItemQty = (itemId: string): number => {
    return cart.filter(c => c.itemId === itemId).reduce((sum, c) => sum + c.quantity, 0);
  };

  const addItem = (item: MenuItem, isHalf: boolean = false) => {
    if (!item.isAvailable) {
      flash(`${item.name} is marked sold out`);
      return;
    }

    if (isHalf && (!item.hasHalf || !item.halfPrice)) {
      flash(`No half portion for ${item.name}`);
      return;
    }

    const price = isHalf ? (item.halfPrice || Math.round(item.price * 0.6)) : item.price;
    const name = isHalf ? `${item.name} (Half)` : item.name;
    const key = `${item.id}|${isHalf ? 'half' : 'full'}`;

    setCart(prev => {
      const idx = prev.findIndex(c => c.key === key);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + 1,
          lineTotal: (updated[idx].quantity + 1) * price,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            key,
            itemId: item.id,
            name,
            unitPrice: price,
            quantity: 1,
            isHalf,
            lineTotal: price,
          },
        ];
      }
    });

    if (isHalf) {
      flash(`Half ${item.name}: ₹${price}`);
    }
  };

  const addCustomItem = (amount: number) => {
    const key = `custom_${Date.now()}`;
    setCart(prev => [
      ...prev,
      {
        key,
        itemId: key,
        name: `Other ₹${amount}`,
        unitPrice: amount,
        quantity: 1,
        isHalf: false,
        lineTotal: amount,
      },
    ]);
  };

  const increaseQty = (key: string) => {
    setCart(prev =>
      prev.map(item =>
        item.key === key
          ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
          : item
      )
    );
  };

  const decreaseQty = (key: string) => {
    setCart(prev =>
      prev
        .map(item =>
          item.key === key
            ? { ...item, quantity: item.quantity - 1, lineTotal: (item.quantity - 1) * item.unitPrice }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const decreaseItem = (itemId: string) => {
    setCart(prev => {
      let targetIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].itemId === itemId) {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx === -1) return prev;

      const target = prev[targetIdx];
      if (target.quantity > 1) {
        const updated = [...prev];
        updated[targetIdx] = {
          ...target,
          quantity: target.quantity - 1,
          lineTotal: (target.quantity - 1) * target.unitPrice,
        };
        return updated;
      } else {
        return prev.filter((_, idx) => idx !== targetIdx);
      }
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        addCustomItem,
        increaseQty,
        decreaseQty,
        decreaseItem,
        clearCart,
        getItemQty,
        subtotal,
        totalCount,
        selectedTable,
        setSelectedTable,
        toastMessage,
        flash,
        editingBill,
        startEditingBill,
        cancelEditingBill,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
