import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { database, mediaUrl } from '../../lib/supabase';
import { options, saveRecord, throwIfError } from '../../services/admin.service';
import { hero } from '../../data/products';
import { MediaPicker } from '../components/MediaPicker';
import { ErrorState, LoadingSkeleton, PageHeader } from '../components/UI';
import type { Row } from '../../types/admin';

const defaults = {
  eyebrow: 'ENGINEERED TO WORK. BUILT TO LIVE.',
  heading: 'STRENGTH IN\nEVERY MOVE.',
  heading_ar: 'القوة في\nكل حركة.',
  description:
    'Purpose-built essentials for the way you move.\nFrom your first rep to your next chapter.',
  description_ar: 'ملابس أساسية تواكب طموحك. من أول تكرار إلى آخر خطوة.',
  cta_label: 'Shop Now',
  cta_label_ar: 'تسوق الآن',
  cta_url: '/shop',
  image_id: null as string | null,
  show_eyebrow: true,
  show_heading: true,
  show_description: true,
};
type HeroValues = typeof defaults;
type TextKey = Exclude<
  keyof HeroValues,
  'image_id' | 'show_eyebrow' | 'show_heading' | 'show_description'
>;
const visibilityFields = {
  eyebrow: 'show_eyebrow',
  heading: 'show_heading',
  description: 'show_description',
} as const;
const copyFields = [
  ['eyebrow', 'Small headline', false],
  ['heading', 'Main headline *', true],
  ['description', 'Supporting text', true],
  ['cta_label', 'Button label *', false],
  ['cta_url', 'Button destination *', false],
] as const;
const arabicFields = [
  ['heading_ar', 'العنوان الرئيسي', true],
  ['description_ar', 'النص التعريفي', true],
  ['cta_label_ar', 'اسم الزر', false],
] as const;

