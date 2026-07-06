const { generateId } = require("../helpers/ids.cjs");
const images = require("../helpers/images.cjs");
const { nowDateTime, normalizeIsoDate } = require("../helpers/isoDates.cjs");
const { safeNumber } = require("../helpers/numbers.cjs");
const {
  ORDER_STATUS,
  PRE_DISPATCH_STATUSES,
  ORDER_PAYMENT_METHOD,
  ORDER_PAYMENT_STATUS,
  SETTLEMENT_TYPE,
  TRUST_LEVEL,
  TRUST_LEVEL_RULES,
} = require("../../shared/onlineOrdersEnums.cjs");
const {
  computePaymentBreakdown,
} = require("../../shared/onlineOrdersPayment.cjs");

function resolvePaymentStatus(prepaidAmount, remainingAmount) {
  if (remainingAmount <= 0) return ORDER_PAYMENT_STATUS.PAID;
  if (prepaidAmount > 0) return ORDER_PAYMENT_STATUS.PARTIAL;
  return ORDER_PAYMENT_STATUS.UNPAID;
}

function getHeldQuantities(db, excludeOrderId = null) {
  const placeholders = PRE_DISPATCH_STATUSES.map(() => "?").join(",");
  const params = [...PRE_DISPATCH_STATUSES];
  let query = `SELECT oi.product_id, SUM(oi.quantity) as held
       FROM online_order_items oi
       JOIN online_orders oo ON oi.order_id = oo.id
       WHERE oo.status IN (${placeholders})`;
  if (excludeOrderId) {
    query += " AND oo.id != ?";
    params.push(excludeOrderId);
  }
  query += " GROUP BY oi.product_id";
  const rows = db.prepare(query).all(...params);
  const map = {};
  for (const r of rows) map[r.product_id] = r.held;
  return map;
}

function validateStockAvailability(db, items, excludeOrderId = null) {
  const held = getHeldQuantities(db, excludeOrderId);
  for (const item of items) {
    if (!item.productId) continue;
    const product = db
      .prepare("SELECT name, stock FROM products WHERE id=?")
      .get(item.productId);
    if (!product) continue;
    const heldQty = held[item.productId] ?? 0;
    const available = product.stock - heldQty;
    const qty = item.quantity ?? 1;
    if (qty > available) {
      throw new Error(
        `الكمية المطلوبة غير متوفرة لـ "${product.name}" — المتاح: ${Math.max(0, available)}`,
      );
    }
  }
}

function mapOrder(row, items) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    dailySequence: row.daily_sequence,
    orderDate: row.order_date,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    addressId: row.address_id,
    addressText: row.address_text,
    addressLabel: row.address_label,
    source: row.source,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    productsTotal: row.products_total,
    deliveryFee: row.delivery_fee,
    grandTotal: row.grand_total,
    prepaidAmount: row.prepaid_amount,
    remainingAmount: row.remaining_amount,
    driverId: row.driver_id,
    requestedDateTime: row.requested_datetime,
    notes: row.notes,
    createdAt: row.created_at,
    dispatchedAt: row.dispatched_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    saleInvoiceId: row.sale_invoice_id ?? null,
    billOfLadingImage: row.bill_of_lading_image
      ? images.filePathToImgUrl(row.bill_of_lading_image)
      : null,
    preSelectedDriverId: row.pre_selected_driver_id ?? null,
    onlinePaymentChannel: row.online_payment_channel ?? null,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      lineTotal: i.line_total,
      isWeighted: i.is_weighted === 1,
      weightGrams: i.weight_grams,
      measureAmount: i.measure_amount,
      measureUnit: i.measure_unit,
      pricePerKg: i.price_per_kg,
    })),
  };
}

