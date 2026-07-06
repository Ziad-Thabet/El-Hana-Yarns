import { formatArabicNumber } from "./utils";
import { strings } from "./i18n/ar";
import type {
  Product,
  UnitType,
  PaymentRecord,
  CustomerDebt,
  Customer,
  CartItem,
  PurchaseInvoice,
  SaleInvoice,
} from "./types";
export class Money {
  constructor(public readonly amount: number) {}
  arabic(): string {
    return formatArabicNumber(this.amount);
  }
  toString(): string {
    return `${this.arabic()} ${strings.common.egyptianPound}`;
  }
  per(unitLabel: string): string {
    return `${this.arabic()} ${strings.common.egyptianPound}/${unitLabel}`;
  }
  static from(value: number): Money {
    return new Money(value);
  }
}
export class UnitHelper {
  static getUnitName(unit: UnitType): string {
    switch (unit) {
      case "weight":
        return strings.common.kg;
      case "meter":
        return strings.common.meter;
      default:
        return strings.common.piece;
    }
  }
  static getPriceSuffix(unit: UnitType): string {
    switch (unit) {
      case "weight":
        return strings.common.kg;
      case "meter":
        return strings.common.meter;
      default:
        return strings.common.piece;
    }
  }
  static getStockLabel(unit: UnitType): string {
    return this.getUnitName(unit);
  }
  static getPromptLabel(unit: UnitType, name: string): string {
    switch (unit) {
      case "weight":
        return strings.domain.weightPromptLabel.replace("{name}", name);
      case "meter":
        return strings.domain.meterPromptLabel.replace("{name}", name);
      default:
        return strings.domain.piecePromptLabel.replace("{name}", name);
    }
  }
  static getMeasureUnit(unit: UnitType): string {
    switch (unit) {
      case "weight":
        return strings.common.kg;
      case "meter":
        return strings.common.meter;
      default:
        return strings.common.piece;
    }
  }
}
export class ProductModel {
  constructor(public readonly source: Product) {}
  get id(): string {
    return this.source.id;
  }
  get name(): string {
    return this.source.name;
  }
  get stock(): number {
    return this.source.stock;
  }
  get category(): string | undefined {
    return this.source.category;
  }
  get unit(): UnitType {
    return this.source.unit;
  }
  get pricePerUnit(): number {
    if (this.source.unit === "weight") {
      return this.source.pricePerKg ?? this.source.price;
    }
    return this.source.price;
  }
  get priceLabel(): string {
    return Money.from(this.pricePerUnit).per(
      UnitHelper.getPriceSuffix(this.source.unit),
    );
  }
  get stockLabel(): string {
    const unit = UnitHelper.getStockLabel(this.source.unit);
    return `${formatArabicNumber(this.source.stock)} ${unit}`;
  }
  get unitDisplay(): string {
    return UnitHelper.getUnitName(this.source.unit);
  }
  get promptLabel(): string {
    return UnitHelper.getPromptLabel(this.source.unit, this.source.name);
  }
  get defaultPromptValue(): string {
    return "1";
  }
  deductStock(amount: number): Product {
    return { ...this.source, stock: Math.max(0, this.source.stock - amount) };
  }
  matchesSearch(filter: string): boolean {
    const term = filter.trim().toLowerCase();
    return (
      this.source.name.toLowerCase().includes(term) ||
      (this.source.category?.toLowerCase().includes(term) ?? false)
    );
  }
}
export class CartItemModel {
  constructor(public readonly source: CartItem) {}
  static from(source: CartItem): CartItemModel {
    return new CartItemModel(source);
  }
  static createFromProduct(product: Product, amount: number): CartItem {
    const isWeighted = product.unit !== "piece";
    const unitPrice =
      product.unit === "weight"
        ? (product.pricePerKg ?? product.price)
        : product.price;
    const quantity = isWeighted ? 1 : amount;
    const lineTotal = parseFloat((unitPrice * amount).toFixed(2));
    const measureUnit = UnitHelper.getMeasureUnit(product.unit);
    return {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      price: unitPrice,
      quantity,
      barcode: product.barcode,
      isWeighted,
      pricePerKg: product.unit === "weight" ? unitPrice : undefined,
      lineTotal,
      weightGrams: product.unit === "weight" ? amount : undefined,
      measureAmount: isWeighted ? amount : undefined,
      measureUnit: isWeighted ? measureUnit : undefined,
      stock: product.stock,
    };
  }
  get id(): string {
    return this.source.id;
  }
  get name(): string {
    return this.source.name;
  }
  get quantity(): number {
    return this.source.quantity ?? 1;
  }
  get price(): number {
    return this.source.price;
  }
  get lineTotal(): number {
    return this.source.lineTotal ?? this.price * this.quantity;
  }
  get measureLabel(): string {
    if (this.source.isWeighted) {
      const amount = this.source.measureAmount ?? this.source.weightGrams ?? 0;
      const unit = this.source.measureUnit ?? strings.common.kg;
      return `${formatArabicNumber(amount)} ${unit}`;
    }
    return `${formatArabicNumber(this.quantity)} ${strings.common.piece}`;
  }
  get totalLabel(): string {
    return Money.from(this.lineTotal).toString();
  }
  get priceLabel(): string {
    return Money.from(this.price).toString();
  }
}
export class PaymentRecordModel {
  constructor(public readonly source: PaymentRecord) {}
  get amountLabel(): string {
    return Money.from(this.source.amount).toString();
  }
}
export class CustomerDebtModel {
  constructor(public readonly source: CustomerDebt) {}
  get remainingLabel(): string {
    return Money.from(this.source.remainingAmount).toString();
  }
  get paidLabel(): string {
    return Money.from(this.source.paidAmount).toString();
  }
  get totalLabel(): string {
    return Money.from(this.source.totalAmount).toString();
  }
}
export class CustomerModel {
  constructor(public readonly source: Customer) {}
  get totalDebtLabel(): string {
    return Money.from(this.source.totalDebt).toString();
  }
}
export class PurchaseInvoiceModel {
  constructor(public readonly source: PurchaseInvoice) {}
  get totalLabel(): string {
    return Money.from(this.source.total).toString();
  }
  get paidLabel(): string {
    return Money.from(this.source.paidAmount).toString();
  }
  get remainingLabel(): string {
    return Money.from(this.source.total - this.source.paidAmount).toString();
  }
}
export class SaleInvoiceModel {
  constructor(public readonly source: SaleInvoice) {}
  get totalLabel(): string {
    return Money.from(this.source.total).toString();
  }
  get itemCount(): number {
    return this.source.items.length;
  }
}
