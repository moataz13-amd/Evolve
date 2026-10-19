# EVOLVE backend

The backend runs on Supabase: PostgreSQL, Auth and Storage. Trusted commerce functions, RLS policies and schema changes live in `supabase/migrations`. Browser API calls belong to `../frontend/src/services`.

Guest checkout uses Supabase anonymous sign-ins. Apply `supabase/migrations/202610130001_guest_checkout_quantity.sql` to an existing store before enabling anonymous sign-ins in Supabase Auth. The migration keeps guest orders tied to the temporary user session, validates the supplied email, and retains transactional stock checks. Guest order history is available only while that browser session remains active. For local development, `supabase/config.toml` enables anonymous sign-ins.

Apply `supabase/migrations/202610200001_gifts_from_stock.sql` to existing stores before deploying the matching storefront. Cart quantities now mean paid pieces; a buy 2 get 1 offer adds one free piece for every two paid pieces. Both paid and free pieces consume the selected variants' stock in the order transaction. For example, 1,200 available pieces support at most 800 paid plus 400 free. Use ordered migrations for updates; the older `supabase/offers.sql` is a historical combined update and does not include this latest pricing change.

Cloudinary media uploads run through `supabase/functions/cloudinary-media`. The function validates the user's Supabase session and active admin role, signs Cloudinary requests on the server, and writes media URLs with the caller's RLS permissions. API secrets stay in backend environment variables and deployed Edge Function secrets. Existing Supabase images remain supported. See [Cloudinary setup](../docs/CLOUDINARY_SETUP_AR.md) for environment variables and deployment commands; no additional SQL migration is required.

Set `SUPABASE_PROJECT_REF` and, if required by the CLI, `SUPABASE_DB_PASSWORD` in the local `.env`. The optional `SUPABASE_SERVICE_ROLE_KEY` is used only by the Node homepage restoration tool; migration commands and browser code do not use it. Never place this credential in the frontend or a `VITE_` variable. Configuration is in `supabase/config.toml`.

Fresh setup includes the original editorial homepage by default, without products or stock. Restore missing homepage defaults with `npm run db:homepage:restore --workspace backend` from the root. This uses the frontend project URL and backend service role key, inserts missing content, and preserves existing rows. It does not publish products or enable checkout. The generated `homepage.json`, migration 011 and `setup.sql` come from `scripts/generate-seed.mjs`.

From the repository root:

```sh
npm install
npx supabase login
npm run db:link
npm run db:push
```

`db:push` checks that the linked project matches `.env`. Migration changes still require review before applying them to an existing database. The optional seed is development content; remote migration commands do not include it automatically.

For a local Supabase instance, install and start Docker, then run `npm run db:start`. Use the public API URL and publishable/anon key from the CLI output in `frontend/.env`. Stop it with `npm run db:stop`. Local credentials belong only to the local instance.

Database checks: `npm test --workspace backend`. Full setup, first admin and deployment instructions: [Arabic guide](../docs/SUPABASE_SETUP_AR.md).
