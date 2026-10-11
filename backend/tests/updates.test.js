import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('existing-store SQL adds missing settings and can be repeated without replacing saved data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.admin_profiles(id integer primary key, name text);
      insert into public.admin_profiles values(1,'Store owner');
      create table public.site_settings(id integer primary key,store_name text);
      insert into public.site_settings values(1,'EVOLVE');
      create table public.homepage_content(id integer primary key,heading text);
      insert into public.homepage_content values(1,'Custom headline');
      create table public.categories(id integer primary key,name text);
      insert into public.categories values(1,'Gym wear');
    `);
    const sql = await readFile(new URL('../supabase/updates.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    assert.equal(
      (await db.query('select dispatch_days_min from site_settings')).rows[0].dispatch_days_min,
      2,
    );
    assert.equal(
      (await db.query('select show_page_title from categories')).rows[0].show_page_title,
      false,
    );
    await db.exec(
      'update site_settings set dispatch_days_min=3,dispatch_days_max=4; update homepage_content set show_heading=false; update categories set show_page_title=true;',
    );
    const before = {
      settings: (await db.query('select * from site_settings')).rows,
      hero: (await db.query('select * from homepage_content')).rows,
      admins: (await db.query('select * from admin_profiles')).rows,
      categories: (await db.query('select * from categories')).rows,
    };
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from site_settings')).rows, before.settings);
    assert.deepEqual((await db.query('select * from homepage_content')).rows, before.hero);
    assert.deepEqual((await db.query('select * from admin_profiles')).rows, before.admins);
    assert.deepEqual((await db.query('select * from categories')).rows, before.categories);
    const setup = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
    await assert.rejects(() => db.exec(setup), /EVOLVE is already initialized/);
    assert.deepEqual((await db.query('select * from admin_profiles')).rows, before.admins);
  } finally {
    await db.close();
  }
});
