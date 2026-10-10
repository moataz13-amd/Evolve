import { writeFile, readFile, readdir } from 'node:fs/promises';
import { products, hero, photo, colorValues } from '../../frontend/src/data/products.js';
const uuid = (n) => `e7010000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sql = (value) =>
  value == null
    ? 'null'
    : typeof value === 'boolean'
      ? String(value)
      : typeof value === 'number'
        ? String(value)
        : "'" + String(value).replaceAll("'", "''") + "'";
const statements = [
  '-- Optional DEVELOPMENT seed. Products start as drafts. Review imagery, stock and copy before publication.',
  'begin;',
];
const records = [];
function insert(table, values, conflict = 'id') {
  records.push({ table, values, conflict });
  statements.push(
    `insert into public.${table}(${Object.keys(values).join(',')}) values(${Object.values(values).map(sql).join(',')}) on conflict(${conflict}) do nothing;`,
  );
}
const images = [
  hero,
  photo('photo-1552902865-b72c031ac5ea', 1100),
  photo('photo-1534438327276-14e5300c3a48', 1200),
];
images.forEach((path, i) =>
  insert('media', {
    id: uuid(10 + i),
    path,
    name: ['Hero training', 'Sweatpants lifestyle', 'Core collection'][i],
    mime_type: 'image/webp',
    size: 1,
    folder: 'homepage',
  }),
);
['Gym wear', 'Sweatpants'].forEach((name, i) =>
  insert('categories', {
    id: uuid(20 + i),
    name,
    name_ar: ['ملابس التدريب', 'البناطيل الرياضية'][i],
    slug: ['gym-wear', 'sweatpants'][i],
    image_id: uuid(10 + i),
    display_order: i,
    active: true,
  }),
);
['Core Collection', 'Best Sellers', 'New Arrivals'].forEach((name, i) =>
  insert('collections', {
    id: uuid(30 + i),
    name,
    slug: ['core', 'best-sellers', 'new-arrivals'][i],
    active: true,
    featured: i === 0,
    display_order: i,
  }),
);
let nextVariant = 1000;
products.forEach((product, index) => {
  const id = uuid(100 + index);
  insert('products', {
    id,
    name: product.name,
    name_ar: product.ar,
    slug: product.id,
    description: product.description,
    category_id: uuid(product.category === 'Sweatpants' ? 21 : 20),
    product_type: product.type,
    price: product.price,
    gender: 'Men',
    active: false,
    featured: index < 4,
    best_seller: product.tag === 'BESTSELLER',
    new_arrival: product.tag === 'NEW',
    tags:
      product.tag && !['BESTSELLER', 'NEW'].includes(product.tag) ? '{' + product.tag + '}' : '{}',
  });
  insert('product_images', {
    id: uuid(200 + index),
    product_id: id,
    external_url: product.image,
    alt: product.name + ' — illustrative development photograph',
    display_order: 0,
  });
  for (const color of product.colors)
    for (const size of product.sizes) {
      insert('product_variants', {
        id: uuid(nextVariant++),
        product_id: id,
        sku: `EVO-${index + 1}-${color.toUpperCase()}-${size}`,
        size,
        color_name: color,
        color_hex: colorValues[color] || '#20231f',
        stock: 12 + (index % 4) * 3,
        low_stock_threshold: 5,
        track_quantity: true,
        active: true,
      });
    }
  insert(
    'product_collections',
    { product_id: id, collection_id: uuid(30) },
    'product_id,collection_id',
  );
  if (product.tag)
    insert(
      'product_collections',
      { product_id: id, collection_id: uuid(product.tag === 'NEW' ? 32 : 31) },
      'product_id,collection_id',
    );
});
const sections = [
  ['hero', 'Hero'],
  ['strip', 'Moving brand strip'],
  ['categories', 'Categories'],
  ['products', 'Featured products'],
  ['core_collection', 'Core collection'],
  ['story', 'Our story'],
  ['values', 'Brand values'],
  ['faq', 'FAQ'],
];
sections.forEach(([key, title], i) =>
  insert(
    'homepage_sections',
    { id: uuid(300 + i), key, title, display_order: i, active: true, published: true },
    'key',
  ),
);
const content = [
  {
    section: 0,
    eyebrow: 'ENGINEERED TO WORK. BUILT TO LIVE.',
    heading: 'STRENGTH IN\nEVERY MOVE.',
    heading_ar: 'القوة في\nكل حركة.',
    description:
      'Purpose-built essentials for the way you move. From your first rep to your next chapter.',
    description_ar: 'ملابس أساسية تواكب طموحك. من أول تكرار إلى آخر خطوة.',
    cta_label: 'Shop Now',
    cta_label_ar: 'تسوق الآن',
    cta_url: '/shop',
    image_id: uuid(10),
    background: 'charcoal',
  },
  {
    section: 2,
    eyebrow: 'THE RIGHT GEAR. YOUR WAY.',
    heading: 'Built for your everyday.',
    heading_ar: 'مصممة لكل يوم.',
  },
  {
    section: 2,
    heading: 'Gym wear',
    heading_ar: 'ملابس التدريب',
    category_id: uuid(20),
    image_id: uuid(10),
  },
  {
    section: 2,
    heading: 'Sweatpants',
    heading_ar: 'البناطيل الرياضية',
    category_id: uuid(21),
    image_id: uuid(11),
  },
  {
    section: 3,
    eyebrow: 'HEAVY ROTATION. FOR A REASON.',
    heading: 'Your next go-to.',
    heading_ar: 'قطع أساسية مميزة.',
    collection_id: uuid(31),
  },
  {
    section: 4,
    eyebrow: 'THE CORE COLLECTION / VOL. 01',
    heading: 'LESS NOISE.\nMORE FOCUS.',
    heading_ar: 'أقل ضوضاء.\nأكثر تركيزًا.',
    description: 'Essentials that show up when you do.',
    description_ar: 'قطع أساسية معاك في كل خطوة.',
    cta_label: 'Discover the core collection',
    cta_label_ar: 'اكتشف مجموعة كور',
    cta_url: '/collections/core',
    image_id: uuid(12),
    background: 'charcoal',
  },
  {
    section: 5,
    eyebrow: 'MORE THAN A ROTATION',
    heading: 'FOR THOSE WHO SHOW UP.',
    heading_ar: 'للي بيختاروا يكملوا.',
    description: 'From the first step to the final rep. Get to know the mindset behind EVOLVE.',
    description_ar: 'من أول خطوة لآخر تكرار. اكتشف الفكرة وراء EVOLVE.',
    cta_label: 'Our story',
    cta_label_ar: 'قصة EVOLVE',
    cta_url: '/about',
    background: 'red',
  },
  {
    section: 6,
    heading: 'Made to move',
    heading_ar: 'مصممة للحركة',
    description: 'Fits that give you space to move your way.',
    description_ar: 'قصات تسيب لك مساحة تتحرك بطريقتك.',
  },
  {
    section: 6,
    heading: 'Purpose in every detail',
    heading_ar: 'كل تفصيلة لها هدف',
    description: 'Clean lines and practical details, without the noise.',
    description_ar: 'خطوط نظيفة وتفاصيل عملية بدون تعقيد.',
  },
  {
    section: 6,
    heading: 'Beyond the gym',
    heading_ar: 'أبعد من الجيم',
    description: 'A rotation that feels at home in and beyond the gym.',
    description_ar: 'قطع تقدر تلبسها في النادي وخارجه.',
  },
  {
    section: 7,
    eyebrow: 'GOOD TO KNOW / FAQ',
    heading: 'FAQ',
    description: 'A few details to help you make your next move.',
    cta_label: 'Contact us',
    cta_url: '/contact',
  },
];
const order = {};
content.forEach(({ section, ...row }, i) =>
  insert('homepage_content', {
    id: uuid(400 + i),
    section_id: uuid(300 + section),
    cta_url: '/shop',
    background: 'ivory',
    display_order: (order[section] = (order[section] ?? -1) + 1),
    ...row,
  }),
);
insert('faqs', {
  id: uuid(500),
  question: 'How do I choose a size?',
  question_ar: 'أختار المقاس إزاي؟',
  answer:
    'Check the size guide on the product page. Development measurements are illustrative until final garment specifications are supplied.',
  answer_ar:
    'راجع دليل المقاسات في صفحة المنتج. القياسات توضيحية لحد إضافة مواصفات القطع النهائية.',
  active: true,
  display_order: 0,
});
insert('faqs', {
  id: uuid(501),
  question: 'Can I place an order?',
  question_ar: 'أقدر أعمل طلب؟',
  answer:
    'Checkout stays unavailable until the store owner enables it. Card payments are not supported by this installation.',
  answer_ar:
    'إتمام الطلب غير متاح لحد ما صاحب المتجر يفعله. النسخة الحالية لا تدعم الدفع بالبطاقات.',
  active: true,
  display_order: 1,
});
statements.push('commit;');
await writeFile(new URL('../supabase/seed.sql', import.meta.url), statements.join('\n') + '\n');
const homepageTables = [
  'media',
  'categories',
  'collections',
  'homepage_sections',
  'homepage_content',
  'faqs',
];
const homepageRecords = records.filter(({ table }) => homepageTables.includes(table));
await writeFile(
  new URL('../supabase/homepage.json', import.meta.url),
  JSON.stringify(homepageRecords, null, 2) + '\n',
);
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
const bootstrap = homepageRecords.map(({ table, values }) => {
  const serialized = Object.entries(values).map(([column, value]) => {
    const parentTable = references[column];
    if (!parentTable || !value) return sql(value);
    const parent = homepageRecords.find(
      (record) => record.table === parentTable && record.values.id === value,
    );
    const naturalKey = naturalKeys[parentTable];
    return `(select id from public.${parentTable} where ${naturalKey}=${sql(parent.values[naturalKey])})`;
  });
  return `insert into public.${table}(${Object.keys(values).join(',')}) values(${serialized.join(',')}) on conflict do nothing;`;
});
await writeFile(
  new URL('../supabase/migrations/202610070011_initial_homepage.sql', import.meta.url),
  '-- Initial editorial content for an empty homepage. No products, stock or checkout changes.\n' +
    'do $homepage$\nbegin\nif exists(select 1 from public.homepage_sections) then return; end if;\n' +
    bootstrap.join('\n') +
    '\nend;\n$homepage$;\n',
);
const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrations = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const setup = [
  '-- EVOLVE: run once on a NEW Supabase project. Includes the default homepage, but no products or stock.',
  `-- Existing stores must use updates.sql instead of rerunning this initialization.
do $setup_guard$
begin
  if to_regclass('public.admin_profiles') is not null then
    raise exception 'EVOLVE is already initialized. Run backend/supabase/updates.sql for the latest updates; do not rerun setup.sql.';
  end if;
end;
$setup_guard$;`,
];
for (const name of migrations) {
  setup.push(`-- Migration: ${name}`, await readFile(new URL(name, migrationDirectory), 'utf8'));
}
await writeFile(new URL('../supabase/setup.sql', import.meta.url), setup.join('\n') + '\n');
