import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Resolve the existing browser SDK dependency, but run this tool only in Node.
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { createClient } = await import(pathToFileURL(require.resolve('@supabase/supabase-js')).href);
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key)
  throw new Error('Set the frontend Supabase URL and backend service role key first.');
const database = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const records = JSON.parse(
  await readFile(new URL('../supabase/homepage.json', import.meta.url), 'utf8'),
);
const ids = new Map();
const naturalKeys = {
  media: 'path',
  categories: 'slug',
  collections: 'slug',
  homepage_sections: 'key',
};
const references = {
  image_id: 'media',
  category_id: 'categories',
  collection_id: 'collections',
  section_id: 'homepage_sections',
};

for (const { table, values } of records) {
  const row = { ...values };
  for (const [field, parentTable] of Object.entries(references)) {
    if (row[field]) row[field] = ids.get(`${parentTable}:${row[field]}`) || row[field];
  }
  const naturalKey = naturalKeys[table] || 'id';
  const existing = await database
    .from(table)
    .select('id')
    .eq(naturalKey, row[naturalKey])
    .maybeSingle();
  if (existing.error) throw new Error(`${table}: ${existing.error.message}`);
  if (existing.data) {
    ids.set(`${table}:${values.id}`, existing.data.id);
    continue;
  }
  const result = await database.from(table).insert(row).select('id').single();
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
  ids.set(`${table}:${values.id}`, result.data.id);
}
console.log(
  'Homepage defaults restored. Existing content, products, stock and checkout settings were preserved.',
);
