// Ensure the users auth collection allows unverified logins
// (PocketBase may default to requiring verification in some versions)
migrate((db) => {
  const dao = new Dao(db);
  try {
    const col = dao.findCollectionByNameOrId("users");
    // Merge rather than replace to preserve any other settings
    col.options = Object.assign({}, col.options, {
      allowEmailAuth:    true,
      allowUsernameAuth: false,
      onlyVerified:      false,
      requireEmail:      true,
      minPasswordLength: 8,
    });
    dao.saveCollection(col);
  } catch (e) {
    // If the users collection doesn't exist yet, nothing to do
    console.log("2_configure_auth: could not update users collection:", e);
  }
}, (db) => {
  // No-op rollback — we can't know the previous values
});
