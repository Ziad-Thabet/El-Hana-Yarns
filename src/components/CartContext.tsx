import { createContext, useState, useCallback, ReactNode } from "react";
import { CartItemModel } from "@/lib/domain";
import type { CartItem, Product } from "@/lib/types";
export interface AddToCartResult {
  ok: boolean;
  available?: number;
}
export interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product, amount: number) => AddToCartResult;
  updateQuantity: (id: string, qty: number) => boolean;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
}
export const CartContext = createContext<CartContextValue | null>(null);
function getInCartAmount(cart: CartItem[], productId: string): number {
  return cart.reduce((sum, i) => {
    if (i.productId !== productId) return sum;
    return sum + (i.isWeighted ? (i.measureAmount ?? 0) : i.quantity);
  }, 0);
}

const STOCK_EPSILON = 0.0001;
const CART_STORAGE_KEY = "el-hana-cart-draft";

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveCartToStorage(cart: CartItem[]) {
  try {
    if (cart.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  } catch {}
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => loadCartFromStorage());

  const setCartPersisted = useCallback(
    (updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      setCart((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveCartToStorage(next);
        return next;
      });
    },
    [],
  );

  const addToCart = useCallback(
    (product: Product, amount: number): AddToCartResult => {
      let result: AddToCartResult = { ok: true };
      setCartPersisted((prev) => {
        const already = getInCartAmount(prev, product.id);
        const remaining = Math.max(0, product.stock - already);

        if (product.stock <= 0 || amount > remaining + STOCK_EPSILON) {
          result = { ok: false, available: Math.round(remaining * 100) / 100 };
          return prev;
        }
        if (product.unit === "piece") {
          const existing = prev.find(
            (i) => i.productId === product.id && !i.isWeighted,
          );
          if (existing) {
            return prev.map((i) =>
              i.id === existing.id
                ? {
                    ...i,
                    quantity: i.quantity + amount,
                    lineTotal: parseFloat(
                      (i.price * (i.quantity + amount)).toFixed(2),
                    ),
                  }
                : i,
            );
          }
        }
        return [...prev, CartItemModel.createFromProduct(product, amount)];
      });
      return result;
    },
    [setCartPersisted],
  );
  const updateQuantity = useCallback(
    (id: string, qty: number): boolean => {
      let ok = true;
      setCartPersisted((prev) =>
        prev.flatMap((i) => {
          if (i.id !== id) return [i];
          if (qty <= 0) return [];
          const max = i.stock ?? Infinity;
          if (qty > max) {
            ok = false;
            return [i];
          }
          return [
            {
              ...i,
              quantity: qty,
              lineTotal: parseFloat((i.price * qty).toFixed(2)),
            },
          ];
        }),
      );
      return ok;
    },
    [setCartPersisted],
  );
  const removeItem = useCallback(
    (id: string) => setCartPersisted((prev) => prev.filter((i) => i.id !== id)),
    [setCartPersisted],
  );
  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_STORAGE_KEY);
    setCart([]);
  }, []);
  const total = cart.reduce(
    (sum, item) => sum + CartItemModel.from(item).lineTotal,
    0,
  );
  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
