const CHANNEL_PERMISSIONS = {
  // Auth
  "auth:login": "public",
  "auth:logout": "public",
  "auth:getSession": "any",
  "auth:getUsers": "admin",
  "auth:changePassword": "admin",
  "auth:getActiveSession": "public",
  "auth:hasAnyUsers": "public",
  "auth:register": "public",
  // Categories
  "categories:getAll": "any",
  "categories:create": "admin",
  "categories:update": "admin",
  "categories:delete": "admin",
  // Products
  "products:getAll": "any",
  "products:getById": "any",
  "products:getByBarcode": "any",
  "products:generateBarcode": "any",
  "products:create": "admin",
  "products:update": "admin",
  "products:delete": "admin",
  "products:getForSales": "any",
  "products:deductStock": "any",
  "products:addStock": "admin",
  // Purchase
  "purchase:getAll": "admin",
  "purchase:getById": "admin",
  "purchase:save": "admin",
  "purchase:addPayment": "admin",
  "purchase:delete": "admin",
  // Sales
  "sales:getAll": "any",
  "sales:getById": "any",
  "sales:complete": "any",
  "sales:getBySource": "admin",
  "sales:getStats": "any",
  // Customers
  "customers:getAll": "any",
  "customers:getById": "any",
  "customers:create": "any",
  "customers:update": "any",
  "customers:delete": "admin",
  "customers:getDebts": "any",
  "customers:addDebt": "any",
  "customers:getByAnyPhone": "any",
  "customers:getProfile": "any",
  "customers:getAddresses": "any",
  "customers:addAddress": "any",
  "customers:updateAddress": "any",
  "customers:deleteAddress": "admin",
  "customers:setDefaultAddress": "any",
  "customers:getPhones": "any",
  "customers:addPhone": "any",
  "customers:updatePhone": "any",
  "customers:deletePhone": "admin",
  // Debts
  "debts:getAll": "any",
  "debts:getById": "any",
  "debts:addPayment": "any",
  "debts:addBulkPayment": "any",
  // Reports
  "reports:generate": "admin",
  // Shifts
  "shifts:getActive": "any",
  "shifts:getByUserAndDate": "admin",
  "shifts:getOrCreate": "any",
  "shifts:ensure": "any",
  "shifts:end": "any",
  "shifts:previewClose": "any",
  "shifts:closeRegister": "any",
  // A cashier pays the courier out of the till; recording it is part of
  // working the counter, not an administrative act. Every one is audited.
  "cash:record": "any",
  "cash:getAll": "any",
  "cash:getByShift": "any",
  "shifts:getInvoices": "any",
  "shifts:getAllInvoices": "admin",
  "shifts:getSummary": "any",
  // Print
  "print:invoice": "any",
  // Employees
  "employees:getAll": "admin",
  "employees:getById": "admin",
  "employees:create": "admin",
  "employees:update": "admin",
  "employees:setSalary": "admin",
  "employees:getSalaryHistory": "admin",
  "employees:setActive": "admin",
  "employees:changePassword": "admin",
  "employees:getShifts": "admin",
  "employees:getShiftInvoices": "admin",
  "employees:getSalarySummary": "admin",
  // Expenses
  "expenses:getCategories": "admin",
  "expenses:createCategory": "admin",
  "expenses:deleteCategory": "admin",
  "expenses:add": "admin",
  "expenses:getAll": "admin",
  "expenses:delete": "admin",
  "expenses:getNetSummary": "admin",
  // Returns / voids (admin only — these move money and stock backwards)
  "returns:getForInvoice": "admin",
  "returns:getReturnableLines": "admin",
  "returns:create": "admin",
  "returns:void": "admin",
  "returns:getAll": "admin",
  // Settings — reads are open because non-admin views need thresholds;
  // writes are admin only.
  "settings:getClient": "any",
  "settings:getAll": "admin",
  "settings:update": "admin",
  "settings:reset": "admin",
  // End-of-day export — reads the whole day's figures.
  "endOfDay:preview": "admin",
  "endOfDay:export": "admin",
  // Audit trail — read only; the log itself is append-only.
  "audit:query": "admin",
  "audit:getFilterOptions": "admin",
  // Backups (admin only — these read and replace the whole database)
  "backup:list": "admin",
  "backup:create": "admin",
  "backup:restore": "admin",
  "backup:reveal": "admin",
  // Alerts
  "alerts:getAll": "admin",
  "alerts:markRead": "admin",
  "alerts:markAllRead": "admin",
  "alerts:setInvoiceDueDate": "admin",
  "alerts:runChecks": "admin",
  // Online Orders (Phase 7)
  "onlineOrders:getAll": "any",
  "onlineOrders:getById": "any",
  "onlineOrders:create": "any",
  "onlineOrders:update": "any",
  "onlineOrders:cancel": "any",
  "onlineOrders:dispatch": "any",
  "onlineOrders:updateStatus": "any",
  "onlineOrders:markNotReceived": "any",
  "onlineOrders:calculateTrustLevel": "any",
  "onlineOrders:uploadBillOfLading": "any",
  // Drivers
  "drivers:getAll": "any",
  "drivers:getActive": "any",
  "drivers:getById": "any",
  "drivers:create": "admin",
  "drivers:update": "admin",
  "drivers:getBalance": "any",
  "drivers:registerManualPayment": "any",
  "drivers:getLedger": "any",
  "drivers:getSummary": "any",
};


/**
 * The capability each channel requires.
 *
 * The noun groups channels by feature so a grant means something a person
 * can describe; the suffix comes from the channel's own permission level.
 * Both halves matter: grouping by feature alone would put `products:getAll`
 * and `products:delete` behind the same capability, so granting everyday
 * access would silently grant destructive access with it.
 *
 * A channel missing from this map falls back to its own name, which no
 * seeded role holds — deny by default, never allow by default.
 */
/**
 * A capability is `<noun>.<use|manage>`.
 *
 * The suffix is not a per-channel decision: it follows the channel's own
 * permission level, and that is load-bearing. Deriving it from the feature
 * alone put `products:getAll` and `products:delete` behind one capability,
 * which meant seeding the cashier role from the channels marked `any` handed
 * it `catalogue.manage` as well. Reading the suffix from the permission is
 * what closed that escalation, so it stays a rule rather than 128 strings
 * somebody has to type correctly.
 *
 * Only the noun is a choice, and only where it differs from the channel's
 * prefix — because several prefixes are two views of one thing: products and
 * categories are both the catalogue, auth and employees are both users.
 */
const CAPABILITY_NOUN = {
  auth: "users",
  cash: "shifts",
  categories: "catalogue",
  employees: "users",
  endOfDay: "reports",
  onlineOrders: "orders",
  print: "sales",
  products: "catalogue",
  purchase: "purchases",
};

function capabilityFor(channel, permission) {
  const prefix = channel.split(":")[0];
  const noun = CAPABILITY_NOUN[prefix] ?? prefix;
  return `${noun}.${permission === "admin" ? "manage" : "use"}`;
}

/**
 * Derived from the permissions above, never written by hand. The two maps
 * were separate lists of the same 128 channels, and a list kept beside
 * another list is a list that eventually disagrees with it.
 */
const CHANNEL_CAPABILITY = Object.fromEntries(
  Object.entries(CHANNEL_PERMISSIONS).map(([channel, permission]) => [
    channel,
    capabilityFor(channel, permission),
  ]),
);

module.exports = {
  CHANNEL_PERMISSIONS,
  CHANNEL_CAPABILITY,
  CAPABILITY_NOUN,
  capabilityFor,
};
