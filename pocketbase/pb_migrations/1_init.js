migrate((db) => {
  const dao = new Dao(db);

  // user_settings: one record per user, stores plan + unit prefs
  const userSettings = new Collection({
    name: "user_settings",
    type: "base",
    schema: [
      {
        name: "user",
        type: "relation",
        required: true,
        options: { collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 },
      },
      { name: "active_plan", type: "json" },
      { name: "unit_prefs",  type: "json" },
      { name: "global_unit", type: "text" },
    ],
    listRule:   "@request.auth.id = user.id",
    viewRule:   "@request.auth.id = user.id",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id",
  });
  dao.saveCollection(userSettings);

  // history: one record per completed workout
  const history = new Collection({
    name: "history",
    type: "base",
    schema: [
      {
        name: "user",
        type: "relation",
        required: true,
        options: { collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 },
      },
      { name: "entry_date", type: "text",   required: true },
      { name: "name",       type: "text",   required: true },
      { name: "day_name",   type: "text" },
      { name: "duration",   type: "number" },
      { name: "volume",     type: "number" },
      { name: "sets",       type: "number" },
      { name: "exercises",  type: "json" },
    ],
    listRule:   "@request.auth.id = user.id",
    viewRule:   "@request.auth.id = user.id",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id",
  });
  dao.saveCollection(history);

}, (db) => {
  const dao = new Dao(db);
  for (const name of ["user_settings", "history"]) {
    try { dao.deleteCollection(dao.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