function createOnlineOrdersDB(
  getDb,
  productsDB,
  customersDB,
  driversDB,
  ensureActiveShift,
) {
  function getItemsForOrder(db, orderId) {
    return db
      .prepare("SELECT * FROM online_order_items WHERE order_id=?")
      .all(orderId);
  }

  function generateOrderNumber(db, orderDate) {
    const row = db
      .prepare(
        "SELECT MAX(daily_sequence) as maxSeq FROM online_orders WHERE order_date=?",
      )
      .get(orderDate);
    const dailySequence = safeNumber(row?.maxSeq) + 1;
    const [y, m, d] = orderDate.split("-");
    const orderNumber = `OL-${y.slice(2)}${m}${d}-${String(dailySequence).padStart(3, "0")}`;
    return { orderNumber, dailySequence };
  }

  function assertPreDispatch(order) {
    if (!PRE_DISPATCH_STATUSES.includes(order.status)) {
      throw new Error("لا يمكن تعديل أو إلغاء الطلب بعد تسليمه للمندوب");
    }
  }

  function calculateTrustLevel(customerId) {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT status, COUNT(*) as c, COALESCE(SUM(grand_total),0) as total
         FROM online_orders WHERE customer_id=? AND status IN (?,?,?)
         GROUP BY status`,
      )
      .all(
        customerId,
        ORDER_STATUS.DISPATCHED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.NOT_RECEIVED,
      );

    let successfulOrders = 0;
    let cancelledOrders = 0;
    let notReceivedOrders = 0;
    let totalSpent = 0;
    for (const r of rows) {
      if (r.status === ORDER_STATUS.DISPATCHED) {
        successfulOrders = r.c;
        totalSpent = safeNumber(r.total);
      } else if (r.status === ORDER_STATUS.CANCELLED) {
        cancelledOrders = r.c;
      } else if (r.status === ORDER_STATUS.NOT_RECEIVED) {
        notReceivedOrders = r.c;
      }
    }

    const totalOrders = successfulOrders + cancelledOrders + notReceivedOrders;
    const failedOrders = cancelledOrders + notReceivedOrders;
    const successRate = totalOrders > 0 ? successfulOrders / totalOrders : 0;
    const failureRate = totalOrders > 0 ? failedOrders / totalOrders : 0;

    let trustLevel = TRUST_LEVEL.REGULAR;
    if (totalOrders >= TRUST_LEVEL_RULES.MIN_ORDERS_FOR_JUDGMENT) {
      if (
        successfulOrders >= TRUST_LEVEL_RULES.VIP_MIN_SUCCESSFUL_ORDERS &&
        successRate >= TRUST_LEVEL_RULES.VIP_MIN_SUCCESS_RATE
      ) {
        trustLevel = TRUST_LEVEL.VIP;
      } else if (
        totalOrders >= TRUST_LEVEL_RULES.HIGH_RISK_MIN_ORDERS &&
        failureRate > TRUST_LEVEL_RULES.HIGH_RISK_FAILURE_RATE_THRESHOLD
      ) {
        trustLevel = TRUST_LEVEL.HIGH_RISK;
      } else if (
        failedOrders > TRUST_LEVEL_RULES.WARNING_FAILED_COUNT_THRESHOLD
      ) {
        trustLevel = TRUST_LEVEL.WARNING;
      }
    }

    const lastOrder = db
      .prepare(
        "SELECT order_date FROM online_orders WHERE customer_id=? ORDER BY order_date DESC, daily_sequence DESC LIMIT 1",
      )
      .get(customerId);

    return {
      trustLevel,
      totalOrders,
      successfulOrders,
      cancelledOrders,
      notReceivedOrders,
      successRate,
      totalSpent,
      lastOrderDate: lastOrder?.order_date ?? null,
    };
  }

  function syncCustomerCache(db, customerId) {
    if (!customerId) return;
    const stats = calculateTrustLevel(customerId);
    db.prepare(
      `UPDATE customers SET trust_level=?, total_online_orders=?, successful_online_orders=?,
       cancelled_online_orders=?, not_received_online_orders=? WHERE id=?`,
    ).run(
      stats.trustLevel,
      stats.totalOrders,
      stats.successfulOrders,
      stats.cancelledOrders,
      stats.notReceivedOrders,
      customerId,
    );
  }

  function resolveCustomer(db, data) {
    let customerId = data.customerId ?? null;
    if (!customerId && data.customerPhone) {
      const existing = customersDB.getByAnyPhone(data.customerPhone);
      if (existing) {
        customerId = existing.id;
      } else {
        const created = customersDB.create({
          name: data.customerName,
          phone: data.customerPhone,
          address: data.addressText ?? null,
        });
        customerId = created.id;
      }
    }
    if (customerId && data.addressText) {
      const existingAddresses = customersDB.getAddresses(customerId);
      const alreadySaved = existingAddresses.some(
        (a) => a.addressText === data.addressText,
      );
      if (!alreadySaved) {
        customersDB.addAddress(customerId, {
          label: data.addressLabel ?? null,
          addressText: data.addressText,
          isDefault: existingAddresses.length === 0,
        });
      }
    }
    return customerId;
  }

  function insertItems(db, orderId, items) {
    for (const item of items) {
      db.prepare(
        "INSERT INTO online_order_items (id, order_id, product_id, name, price, quantity, line_total, is_weighted, weight_grams, measure_amount, measure_unit, price_per_kg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        generateId("oitem"),
        orderId,
        item.productId ?? null,
        item.name,
        item.price,
        item.quantity ?? 1,
        item.lineTotal ?? item.price * (item.quantity ?? 1),
        item.isWeighted ? 1 : 0,
        item.weightGrams ?? null,
        item.measureAmount ?? null,
        item.measureUnit ?? null,
        item.pricePerKg ?? null,
      );
    }
  }

  const onlineOrdersDB = {
    getAll(filters = {}) {
      const db = getDb();
      const conditions = [];
      const params = [];
      if (filters.status) {
        conditions.push("status=?");
        params.push(filters.status);
      }
      const fromIso = normalizeIsoDate(filters.from);
      const toIso = normalizeIsoDate(filters.to);
      if (fromIso) {
        conditions.push("order_date >= ?");
        params.push(fromIso);
      }
      if (toIso) {
        conditions.push("order_date <= ?");
        params.push(toIso);
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      return db
        .prepare(
          `SELECT * FROM online_orders ${where} ORDER BY order_date DESC, daily_sequence DESC`,
        )
        .all(...params)
        .map((row) => mapOrder(row, getItemsForOrder(db, row.id)));
    },

    getById(id) {
      const db = getDb();
      const row = db.prepare("SELECT * FROM online_orders WHERE id=?").get(id);
      if (!row) return null;
      return mapOrder(row, getItemsForOrder(db, id));
    },

    create(data) {
      const db = getDb();
      const id = generateId("oord");
      const { date, time } = nowDateTime();
      validateStockAvailability(db, data.items ?? []);
      const productsTotal = (data.items ?? []).reduce(
        (sum, i) => sum + (i.lineTotal ?? i.price * (i.quantity ?? 1)),
        0,
      );
      const breakdown = computePaymentBreakdown(
        data.paymentMethod,
        productsTotal,
        data.deliveryFee ?? 0,
        data.prepaidAmount ?? 0,
      );
      const paymentStatus = resolvePaymentStatus(
        breakdown.prepaidAmount,
        breakdown.remainingAmount,
      );

      const createTx = db.transaction(() => {
        const customerId = resolveCustomer(db, data);
        const { orderNumber, dailySequence } = generateOrderNumber(db, date);
        db.prepare(
          `INSERT INTO online_orders (
            id, order_number, daily_sequence, order_date, customer_id, customer_name, customer_phone,
            address_id, address_text, address_label, source, status, payment_method, payment_status,
            products_total, delivery_fee, grand_total, prepaid_amount, remaining_amount,
            requested_datetime, notes, created_at, created_by, pre_selected_driver_id, online_payment_channel
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          id,
          orderNumber,
          dailySequence,
          date,
          customerId,
          data.customerName,
          data.customerPhone,
          data.addressId ?? null,
          data.addressText,
          data.addressLabel ?? null,
          data.source,
          data.initialStatus === ORDER_STATUS.PREPARING
            ? ORDER_STATUS.PREPARING
            : ORDER_STATUS.NEW,
          data.paymentMethod,
          paymentStatus,
          productsTotal,
          data.deliveryFee ?? 0,
          breakdown.grandTotal,
          breakdown.prepaidAmount,
          breakdown.remainingAmount,
          data.requestedDateTime ?? null,
          data.notes ?? null,
          `${date} ${time}`,
          data.createdBy,
          data.preSelectedDriverId ?? null,
          data.onlinePaymentChannel ?? null,
        );
        insertItems(db, id, data.items ?? []);
      });
      createTx();
      return this.getById(id);
    },

    update(orderId, data) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      assertPreDispatch(order);
      validateStockAvailability(db, data.items ?? [], orderId);

      const productsTotal = (data.items ?? []).reduce(
        (sum, i) => sum + (i.lineTotal ?? i.price * (i.quantity ?? 1)),
        0,
      );
      const breakdown = computePaymentBreakdown(
        data.paymentMethod,
        productsTotal,
        data.deliveryFee ?? 0,
        data.prepaidAmount ?? 0,
      );
      const paymentStatus = resolvePaymentStatus(
        breakdown.prepaidAmount,
        breakdown.remainingAmount,
      );

      const updateTx = db.transaction(() => {
        db.prepare(
          `UPDATE online_orders SET customer_name=?, customer_phone=?, address_id=?, address_text=?,
           address_label=?, source=?, payment_method=?, payment_status=?, products_total=?, delivery_fee=?,
           grand_total=?, prepaid_amount=?, remaining_amount=?, requested_datetime=?, notes=?, online_payment_channel=? WHERE id=?`,
        ).run(
          data.customerName,
          data.customerPhone,
          data.addressId ?? null,
          data.addressText,
          data.addressLabel ?? null,
          data.source,
          data.paymentMethod,
          paymentStatus,
          productsTotal,
          data.deliveryFee ?? 0,
          breakdown.grandTotal,
          breakdown.prepaidAmount,
          breakdown.remainingAmount,
          data.requestedDateTime ?? null,
          data.notes ?? null,
          data.onlinePaymentChannel ?? null,
          orderId,
        );
        db.prepare("DELETE FROM online_order_items WHERE order_id=?").run(
          orderId,
        );
        insertItems(db, orderId, data.items ?? []);
      });
      updateTx();
      return this.getById(orderId);
    },

    updateStatus(orderId, newStatus) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      assertPreDispatch(order);
      db.prepare("UPDATE online_orders SET status=? WHERE id=?").run(
        newStatus,
        orderId,
      );
      return this.getById(orderId);
    },

    cancel(orderId) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      assertPreDispatch(order);
      const { date, time } = nowDateTime();

      const cancelTx = db.transaction(() => {
        db.prepare(
          "UPDATE online_orders SET status=?, completed_at=? WHERE id=?",
        ).run(ORDER_STATUS.CANCELLED, `${date} ${time}`, orderId);
        syncCustomerCache(db, order.customerId);
      });
      cancelTx();
      return this.getById(orderId);
    },

    dispatch(orderId, driverId) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      assertPreDispatch(order);
      const { date, time } = nowDateTime();

      const dispatchTx = db.transaction(() => {
        for (const item of order.items) {
          if (item.productId) {
            productsDB.deductStock(item.productId, item.quantity);
          }
        }

        const breakdown = computePaymentBreakdown(
          order.paymentMethod,
          order.productsTotal,
          order.deliveryFee,
          order.prepaidAmount,
        );

        const shift = ensureActiveShift(
          order.createdBy,
          date,
          `${date}T${time}`,
        );

        const invoiceId = generateId("sinv");
        const invoiceNumber = `OL-${Date.now()}`;
        db.prepare(
          `INSERT INTO sale_invoices
             (id, invoice_number, date, time, total, cashier, shift_id, source, voided)
           VALUES (?,?,?,?,?,?,?,?,0)`,
        ).run(
          invoiceId,
          invoiceNumber,
          date,
          time,
          order.productsTotal,
          order.customerName,
          shift.id,
          "online",
        );

        for (const item of order.items) {
          db.prepare(
            `INSERT INTO sale_invoice_items
               (id, invoice_id, product_id, name, price, quantity, barcode, is_weighted, weight_grams, measure_amount, measure_unit, price_per_kg, line_total)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          ).run(
            generateId("sitem"),
            invoiceId,
            item.productId ?? null,
            item.name,
            item.price,
            item.quantity,
            null,
            item.isWeighted ? 1 : 0,
            item.weightGrams ?? null,
            item.measureAmount ?? null,
            item.measureUnit ?? null,
            item.pricePerKg ?? null,
            item.lineTotal,
          );
        }

        const { COD, PAID_ONLINE, SPLIT, PARTIAL } = ORDER_PAYMENT_METHOD;
        const onlineMethod = order.onlinePaymentChannel || "vodafone";
        if (order.paymentMethod === PAID_ONLINE) {
          db.prepare(
            `INSERT INTO payment_records
               (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
             VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)`,
          ).run(
            generateId("pay"),
            invoiceId,
            order.productsTotal,
            date,
            time,
            onlineMethod,
            `مدفوع أونلاين — ${order.orderNumber}`,
            shift.id,
          );
        } else if (order.paymentMethod === COD) {
          db.prepare(
            `INSERT INTO payment_records
               (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
             VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)`,
          ).run(
            generateId("pay"),
            invoiceId,
            order.productsTotal,
            date,
            time,
            "cash",
            `تحصيل نقدي عند التسليم — ${order.orderNumber}`,
            shift.id,
          );
        } else if (order.paymentMethod === SPLIT) {
          db.prepare(
            `INSERT INTO payment_records
               (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
             VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)`,
          ).run(
            generateId("pay"),
            invoiceId,
            order.productsTotal,
            date,
            time,
            onlineMethod,
            `منتجات مدفوعة أونلاين — ${order.orderNumber}`,
            shift.id,
          );
        } else if (order.paymentMethod === PARTIAL) {
          if (breakdown.prepaidAmount > 0) {
            db.prepare(
              `INSERT INTO payment_records
                 (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
               VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)`,
            ).run(
              generateId("pay"),
              invoiceId,
              breakdown.prepaidAmount,
              date,
              time,
              onlineMethod,
              `دفعة مقدمة — ${order.orderNumber}`,
              shift.id,
            );
          }
          if (breakdown.remainingAmount > 0) {
            db.prepare(
              `INSERT INTO payment_records
                 (id, ref_id, ref_type, amount, date, time, method, notes, source, shift_id)
               VALUES (?,?,'sale',?,?,?,?,?,'checkout',?)`,
            ).run(
              generateId("pay"),
              invoiceId,
              breakdown.remainingAmount,
              date,
              time,
              "cash",
              `باقي التحصيل — ${order.orderNumber}`,
              shift.id,
            );
          }
        }

        const driverRow = driversDB.getById(driverId);
        const driverType = driverRow?.driverType ?? "driver";

        if (driverType === "company_direct") {
        } else if (driverType === "company_next_day") {
          driversDB.recordSettlement(driverId, {
            orderId,
            type: SETTLEMENT_TYPE.CUSTODY_CHARGE,
            amount: order.productsTotal,
            notes: `مستحق من شركة التوصيل — الطلب ${order.orderNumber}`,
          });
        } else {
          if (breakdown.driverOwesShop > 0) {
            driversDB.recordSettlement(driverId, {
              orderId,
              type: SETTLEMENT_TYPE.CUSTODY_CHARGE,
              amount: breakdown.driverOwesShop,
              notes: `عهدة الطلب ${order.orderNumber}`,
            });
          } else if (breakdown.shopOwesDriver > 0) {
            driversDB.recordSettlement(driverId, {
              orderId,
              type: SETTLEMENT_TYPE.SHOP_OWES_DRIVER,
              amount: -breakdown.shopOwesDriver,
              notes: `أجرة توصيل الطلب ${order.orderNumber}`,
            });
          }
        }

        db.prepare(
          "UPDATE online_orders SET status=?, driver_id=?, dispatched_at=?, sale_invoice_id=? WHERE id=?",
        ).run(
          ORDER_STATUS.DISPATCHED,
          driverId,
          `${date} ${time}`,
          invoiceId,
          orderId,
        );

        syncCustomerCache(db, order.customerId);
      });
      dispatchTx();
      return this.getById(orderId);
    },

    markNotReceived(orderId) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      if (order.status !== ORDER_STATUS.DISPATCHED) {
        throw new Error(
          "لا يمكن تسجيل عدم الاستلام إلا لطلب تم تسليمه للمندوب",
        );
      }
      const { date, time } = nowDateTime();

      const notReceivedTx = db.transaction(() => {
        for (const item of order.items) {
          if (item.productId) {
            productsDB.addStock(item.productId, item.quantity);
          }
        }

        const breakdown = computePaymentBreakdown(
          order.paymentMethod,
          order.productsTotal,
          order.deliveryFee,
          order.prepaidAmount,
        );

        if (breakdown.driverOwesShop > 0) {
          driversDB.recordSettlement(order.driverId, {
            orderId,
            type: SETTLEMENT_TYPE.MANUAL_ADJUSTMENT,
            amount: -breakdown.driverOwesShop,
            notes: `عكس عهدة الطلب ${order.orderNumber} — لم يُستلم`,
          });
        }

        if (order.saleInvoiceId) {
          db.prepare("UPDATE sale_invoices SET voided=1 WHERE id=?").run(
            order.saleInvoiceId,
          );
        }

        const needsRefund = breakdown.prepaidAmount > 0;
        const newPaymentStatus = needsRefund
          ? ORDER_PAYMENT_STATUS.REFUND_REQUIRED
          : order.paymentStatus;

        db.prepare(
          "UPDATE online_orders SET status=?, payment_status=?, completed_at=? WHERE id=?",
        ).run(
          ORDER_STATUS.NOT_RECEIVED,
          newPaymentStatus,
          `${date} ${time}`,
          orderId,
        );

        syncCustomerCache(db, order.customerId);
      });
      notReceivedTx();
      return this.getById(orderId);
    },

    uploadBillOfLading(orderId, base64Image) {
      const db = getDb();
      const order = this.getById(orderId);
      if (!order) throw new Error("الطلب غير موجود");
      if (order.status !== ORDER_STATUS.DISPATCHED)
        throw new Error("يمكن رفع البوليصة فقط بعد تسليم الطلب للمندوب");
      const filepath = images.saveImage(base64Image, "lading");
      db.prepare(
        "UPDATE online_orders SET bill_of_lading_image=? WHERE id=?",
      ).run(filepath, orderId);
      return this.getById(orderId);
    },
    calculateTrustLevel,
  };

  return onlineOrdersDB;
}

module.exports = { createOnlineOrdersDB, mapOrder };