function HeroForm({ section }: { section: Row | null }) {
  const client = useQueryClient();
  const row: Row | undefined = [...(section?.homepage_content || [])].sort(
    (a, b) => a.display_order - b.display_order,
  )[0];
  const [values, setValues] = useState<HeroValues>(
    () =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [
          key,
          row ? (row[key] ?? fallback) : fallback,
        ]),
      ) as HeroValues,
  );
  const [uploading, setUploading] = useState(false);
  const [arabic, setArabic] = useState(false);
  const [validation, setValidation] = useState('');
  const [dirty, setDirty] = useState(false);
  const media = useQuery({ queryKey: ['options', 'media'], queryFn: () => options('media') });
  const image = media.data?.find((item) => item.id === values.image_id);
  const live = Boolean(section?.active && section?.published);
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin'] }),
      client.invalidateQueries({ queryKey: ['storefront', 'content'] }),
    ]);
  }
  const save = useMutation({
    mutationFn: async () => {
      // New sections start unpublished; saving existing content preserves visibility.
      const target =
        section ||
        (await saveRecord('homepage_sections', {
          key: 'hero',
          title: 'Hero',
          active: true,
          published: false,
          display_order: 0,
        }));
      return saveRecord(
        'homepage_content',
        {
          ...values,
          section_id: target.id,
          display_order: row?.display_order ?? 0,
        },
        row?.id,
      );
    },
    onSuccess: async () => {
      setDirty(false);
      await refresh();
    },
    onError: () => void client.invalidateQueries({ queryKey: ['admin', 'hero'] }),
  });
  const visibility = useMutation({
    mutationFn: () =>
      saveRecord('homepage_sections', { active: true, published: !live }, section!.id),
    onSuccess: refresh,
  });
  const busy = uploading || save.isPending || visibility.isPending;
  function update<Key extends keyof HeroValues>(key: Key, value: HeroValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    save.reset();
    setValidation('');
  }
  function renderField([key, label, multiline]: readonly [TextKey, string, boolean]) {
    const visibilityKey = visibilityFields[key as keyof typeof visibilityFields];
    const enabled = !visibilityKey || values[visibilityKey];
    const required =
      (key === 'heading' && values.show_heading) || ['cta_label', 'cta_url'].includes(key);
    const inputProps = {
      id: `hero-${key}`,
      value: values[key],
      required,
      maxLength: key.includes('description') ? 1000 : 300,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update(key, event.target.value),
    };
    return (
      <div className="admin-field" key={key}>
        <div className="admin-hero-field-heading">
          <label htmlFor={inputProps.id}>
            {key === 'heading' && !enabled ? 'Main headline' : label}
          </label>
          {visibilityKey && (
            <label className="admin-hero-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-label={`Show ${label.replace(' *', '').toLowerCase()}`}
                checked={values[visibilityKey]}
                onChange={(event) => update(visibilityKey, event.target.checked)}
              />
              <span>{enabled ? 'Active' : 'Hidden'}</span>
            </label>
          )}
        </div>
        {multiline ? <textarea {...inputProps} rows={3} /> : <input {...inputProps} />}
        {key === 'heading' && (
          <small className="admin-muted">
            Use a new line to control where the headline breaks.
          </small>
        )}
        {key === 'cta_url' && (
          <small className="admin-muted">Store path, for example /shop or /collections/core.</small>
        )}
      </div>
    );
  }
  return (
    <>
      <PageHeader
        title="Hero section"
        subtitle="الصورة الرئيسية، النصوص وزر التسوق — في مكان واحد."
      >
        <Link to="/" target="_blank" className="admin-button">
          View homepage
        </Link>
      </PageHeader>
      <div className="admin-hero-status admin-card">
        <div>
          <strong>{live ? 'Visible on homepage' : 'Hidden from homepage'}</strong>
          <p className="admin-muted">
            {live
              ? 'Saving updates the live hero. Preview your changes below first.'
              : 'Save your content, then show the hero when it is ready.'}
          </p>
        </div>
        <button
          type="button"
          className="admin-button"
          disabled={busy || dirty || !row}
          onClick={() => {
            visibility.reset();
            visibility.mutate();
          }}
        >
          {visibility.isPending ? 'Updating…' : live ? 'Hide hero' : 'Show hero'}
        </button>
      </div>
      {visibility.isError && (
        <p className="admin-error" role="alert">
          {visibility.error.message}
        </p>
      )}
      {visibility.isSuccess && (
        <p className="admin-notice" role="status">
          Hero visibility updated.
        </p>
      )}
      <form
        className="admin-hero-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if ((values.show_heading && !values.heading.trim()) || !values.cta_label.trim()) {
            setValidation('Enter a headline and button label.');
            return;
          }
          if (!/^\/(?!\/)[^\s\\]*$/.test(values.cta_url)) {
            setValidation('Use a valid store path starting with /, such as /shop.');
            return;
          }
          visibility.reset();
          save.mutate();
        }}
      >
        <fieldset disabled={busy} className="admin-card admin-hero-fields">
          <legend>Hero content</legend>
          <div className="admin-field">
            <label>Hero image</label>
            <MediaPicker
              value={values.image_id}
              folder="homepage"
              disabled={busy}
              onBusyChange={setUploading}
              onChange={(id) => update('image_id', id)}
            />
            <small className="admin-muted">
              Landscape photography works best. Images are optimized before upload. No image
              selected uses the EVOLVE default.
            </small>
          </div>
          {copyFields.map(renderField)}
          <details className="admin-advanced">
            <summary>Arabic copy / النصوص العربية</summary>
            <div dir="rtl" className="admin-hero-arabic">
              {arabicFields.map(renderField)}
            </div>
            <small className="admin-muted">
              Leave Arabic fields empty to use the English copy.
            </small>
          </details>
          {(validation || save.isError) && (
            <p className="admin-error" role="alert">
              {validation || save.error?.message}
            </p>
          )}
          {save.isSuccess && (
            <p className="admin-notice" role="status">
              Hero saved successfully.
            </p>
          )}
          <button className="admin-button admin-primary" disabled={busy}>
            {uploading ? 'Uploading image…' : save.isPending ? 'Saving…' : 'Save hero'}
          </button>
        </fieldset>
        <aside className="admin-hero-preview-panel">
          <div className="admin-hero-preview-heading">
            <div>
              <strong>Live preview</strong>
              <p className="admin-muted">Unsaved changes · approximate layout</p>
            </div>
            <button type="button" className="admin-button" onClick={() => setArabic(!arabic)}>
              {arabic ? 'English' : 'العربية'}
            </button>
          </div>
          <div className="admin-hero-preview" dir={arabic ? 'rtl' : 'ltr'}>
            <img
              src={mediaUrl(image?.path) || hero}
              alt="Selected hero background preview"
              width="900"
              height="1000"
            />
            <div className="admin-hero-preview-copy">
              {values.show_eyebrow && <span>{values.eyebrow}</span>}
              {values.show_heading && (
                <h2>{arabic ? values.heading_ar || values.heading : values.heading}</h2>
              )}
              {values.show_description && (
                <p>{arabic ? values.description_ar || values.description : values.description}</p>
              )}
            </div>
            <span className="admin-hero-preview-button">
              {arabic ? values.cta_label_ar || values.cta_label : values.cta_label}
            </span>
          </div>
          <p className="admin-muted">
            The centered headline and glass button keep the EVOLVE design consistent. Save changes
            to apply them to the homepage.
          </p>
        </aside>
      </form>
    </>
  );
}

export default function HeroEditorPage() {
  const query = useQuery({
    queryKey: ['admin', 'hero'],
    queryFn: async () =>
      throwIfError(
        await database()
          .from('homepage_sections')
          .select('*,homepage_content(*)')
          .eq('key', 'hero')
          .maybeSingle(),
      ),
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => void query.refetch()} />;
  return <HeroForm section={query.data} />;
}
