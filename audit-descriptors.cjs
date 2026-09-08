/**
 * Which IPC channels are audited, and how.
 *
 * Auditing hangs off this registry rather than off calls scattered through the
 * repositories, because `handle()` in electron-main.cjs is the one place every
 * privileged operation passes through and the only place that already knows who
 * the caller is. A channel that forgets to audit is then a missing key in one
 * file, not a missing call buried three layers down.
 *
 * Read-only channels are deliberately absent: the log is append-only, and
 * recording every `*:getAll` would bury the handful of events per day that
 * actually matter under thousands that do not.
 *
 * Shape:
 *   action    — stable dotted name, safe to filter on
 *   entity    — what kind of thing was touched
 *   entityId  — (payload, result) => id, when it can be determined
 *   summary   — (payload, result) => short human line, in Arabic
 *   redact    — payload keys that must never be written to the log
 *   actorFromResult — for public channels, where the actor is only known after
 *                     the handler succeeds (login)
 */

const PASSWORD_KEYS = ["password", "newPassword", "passwordHash", "password_hash"];

const AUDIT_DESCRIPTORS = {
  // ── Sales reversals ───────────────────────────────────────────────────
  "returns:create": {
    action: "sale.return",
    entity: "sale_return",
    entityId: (_p, r) => r?.id ?? null,
    summary: (p, r) =>
      `مرتجع ${r?.returnNumber ?? ""} بقيمة ${r?.total ?? 0}`.trim(),
  },
  "shifts:closeRegister": {
    action: "shift.close",
    entity: "shift",
    entityId: (p) => p?.shiftId ?? null,
    // The variance is the whole point of the record: a drawer that was short
    // should be answerable later without reopening the shift.
    summary: (_p, r) =>
      `إقفال وردية — المعدود ${r?.countedCash ?? 0} / المتوقع ${r?.expectedCash ?? 0}` +
      ` (فرق ${r?.cashVariance ?? 0})`,
  },
  "returns:void": {
    action: "sale.void",
    entity: "sale_invoice",
    entityId: (p) => p?.invoiceId ?? null,
    summary: (p, r) =>
      `إلغاء فاتورة بقيمة ${r?.total ?? 0}${p?.reason ? ` — ${p.reason}` : ""}`,
  },

  // ── Inventory ─────────────────────────────────────────────────────────
  "products:addStock": {
    action: "stock.adjust",
    entity: "product",
    entityId: (p) => p?.id ?? null,
    summary: (p) => `تعديل مخزون بمقدار ${p?.amount ?? 0}`,
  },
  "products:create": {
    action: "product.create",
    entity: "product",
    entityId: (_p, r) => r?.id ?? null,
    summary: (p) => `إضافة منتج: ${p?.name ?? ""}`,
  },
  "products:update": {
    action: "product.update",
    entity: "product",
    entityId: (p) => p?.id ?? null,
    summary: (p) => `تعديل منتج: ${p?.data?.name ?? ""}`,
  },
  "products:delete": {
    action: "product.delete",
    entity: "product",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "حذف منتج",
  },

  // ── Customers and debts ───────────────────────────────────────────────
  "customers:delete": {
    action: "customer.delete",
    entity: "customer",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "حذف عميل",
  },
  "debts:addPayment": {
    action: "debt.payment",
    entity: "customer_debt",
    entityId: (p) => p?.debtId ?? null,
    summary: (p) => `تحصيل دين بمبلغ ${p?.paymentData?.amount ?? 0}`,
  },
  "debts:addBulkPayment": {
    action: "debt.bulkPayment",
    entity: "customer",
    entityId: (p) => p?.customerId ?? null,
    summary: (p) => `تحصيل مجمّع بمبلغ ${p?.amount ?? 0}`,
  },

  // ── Purchases ─────────────────────────────────────────────────────────
  "purchase:delete": {
    action: "purchase.delete",
    entity: "purchase_invoice",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "حذف فاتورة شراء",
  },

  // ── Categories and expenses ───────────────────────────────────────────
  "categories:delete": {
    action: "category.delete",
    entity: "category",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "حذف تصنيف",
  },
  "expenses:delete": {
    action: "expense.delete",
    entity: "expense",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "حذف مصروف",
  },

  // ── People ────────────────────────────────────────────────────────────
  "employees:create": {
    action: "user.create",
    entity: "user",
    entityId: (_p, r) => r?.id ?? null,
    summary: (p) => `إضافة موظف: ${p?.displayName ?? p?.username ?? ""}`,
    redact: PASSWORD_KEYS,
  },
  "employees:setActive": {
    action: "user.setActive",
    entity: "user",
    entityId: (p) => p?.userId ?? null,
    summary: (p) => (p?.isActive ? "تفعيل حساب موظف" : "تعطيل حساب موظف"),
  },
  "employees:changePassword": {
    action: "user.changePassword",
    entity: "user",
    entityId: (p) => p?.userId ?? null,
    summary: () => "تغيير كلمة مرور موظف",
    redact: PASSWORD_KEYS,
  },
  "employees:setSalary": {
    action: "user.setSalary",
    entity: "user",
    entityId: (p) => p?.userId ?? null,
    summary: (p) => `تعديل راتب إلى ${p?.amount ?? 0}`,
  },
  "auth:changePassword": {
    action: "user.changePassword",
    entity: "user",
    entityId: (p) => p?.userId ?? null,
    summary: () => "تغيير كلمة مرور",
    redact: PASSWORD_KEYS,
  },
  "auth:login": {
    action: "auth.login",
    entity: "user",
    // Public channel: nobody is authenticated yet, so the actor can only come
    // from a successful result. A failed attempt is recorded with the attempted
    // username and no user id, which is exactly what makes it worth keeping.
    actorFromResult: true,
    entityId: (_p, r) => r?.userId ?? null,
    summary: (p) => `تسجيل دخول: ${p?.username ?? ""}`,
    redact: PASSWORD_KEYS,
  },

  // ── Configuration and data ────────────────────────────────────────────
  "settings:update": {
    action: "settings.change",
    entity: "settings",
    summary: (p) => `تعديل إعدادات: ${Object.keys(p ?? {}).join(", ")}`,
  },
  "settings:reset": {
    action: "settings.reset",
    entity: "settings",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: (p) => `إرجاع إعداد للافتراضي: ${p}`,
  },
  "backup:restore": {
    action: "backup.restore",
    entity: "backup",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: (p) => `استرجاع نسخة احتياطية: ${p}`,
  },

  // ── Online orders ─────────────────────────────────────────────────────
  "onlineOrders:cancel": {
    action: "order.cancel",
    entity: "online_order",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "إلغاء طلب أونلاين",
  },
  "onlineOrders:markNotReceived": {
    action: "order.notReceived",
    entity: "online_order",
    entityId: (p) => (typeof p === "string" ? p : null),
    summary: () => "تسجيل عدم استلام طلب",
  },
  "onlineOrders:dispatch": {
    action: "order.dispatch",
    entity: "online_order",
    entityId: (p) => p?.orderId ?? null,
    summary: () => "تسليم طلب للمندوب",
  },
};

module.exports = { AUDIT_DESCRIPTORS, PASSWORD_KEYS };
