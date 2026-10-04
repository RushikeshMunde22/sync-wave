
import { providerManager } from './music/provider.manager.js';
import { getDashboardStats } from './admin/admin.service.js';
import { initializeDatabase } from './db/database.js';
import { runMigrations } from './db/migrator.js';
async function run() {
  initializeDatabase();
  runMigrations();
  const search = await providerManager.search('Coldplay', 3, 0);
  console.log('Search Coldplay count:', search.tracks?.length, 'First title:', search.tracks?.[0]?.title, 'Provider:', search.tracks?.[0]?.provider);
  const stats = getDashboardStats();
  console.log('Admin Stats:', stats);
  process.exit(0);
}
run().catch(console.error);

