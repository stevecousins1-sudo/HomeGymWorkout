// Add rest_prefs JSON field to user_settings
migrate((db) => {
  const dao = new Dao(db);
  const col = dao.findCollectionByNameOrId("user_settings");
  col.schema.addField(new SchemaField({
    name: "rest_prefs",
    type: "json",
    required: false,
    options: {},
  }));
  dao.saveCollection(col);
}, (db) => {
  const dao = new Dao(db);
  const col = dao.findCollectionByNameOrId("user_settings");
  const field = col.schema.getFieldByName("rest_prefs");
  if (field) col.schema.removeField(field.id);
  dao.saveCollection(col);
});
