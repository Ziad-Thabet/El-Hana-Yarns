const { generateId } = require("../helpers/ids.cjs");
const DEFAULT_CATEGORY_COLOR = "#6366f1";
function createCategoriesDB(getDb) {
  return {
    getAll() {
      return getDb().prepare("SELECT * FROM categories ORDER BY name").all();
    },
    getById(id) {
      return (
        getDb().prepare("SELECT * FROM categories WHERE id=?").get(id) ?? null
      );
    },
    create(data) {
      const id = generateId("cat");
      getDb()
        .prepare(
          "INSERT INTO categories (id, name, description, color) VALUES (?,?,?,?)",
        )
        .run(
          id,
          data.name,
          data.description ?? null,
          data.color ?? DEFAULT_CATEGORY_COLOR,
        );
      return this.getById(id);
    },
    update(id, data) {
      getDb()
        .prepare(
          "UPDATE categories SET name=?, description=?, color=? WHERE id=?",
        )
        .run(data.name, data.description ?? null, data.color, id);
      return this.getById(id);
    },
    delete(id) {
      getDb().prepare("DELETE FROM categories WHERE id=?").run(id);
      return { success: true };
    },
  };
}
module.exports = { createCategoriesDB };
