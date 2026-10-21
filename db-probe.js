import { prisma } from './packages/database/src/index.js';
(async () => {
  await prisma.();
  console.log('DB CONNECT OK');
  const tables = await prisma.SELECT table_name FROM information_schema.tables WHERE table_schema = 'kora' ORDER BY table_name;
  console.log('kora tables (' + tables.length + '):');
  tables.forEach(t => console.log(' - ' + t.table_name));
  await prisma.();
})().catch(e => { console.error('DB ERROR: ' + e.message); process.exit(1); });
