export type UnitType = "piece" | "weight" | "meter";

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  imageUrl?: string;
  category?: string;
  unit: UnitType;
  pricePerKg?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  isWeighted?: boolean;
  weightGrams?: number;
  measureAmount?: number;
  measureUnit?: string;
  pricePerKg?: number;
  lineTotal?: number;
  stock?: number;
}

export interface InvoiceItem {
  id?: string;
  productName: string;
  barcode: string;
  quantity: number;
  unit: UnitType;
  purchasePrice: number;
  itemTotal?: number;
  category: string;
}
