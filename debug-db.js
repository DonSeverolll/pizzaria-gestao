const { createDb, closeDb } = require('./backend/db');

(async () => {
  try {
    const db = await createDb();
    console.log('DB OBJECT', Object.keys(db));
    const tables = await db.all('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name', ['public']);
    console.log('TABLES', JSON.stringify(tables));
    const menuCount = await db.get('SELECT COUNT(*) AS total FROM menu_items');
    console.log('MENUCOUNT', JSON.stringify(menuCount));
    const tblCount = await db.get('SELECT COUNT(*) AS total FROM tables');
    console.log('TABLECOUNT', JSON.stringify(tblCount));
    const userCount = await db.get('SELECT COUNT(*) AS total FROM users');
    console.log('USERCOUNT', JSON.stringify(userCount));
    await closeDb();
  } catch (err) {
    console.error('DEBUG_ERROR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
