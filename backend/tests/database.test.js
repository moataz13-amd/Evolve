import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('commerce migrations enforce roles, trusted totals, stock and order isolation', async () => {
  const db = new PGlite();
  try {
    // Supabase owns these schemas in production. Only their contracts are stubbed here.
    await db.exec(
      `
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
    `.replace(
        "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
        "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
      ),
    );
    await db.exec(`
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      grant usage on schema auth,storage to anon,authenticated;
      grant execute on all functions in schema auth to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
    `);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      try {
        await db.exec(await readFile(new URL(file, directory), 'utf8'));
      } catch (error) {
        throw new Error(`${file}: ${error.message}`, { cause: error });
      }
    }
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.homepage_sections where active and published',
        )
      ).rows[0].n,
      8,
      'fresh databases have a published homepage',
    );
    assert.equal(
      (await db.query('select count(*)::int as n from public.products')).rows[0].n,
      0,
      'homepage initialization never creates sellable sample products',
    );
    await db.exec(
      "update public.homepage_content set heading='Custom hero' where id='e7010000-0000-4000-8000-000000000400'",
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610070011_initial_homepage.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(
      (
        await db.query(
          "select heading from public.homepage_content where id='e7010000-0000-4000-8000-000000000400'",
        )
      ).rows[0].heading,
      'Custom hero',
      'initialization preserves merchant edits',
    );
    const ids = Object.fromEntries(
      ['admin', 'editor', 'customer', 'other', 'product', 'variant', 'hidden', 'key'].map(
        (key, i) => [key, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`],
      ),
    );
    await db.exec(`
      insert into auth.users(id,email) values ('${ids.admin}','admin@example.com'),('${ids.editor}','editor@example.com'),('${ids.customer}','customer@example.com'),('${ids.other}','other@example.com');
      insert into public.admin_profiles(id,name,role) values ('${ids.admin}','Admin','super_admin'),('${ids.editor}','Editor','editor');
      update public.site_settings set allow_checkout=true,shipping_fee=5,currency='EGP',shipping_rates='{"alexandria":20}';
      insert into public.products(id,name,slug,price,active) values ('${ids.product}','Test tee','test-tee',40,true),('${ids.hidden}','Hidden tee','hidden-tee',50,false);
      insert into public.product_variants(id,product_id,sku,size,color_name,stock) values ('${ids.variant}','${ids.product}','TEST-M-BLACK','M','Black',10);
      insert into public.promo_codes(code,discount_type,discount_value) values ('MOVE10','percentage',10);
    `);
    async function identity(role, id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify(id ? { sub: id, email: 'customer@example.com' } : {}),
      ]);
      await db.exec(`set role ${role}`);
    }
    await identity('anon');
    assert.equal(
      (await db.query('select * from public.products')).rows.length,
      1,
      'hidden products remain private',
    );
    await assert.rejects(db.query('select * from public.customers'), /permission denied/);
    await assert.rejects(
      db.query('select public.adjust_inventory($1,1,$2)', [ids.variant, 'Attempt']),
      /permission denied/,
    );
    const items = JSON.stringify([{ variant_id: ids.variant, quantity: 2 }]);
    const quote = (await db.query('select public.quote_order($1,$2) as quote', [items, 'MOVE10']))
      .rows[0].quote;
    assert.equal(Number(quote.total), 77);
    assert.equal(quote.currency, 'EGP');
    const alexandria = (
      await db.query('select public.quote_order($1,$2,$3) as quote', [
        items,
        'MOVE10',
        'alexandria',
      ])
    ).rows[0].quote;
    assert.equal(Number(alexandria.shipping), 20);
    assert.equal(Number(alexandria.total), 92);
    const fallback = (
      await db.query('select public.quote_order($1,$2,$3) as quote', [items, null, 'sohag'])
    ).rows[0].quote;
    assert.equal(Number(fallback.shipping), 5, 'unpriced governorates use the Cairo default');
    await assert.rejects(
      db.query('select public.quote_order($1,$2,$3)', [items, null, 'invalid']),
      /valid Egyptian governorate/,
    );
    await identity('authenticated', ids.editor);
    await assert.rejects(
      db.query('select public.adjust_inventory($1,1,$2)', [ids.variant, 'Attempt']),
      /requires an admin/,
    );
    await assert.rejects(
      db.query('update public.product_variants set stock=999 where id=$1', [ids.variant]),
      /Stock must be changed/,
    );
    assert.equal((await db.query('select * from public.product_costs')).rows.length, 0);
    await identity('authenticated', ids.customer);
    const details = JSON.stringify({
      name: 'Customer',
      address: 'Test street',
      city: 'Cairo',
      country: 'Egypt',
      total: 0,
    });
    const order = (
      await db.query('select public.create_order($1,$2,$3,$4) as id', [
        items,
        details,
        ids.key,
        'MOVE10',
      ])
    ).rows[0].id;
    const repeated = (
      await db.query('select public.create_order($1,$2,$3,$4) as id', [
        items,
        details,
        ids.key,
        'MOVE10',
      ])
    ).rows[0].id;
    assert.equal(order, repeated, 'retries do not duplicate orders');
    assert.equal(
      Number((await db.query('select total from public.orders')).rows[0].total),
      77,
      'client totals are ignored',
    );
    assert.equal((await db.query('select stock from public.product_variants')).rows[0].stock, 8);
    await assert.rejects(
      db.query('select public.create_order($1,$2,$3,$4)', [
        JSON.stringify([{ variant_id: ids.variant, quantity: 100 }]),
        details,
        crypto.randomUUID(),
        null,
      ]),
      /Insufficient stock/,
    );
    assert.equal((await db.query('select count(*)::int as n from public.orders')).rows[0].n, 1);
    await identity('authenticated', ids.other);
    assert.equal(
      (await db.query('select * from public.orders')).rows.length,
      0,
      'customers cannot read others orders',
    );
    await identity('authenticated', ids.admin);
    await db.query(
      "select public.update_order_status($1,'cancelled','pending','Customer request')",
      [order],
    );
    await db.query(
      "select public.update_order_status($1,'cancelled','pending','Repeated request')",
      [order],
    );
    assert.equal(
      (await db.query('select stock from public.product_variants')).rows[0].stock,
      10,
      'cancellation restores stock only once',
    );
    await identity('authenticated', ids.customer);
    await db.exec('begin');
    const deliveryOrder = (
      await db.query('select public.create_order($1,$2,$3,$4) as id', [
        JSON.stringify([{ variant_id: ids.variant, quantity: 1 }]),
        JSON.stringify({
          name: 'Customer',
          address: 'Test street',
          city: 'Alexandria',
          country: 'Egypt',
          governorate: 'alexandria',
          shipping: 0,
          total: 0,
        }),
        crypto.randomUUID(),
        null,
      ])
    ).rows[0].id;
    const captured = (
      await db.query('select shipping,total,governorate,currency from public.orders where id=$1', [
        deliveryOrder,
      ])
    ).rows[0];
    assert.equal(
      Number(captured.shipping),
      20,
      'server uses the governorate rate, ignoring client fees',
    );
    assert.equal(Number(captured.total), 60);
    assert.equal(captured.governorate, 'alexandria');
    assert.equal(captured.currency, 'EGP');
    await db.exec('rollback');
    await identity('authenticated', ids.admin);
    await db.exec('begin');
    await db.exec('update site_settings set free_shipping_threshold=80');
    assert.equal(
      Number(
        (
          await db.query('select public.quote_order($1,$2,$3) as quote', [
            items,
            null,
            'alexandria',
          ])
        ).rows[0].quote.shipping,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await db.query('select public.quote_order($1,$2,$3) as quote', [
            items,
            'MOVE10',
            'alexandria',
          ])
        ).rows[0].quote.shipping,
      ),
      20,
      'free shipping uses the discounted subtotal',
    );
    await db.exec('rollback');
    await assert.rejects(
      db.query("update public.site_settings set shipping_rates='{" + '"alexandria":-1' + "}'"),
      /valid_shipping_rates/,
    );
    const shippingSettings = (
      await db.query('select shipping_fee,shipping_rates,currency from site_settings')
    ).rows;
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/shipping.sql', import.meta.url), 'utf8'));
    assert.deepEqual(
      (await db.query('select shipping_fee,shipping_rates,currency from site_settings')).rows,
      shippingSettings,
      'rerunning the update preserves shipping prices',
    );
    await identity('authenticated', ids.admin);
    await assert.rejects(
      db.query('select public.adjust_inventory($1,-99,$2)', [ids.variant, 'Invalid adjustment']),
      /negative/,
    );
    const saved = (
      await db.query('select public.save_product($1,$2,$3,$4,$5,$6) as id', [
        null,
        JSON.stringify({
          name: 'RPC product',
          slug: 'rpc-product',
          price: 20,
          gender: 'Men',
          badge_mode: 'custom',
          badge_label: 'Limited',
          badge_label_ar: 'محدود',
          badge_variant: 'sale',
        }),
        JSON.stringify(
          ['S', 'M', 'L'].flatMap((size) =>
            ['Red', 'Black'].map((color) => ({
              id: crypto.randomUUID(),
              sku: size === 'S' && color === 'Red' ? 'RPC-S' : `RPC-${size}-${color}`,
              size,
              color_name: color,
              color_hex: color === 'Red' ? '#d93636' : '#20231f',
              stock: 3,
              active: true,
              track_quantity: true,
              low_stock_threshold: 5,
              price_override: color === 'Red' ? null : '',
            })),
          ),
        ),
        '[]',
        '{}',
        10,
      ])
    ).rows[0].id;
    assert.ok(saved, 'aggregate product editor saves transactionally');
    assert.equal(
      (await db.query('select badge_label from products where id=$1', [saved])).rows[0].badge_label,
      'Limited',
    );
    const savedVariants = (
      await db.query(
        'select id,size,color_name,stock,price_override from public.product_variants where product_id=$1 and active',
        [saved],
      )
    ).rows;
    assert.equal(
      savedVariants.length,
      6,
      'all combinations of three sizes and two colors are persisted',
    );
    assert.equal(new Set(savedVariants.map((variant) => variant.size)).size, 3);
    assert.equal(new Set(savedVariants.map((variant) => variant.color_name)).size, 2);
    assert.ok(savedVariants.every((variant) => variant.stock === 3));
    assert.ok(
      savedVariants.every((variant) => variant.price_override === null),
      'blank and null prices remain inherited in the database',
    );
    await db.exec('begin');
    await db.query('update products set active=true where id=$1', [saved]);
    const inheritedQuote = (
      await db.query('select public.quote_order($1) quote', [
        JSON.stringify([{ variant_id: savedVariants[0].id, quantity: 1 }]),
      ])
    ).rows[0].quote;
    assert.equal(Number(inheritedQuote.items[0].unit_price), 20);
    assert.equal(Number(inheritedQuote.subtotal), 20, 'inherited prices appear in checkout');
    await db.exec('rollback');
    await db.exec('reset role');
    const offersSql = await readFile(new URL('../supabase/offers.sql', import.meta.url), 'utf8');
    await db.exec(offersSql);
    await identity('authenticated', ids.admin);
    const offerId = crypto.randomUUID();
    const cheaperId = crypto.randomUUID();
    await db.query(
      'insert into public.offers(id,name,discount_type,discount_value) values($1,$2,$3,$4)',
      [offerId, 'Ten percent', 'percentage', 10],
    );
    assert.equal(
      Number(
        (await db.query('select public.quote_order($1) as quote', [items])).rows[0].quote.subtotal,
      ),
      80,
      'offers without selected products affect none',
    );
    await db.query('select public.set_offer_products($1,$2)', [
      offerId,
      [ids.product, ids.product],
    ]);
    assert.equal(
      (await db.query('select count(*)::int n from offer_products where offer_id=$1', [offerId]))
        .rows[0].n,
      1,
    );
    await db.query(
      'insert into public.offers(id,name,discount_type,discount_value) values($1,$2,$3,$4)',
      [cheaperId, 'Ten pounds', 'fixed', 10],
    );
    await db.query('select public.set_offer_products($1,$2)', [cheaperId, [ids.product]]);
    await identity('anon');
    const offeredQuote = (await db.query('select public.quote_order($1) as quote', [items])).rows[0]
      .quote;
    assert.equal(
      Number(offeredQuote.subtotal),
      60,
      'overlapping offers use the best price without stacking',
    );
    assert.equal(Number(offeredQuote.total), 65);
    const sale = (await db.query("select public.search_catalog(p_tag=>'SALE') result")).rows[0]
      .result;
    assert.ok(sale.ids.includes(ids.product), 'discounted products are included in sale discovery');
    await identity('authenticated', ids.customer);
    await assert.rejects(
      db.query('select public.set_offer_products($1,$2)', [offerId, []]),
      /Administrator access/,
    );
    await assert.rejects(
      db.query(
        "insert into offers(name,discount_type,discount_value) values('Forged','percentage',99)",
      ),
      /row-level security/,
    );
    await db.exec('begin');
    const offerOrderId = (
      await db.query('select public.create_order($1,$2,$3,$4) id', [
        items,
        details,
        crypto.randomUUID(),
        null,
      ])
    ).rows[0].id;
    const offerOrder = (
      await db.query('select subtotal,total from orders where id=$1', [offerOrderId])
    ).rows[0];
    assert.equal(Number(offerOrder.subtotal), 60);
    assert.equal(Number(offerOrder.total), 65);
    assert.equal(
      Number(
        (await db.query('select unit_price from order_items where order_id=$1', [offerOrderId]))
          .rows[0].unit_price,
      ),
      30,
      'orders capture the same offer price as quotes',
    );
    await db.exec('rollback');
    await identity('authenticated', ids.admin);
    await db.query("update offers set ends_at=now()-interval '1 minute' where id=$1", [cheaperId]);
    assert.equal(
      Number(
        (await db.query('select public.quote_order($1) quote', [items])).rows[0].quote.subtotal,
      ),
      72,
      'expired offers are excluded',
    );
    await db.query('select public.set_offer_products($1,$2)', [offerId, []]);
    assert.equal(
      Number(
        (await db.query('select public.quote_order($1) quote', [items])).rows[0].quote.subtotal,
      ),
      80,
      'removing a product restores its price',
    );
    await db.exec('reset role');
    await db.exec(offersSql);
    assert.equal(
      (await db.query('select count(*)::int n from offers')).rows[0].n,
      2,
      'repeat updates preserve offers',
    );
    await identity('authenticated', ids.admin);
    const giftId = crypto.randomUUID();
    await db.query(
      "insert into offers(id,name,discount_type,buy_quantity,get_quantity) values($1,'Buy two get one','buy_get',2,1)",
      [giftId],
    );
    await db.query('select public.set_offer_products($1,$2)', [giftId, [ids.product]]);
    const giftQuote = async (quantity) =>
      (
        await db.query('select public.quote_order($1) quote', [
          JSON.stringify([{ variant_id: ids.variant, quantity }]),
        ])
      ).rows[0].quote;
    assert.equal(Number((await giftQuote(2)).subtotal), 80, 'no gift before the complete group');
    const three = await giftQuote(3);
    assert.equal(Number(three.subtotal), 80);
    assert.equal(Number(three.offer_discount), 40);
    assert.equal(three.items[0].free_quantity, 1);
    assert.equal(three.applied_offers[0].free_quantity, 1);
    assert.equal(Number((await giftQuote(6)).subtotal), 160, 'quantity offers repeat');
    const split = (
      await db.query('select public.quote_order($1) quote', [
        JSON.stringify([
          { variant_id: ids.variant, quantity: 2 },
          { variant_id: ids.variant, quantity: 1 },
        ]),
      ])
    ).rows[0].quote;
    assert.equal(split.items[0].free_quantity, 1, 'duplicate variant lines are grouped');
    await db.exec('begin');
    await identity('authenticated', ids.customer);
    const giftOrder = (
      await db.query('select public.create_order($1,$2,$3,$4) id', [
        JSON.stringify([{ variant_id: ids.variant, quantity: 3 }]),
        details,
        crypto.randomUUID(),
        null,
      ])
    ).rows[0].id;
    const giftCaptured = (
      await db.query(
        'select quantity,free_quantity,unit_price from order_items where order_id=$1',
        [giftOrder],
      )
    ).rows[0];
    assert.equal(giftCaptured.quantity, 3);
    assert.equal(giftCaptured.free_quantity, 1);
    assert.equal(Number(giftCaptured.unit_price), 40);
    assert.equal(
      Number(
        (await db.query('select subtotal from orders where id=$1', [giftOrder])).rows[0].subtotal,
      ),
      80,
    );
    assert.equal(
      (await db.query('select stock from product_variants where id=$1', [ids.variant])).rows[0]
        .stock,
      7,
      'gifts consume real inventory',
    );
    await identity('authenticated', ids.admin);
    await db.query(
      "select public.update_order_status($1,'cancelled','pending','Gift test cancellation')",
      [giftOrder],
    );
    assert.equal(
      (await db.query('select stock from product_variants where id=$1', [ids.variant])).rows[0]
        .stock,
      10,
      'cancellation restores paid and gifted pieces',
    );
    await db.exec('rollback');
    await identity('authenticated', ids.admin);
    await db.query('select public.set_offer_products($1,$2)', [offerId, [ids.product]]);
    await db.query('update offers set discount_value=90 where id=$1', [offerId]);
    const best = await giftQuote(3);
    assert.equal(Number(best.subtotal), 12, 'a better regular discount wins without stacking');
    assert.equal(best.items[0].free_quantity, 0);
    await db.query('select public.set_offer_products($1,$2)', [offerId, []]);
    await db.query('update offers set active=false where id=$1', [giftId]);
    assert.equal(
      Number((await giftQuote(3)).subtotal),
      120,
      'inactive quantity offers are excluded',
    );
    await db.query('update offers set active=true where id=$1', [giftId]);
    await db.exec('begin');
    const cheapProduct = crypto.randomUUID(),
      cheapVariant = crypto.randomUUID();
    await db.query(
      "insert into products(id,name,slug,price,active) values($1,'Cheaper gift','cheaper-gift',20,true)",
      [cheapProduct],
    );
    await db.query(
      "insert into product_variants(id,product_id,sku,size,color_name,color_hex,stock) values($1,$2,'CHEAP-GIFT','L','Red','#d93636',0)",
      [cheapVariant, cheapProduct],
    );
    await db.query('select public.adjust_inventory($1,10,$2)', [cheapVariant, 'Gift test stock']);
    await db.query('select public.set_offer_products($1,$2)', [
      giftId,
      [ids.product, cheapProduct],
    ]);
    const mixed = (
      await db.query('select public.quote_order($1) quote', [
        JSON.stringify([
          { variant_id: ids.variant, quantity: 2 },
          { variant_id: cheapVariant, quantity: 1 },
        ]),
      ])
    ).rows[0].quote;
    assert.equal(Number(mixed.subtotal), 80);
    assert.equal(
      mixed.items.find((line) => line.variant_id === cheapVariant).free_quantity,
      1,
      'the cheapest eligible piece is free',
    );
    assert.equal(mixed.items.find((line) => line.variant_id === ids.variant).free_quantity, 0);
    await db.exec('rollback');
    await identity('authenticated', ids.admin);
    await assert.rejects(
      db.query('update offers set buy_quantity=0 where id=$1', [giftId]),
      /offers_discount_rule/,
    );
    await assert.rejects(giftQuote(11), /stock|available|quantity/i);
    await db.exec('reset role');
    await db.exec(offersSql);
    await identity('authenticated', ids.admin);
    assert.equal(
      (await giftQuote(3)).items[0].free_quantity,
      1,
      'repeat updates preserve quantity offers',
    );
    const typeId = crypto.randomUUID();
    await db.query(
      "insert into offer_types(id,name,calculation) values($1,'Training bundle','buy_get')",
      [typeId],
    );
    await db.query("update offers set offer_type_id=$1,discount_type='fixed' where id=$2", [
      typeId,
      giftId,
    ]);
    assert.equal(
      (await db.query('select discount_type from offers where id=$1', [giftId])).rows[0]
        .discount_type,
      'buy_get',
      'custom types enforce their trusted calculation method',
    );
    assert.equal((await giftQuote(3)).items[0].free_quantity, 1);
    await db.query("update offer_types set name='Gym bundle' where id=$1", [typeId]);
    await assert.rejects(
      db.query("update offer_types set calculation='fixed' where id=$1", [typeId]),
      /already used/,
    );
    await db.query('update offer_types set active=false where id=$1', [typeId]);
    await db.query("update offers set name='Existing bundle' where id=$1", [giftId]);
    await assert.rejects(
      db.query(
        "insert into offers(name,discount_type,buy_quantity,get_quantity,offer_type_id) values('Inactive choice','buy_get',2,1,$1)",
        [typeId],
      ),
      /active offer type/,
    );
    await identity('authenticated', ids.customer);
    assert.equal(
      (await db.query('select * from offer_types')).rows.length,
      0,
      'customers cannot access admin offer types',
    );
    await assert.rejects(
      db.query("insert into offer_types(name,calculation) values('Forged type','fixed')"),
      /row-level security/,
    );
    await identity('authenticated', ids.editor);
    await assert.rejects(
      db.query("insert into offer_types(name,calculation) values('Editor type','fixed')"),
      /row-level security/,
    );
    await identity('authenticated', ids.admin);
    await db.query('delete from offer_types where id=$1', [typeId]);
    assert.equal(
      (await db.query('select offer_type_id from offers where id=$1', [giftId])).rows[0]
        .offer_type_id,
      null,
      'deleting a custom type preserves existing offers',
    );
    assert.equal(
      (await giftQuote(3)).items[0].free_quantity,
      1,
      'deleting the name does not change pricing',
    );
    const percentType = crypto.randomUUID();
    await db.query(
      "insert into offer_types(id,name,calculation) values($1,'Flash discount','percentage')",
      [percentType],
    );
    const typedOffer = crypto.randomUUID();
    await db.query(
      "insert into offers(id,name,discount_type,discount_value,offer_type_id) values($1,'Flash offer','fixed',25,$2)",
      [typedOffer, percentType],
    );
    assert.equal(
      (await db.query('select discount_type from offers where id=$1', [typedOffer])).rows[0]
        .discount_type,
      'percentage',
    );
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/offer-types.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/offer-types.sql', import.meta.url), 'utf8'));
    await identity('authenticated', ids.admin);
    assert.equal(
      (await db.query('select name from offer_types where id=$1', [percentType])).rows[0].name,
      'Flash discount',
      'repeat updates preserve custom types',
    );
    const overview = (await db.query('select public.admin_overview(30) as overview')).rows[0]
      .overview;
    assert.ok(overview.stats);
    const found = (await db.query('select public.search_catalog($1) as result', ['Test'])).rows[0]
      .result;
    assert.equal(found.count, 1, 'catalog searches operate on all published products');
    const catalog = (await db.query('select public.admin_catalog(\'{"q":"RPC-S"}\') as result'))
      .rows[0].result;
    assert.equal(catalog.rows.length, 1, 'admin catalog searches variant SKUs');
    await identity('authenticated', ids.editor);
    await assert.rejects(
      db.query('update public.products set archived=true where id=$1', [saved]),
      /Archive requires/,
    );
    await assert.rejects(
      db.query('select public.save_product($1,$2,$3,$4,$5,$6)', [
        null,
        JSON.stringify({ name: 'Invalid stock', slug: 'invalid-stock', price: 20 }),
        JSON.stringify([
          { sku: 'FORBIDDEN', size: 'S', color_name: 'Black', color_hex: '#20231f', stock: 100 },
        ]),
        '[]',
        '{}',
        null,
      ]),
      /Inventory adjustment/,
    );
    await identity('authenticated', ids.admin);
    await assert.rejects(
      db.query('update public.admin_profiles set active=false where id=$1', [ids.admin]),
      /at least one active/,
    );
    // Test discovery against the complete catalog, not the first storefront page.
    await db.exec('reset role');
    const placementSql = await readFile(
      new URL('../supabase/catalog-placement.sql', import.meta.url),
      'utf8',
    );
    await db.exec(placementSql);
    const categoryId = crypto.randomUUID();
    const manualId = crypto.randomUUID();
    const autoId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const targetVariant = crypto.randomUUID();
    await db.query(
      "insert into categories(id,name,slug,active) values($1,'Placement','placement',true)",
      [categoryId],
    );
    await db.query(
      "insert into collections(id,name,slug,product_rule) values($1,'Manual','placement-manual','manual'),($2,'New','placement-new','NEW')",
      [manualId, autoId],
    );
    await db.query(
      "insert into products(id,name,slug,category_id,price,active,new_arrival,best_seller,tags) values($1,'Placement target','placement-target',$2,1200,true,true,true,array['restock'])",
      [targetId, categoryId],
    );
    await db.query(
      "insert into product_variants(id,product_id,sku,size,color_name,stock) values($1,$2,'PLACEMENT-M-RUBY','M','Ruby',10)",
      [targetVariant, targetId],
    );
    await db.query('insert into product_collections(product_id,collection_id) values($1,$2)', [
      targetId,
      manualId,
    ]);
    const facetCategory = crypto.randomUUID();
    await db.query(
      "insert into categories(id,name,slug,active) values($1,'Facet category','facet-category',true)",
      [facetCategory],
    );
    await db.query(
      "insert into products(name,slug,category_id,price,active,created_at) select 'Facet '||n,'facet-'||n,$1,case when n=26 then 9000 else 100 end,true,now()-n*interval '1 day' from generate_series(1,26) n",
      [facetCategory],
    );
    await db.query(
      "insert into product_variants(product_id,sku,size,color_name,stock) select id,'FACET-LAST','XXL','Last page color',10 from products where slug='facet-26'",
    );
    await identity('anon');
    const fullFacets = (
      await db.query('select public.search_catalog(p_category=>$1) result', [facetCategory])
    ).rows[0].result;
    assert.equal(fullFacets.count, 26);
    assert.equal(fullFacets.ids.length, 24);
    assert.deepEqual(
      fullFacets.facets.colors,
      ['Last page color'],
      'filters include variants on later pages',
    );
    assert.equal(fullFacets.facets.maxPrice, 9000, 'price ceiling covers later pages');
    const laterMatch = (
      await db.query(
        "select public.search_catalog(p_category=>$1,p_size=>'XXL',p_color=>'Last page color') result",
        [facetCategory],
      )
    ).rows[0].result;
    assert.equal(laterMatch.count, 1);
    assert.ok(
      !fullFacets.ids.includes(laterMatch.ids[0]),
      'matching product was outside the first page',
    );
    async function placement(tag, collection = null) {
      return (
        await db.query(
          'select public.search_catalog(p_category=>$1,p_tag=>$2,p_collection=>$3) result',
          [categoryId, tag, collection],
        )
      ).rows[0].result;
    }
    for (const tag of ['NEW', 'BESTSELLER', 'RESTOCK'])
      assert.deepEqual((await placement(tag)).ids, [targetId], tag + ' independent placement');
    assert.equal((await placement('', autoId)).count, 1);
    assert.equal((await placement('', manualId)).count, 1);
    assert.deepEqual((await placement('')).facets.colors, ['Ruby']);
    assert.equal((await placement('SALE')).count, 0);
    await identity('authenticated', ids.admin);
    const placementOffer = crypto.randomUUID();
    await db.query(
      "insert into offers(id,name,discount_type,buy_quantity,get_quantity) values($1,'Placement gift','buy_get',2,1)",
      [placementOffer],
    );
    await db.query('select public.set_offer_products($1,$2)', [placementOffer, [targetId]]);
    await identity('anon');
    assert.equal((await placement('BUY_2_GET_1')).count, 1);
    assert.deepEqual(
      (await placement('OFFER:' + placementOffer)).ids,
      [targetId],
      'announcement links show only products assigned to that offer',
    );
    assert.equal(
      (await placement('OFFER:00000000-0000-4000-8000-000000000000')).count,
      0,
      'unknown offers never fall back to the entire catalog',
    );
    await identity('authenticated', ids.admin);
    await db.query("update offers set ends_at=now()-interval '1 minute' where id=$1", [
      placementOffer,
    ]);
    await db.query(
      "update products set compare_at_price=1500,tags=array['Coming Soon','RESTOCK'] where id=$1",
      [targetId],
    );
    await identity('anon');
    assert.equal((await placement('BUY_GET')).count, 0, 'expired bundles leave their collection');
    assert.equal(
      (await placement('OFFER:' + placementOffer)).count,
      0,
      'expired announcement links cannot show unrelated products',
    );
    assert.equal((await placement('SALE')).count, 1, 'real markdowns enter sale');
    assert.equal((await placement('COMING_SOON')).count, 1);
    await assert.rejects(
      db.query('select public.quote_order($1)', [
        JSON.stringify([{ variant_id: targetVariant, quantity: 1 }]),
      ]),
      /Coming soon products cannot be ordered/,
    );
    await identity('authenticated', ids.admin);
    await db.query("update collections set product_rule='manual' where id=$1", [autoId]);
    await db.exec('reset role');
    await db.exec(placementSql);
    assert.equal(
      (await db.query('select product_rule from collections where id=$1', [autoId])).rows[0]
        .product_rule,
      'manual',
      'repeated updates preserve the merchant collection rule',
    );
    await db.query('update products set archived=true where id=$1', [targetId]);
    await identity('anon');
    assert.equal((await placement('')).count, 0, 'archived products leave every page');
    await db.exec('reset role');
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
    assert.equal(
      (await db.query('select count(*)::int as n from public.homepage_sections')).rows[0].n,
      8,
      'seed is repeatable',
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610130001_guest_checkout_quantity.sql', import.meta.url),
        'utf8',
      ),
    );
    const guestId = crypto.randomUUID();
    await db.query('insert into auth.users(id,email) values($1,null)', [guestId]);
    assert.equal(
      (await db.query('select count(*)::int as n from public.customers where id=$1', [guestId]))
        .rows[0].n,
      0,
      'anonymous signup waits for the guest checkout email',
    );
    await identity('authenticated', ids.admin);
    await db.query('select public.adjust_inventory($1,$2,$3)', [
      ids.variant,
      140,
      'Guest checkout test stock',
    ]);
    assert.equal(
      (await db.query('select stock from public.product_variants where id=$1', [ids.variant]))
        .rows[0].stock,
      150,
    );
    assert.deepEqual(
      (
        await db.query(
          'select v.active variant_active,p.active product_active,p.archived from public.product_variants v join public.products p on p.id=v.product_id where v.id=$1',
          [ids.variant],
        )
      ).rows[0],
      { variant_active: true, product_active: true, archived: false },
    );
    await identity('anon');
    await assert.rejects(
      db.query('select public.prepare_guest_checkout($1,$2)', ['Guest', 'guest@example.com']),
      /permission denied/,
    );
    await identity('authenticated', guestId);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: guestId, is_anonymous: true }),
    ]);
    await assert.rejects(
      db.query('select public.prepare_guest_checkout($1,$2)', ['Guest', 'invalid-email']),
      /valid email/,
    );
    await db.query('select public.prepare_guest_checkout($1,$2)', ['Guest', 'guest@example.com']);
    const largeItems = JSON.stringify([{ variant_id: ids.variant, quantity: 120 }]);
    const quoteDefinition = (
      await db.query(
        "select pg_get_functiondef('public.quote_order(jsonb,text,text)'::regprocedure) definition",
      )
    ).rows[0].definition;
    assert.equal(quoteDefinition.includes('item.qty not between 1 and 100'), false);
    const largeQuote = (
      await db.query('select public.quote_order($1,$2,$3) as quote', [largeItems, null, 'cairo'])
    ).rows[0].quote;
    assert.equal(
      Number(largeQuote.subtotal),
      3200,
      'quote accepts quantities above 100 and applies offers',
    );
    const guestOrder = (
      await db.query('select public.create_order($1,$2,$3,$4) as id', [
        largeItems,
        JSON.stringify({
          name: 'Guest',
          address: 'Test street',
          city: 'Cairo',
          country: 'Egypt',
          governorate: 'cairo',
        }),
        crypto.randomUUID(),
        null,
      ])
    ).rows[0].id;
    assert.equal(
      (await db.query('select email from public.orders where id=$1', [guestOrder])).rows[0].email,
      'guest@example.com',
    );
    await assert.rejects(
      db.query('select public.quote_order($1,$2,$3)', [
        JSON.stringify([{ variant_id: ids.variant, quantity: 31 }]),
        null,
        'cairo',
      ]),
      /insufficient stock/,
    );
    await identity('authenticated', ids.other);
    assert.equal(
      (await db.query('select count(*)::int as n from public.orders where id=$1', [guestOrder]))
        .rows[0].n,
      0,
      'other customers cannot access guest orders',
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
