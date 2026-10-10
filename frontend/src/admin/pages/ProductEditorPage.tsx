import { Select } from '../../components/Select';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, variantsSchema } from '../components/productSchema';
import { getProduct, saveProduct } from '../../services/products.service';
import { options, saveRecord } from '../../services/admin.service';
import { useAuth } from '../../context/AuthContext';
import { VariantEditor, newVariant } from '../components/VariantEditor';
import { ProductImages } from '../components/ProductImages';
import { MediaPicker } from '../components/MediaPicker';
import { PageHeader, LoadingSkeleton, ErrorState } from '../components/UI';
import { catalogSlug, addVariantCombinations } from '../../utils/catalogEditor';
import { clothingLinks } from '../../data/navigation';
import { createUUID } from '../../utils/uuid';
import { Modal } from '../components/Modal';
import { RecordForm } from '../components/RecordForm';
import { resources } from '../components/resources';
import type { Row } from '../../types/admin';
function ProductForm({ record }: { record?: any }) {
  const { admin } = useAuth();
  const canAdjust = admin?.role !== 'editor';
  const navigate = useNavigate();
  const client = useQueryClient();
  const [variants, setVariants] = useState<Row[]>(() => record?.product_variants || [newVariant()]);
  const [selectedCombinations, setSelectedCombinations] = useState<{
    sizes: string[];
    colors: { name: string; hex: string }[];
    stock: number;
  } | null>(null);
  const [images, setImages] = useState<Row[]>(() =>
    [...(record?.product_images || [])].sort((a, b) => a.display_order - b.display_order),
  );
  const [collections, setCollections] = useState<string[]>(
    record?.product_collections.map((row: any) => row.collection_id) || [],
  );
  const [cost, setCost] = useState<string>(record?.product_costs?.cost?.toString() || '');
  const [og, setOg] = useState<string | null>(record?.og_image_id || null);
  const [validation, setValidation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ogUploading, setOgUploading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [slugToken] = useState(createUUID);
  const addCategory = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveRecord('categories', values),
    onSuccess: (category) => {
      client.setQueryData<Row[]>(['options', 'categories'], (current) => [
        ...(current || []),
        category,
      ]);
      setValue('category_id', category.id, { shouldDirty: true });
      void client.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void client.invalidateQueries({ queryKey: ['storefront', 'content'] });
      setCategoryOpen(false);
    },
  });
  const categories = useQuery({
    queryKey: ['options', 'categories'],
    queryFn: () => options('categories'),
  });
  const collectionOptions = useQuery({
    queryKey: ['options', 'collections'],
    queryFn: () => options('collections'),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      name_ar: '',
      slug: '',
      price: '',
      active: false,
      featured: false,
      new_arrival: false,
      best_seller: false,
      badge_mode: 'auto',
      badge_label: '',
      badge_label_ar: '',
      badge_variant: 'new',
      archived: false,
      gender: 'Men',
      category_id: '',
      product_type: 'T-Shirts',
      description: '',
      description_ar: '',
      short_description: '',
      compare_at_price: '',
      meta_title: '',
      meta_description: '',
      ...record,
      tags: (record?.tags || []).join(', '),
    },
  });
  const name = watch('name');
  useEffect(() => {
    if (!record?.slug && !getFieldState('slug').isDirty) {
      setValue('slug', name.trim() ? catalogSlug(name, slugToken) : '', { shouldValidate: false });
    }
  }, [name, record?.slug, slugToken, getFieldState, setValue]);
  const save = useMutation({
    mutationFn: saveProduct,
    onSuccess: (id) => {
      void client.invalidateQueries();
      navigate('/admin/products/' + id, { replace: true });
    },
  });
  return (
    <>
      <PageHeader
        title={record ? 'Edit product' : 'Add product'}
        subtitle="Add the essentials, upload photos, choose sizes — then save."
      />
      <form
        className="admin-form admin-product-form"
        noValidate
        onSubmit={handleSubmit(
          (values) => {
            if (uploading || ogUploading || save.isPending) return;
            setValidation('');
            if (values.badge_mode === 'custom' && !values.badge_label?.trim()) {
              setValidation('Enter the badge text or select automatic / hidden.');
              return;
            }
            if (
              selectedCombinations &&
              (!selectedCombinations.sizes.length ||
                !selectedCombinations.colors.length ||
                !Number.isInteger(selectedCombinations.stock) ||
                selectedCombinations.stock < 0)
            ) {
              setValidation('Select at least one size and color and enter a valid stock quantity.');
              return;
            }
            const completedVariants = selectedCombinations
              ? addVariantCombinations(
                  variants,
                  selectedCombinations.sizes,
                  selectedCombinations.colors,
                  selectedCombinations.stock,
                )
              : variants;
            const parsed = variantsSchema.safeParse(completedVariants);
            if (!parsed.success) {
              setValidation(
                parsed.error.issues
                  .map(
                    (issue) =>
                      `Variant ${Number(issue.path[0]) + 1}: ${issue.path.slice(1).join(' ')} — ${issue.message}`,
                  )
                  .join(' · '),
              );
              return;
            }
            if (images.some((image) => !image.media_id && !image.external_url)) {
              setValidation('Choose an image for each media slot or remove the empty slot.');
              return;
            }
            if (cost !== '' && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
              setValidation('Cost must be a valid amount of zero or more.');
              setAdvanced(true);
              return;
            }
            save.mutate({
              id: record?.id,
              product: {
                ...values,
                compare_at_price:
                  values.compare_at_price === '' || values.compare_at_price == null
                    ? null
                    : Number(values.compare_at_price),
                tags: values.tags
                  .split(',')
                  .map((tag: string) => tag.trim())
                  .filter(Boolean),
                og_image_id: og,
              },
              variants: parsed.data,
              images: images.map((image) => ({ ...image, alt: image.alt || values.name })),
              collections,
              cost: cost === '' ? null : Number(cost),
            });
          },
          (invalid) => {
            if ((invalid.slug && !invalid.name) || invalid.compare_at_price) setAdvanced(true);
          },
        )}
      >
        <fieldset className="admin-form-fields" disabled={save.isPending}>
          <section className="admin-form-section">
            <h2>1. Product essentials</h2>
            <div className="admin-form-grid">
              <label>
                Product name *
                <input placeholder="e.g. Performance Training Tee" {...register('name')} />
                {errors.name && (
                  <small className="admin-error">{String(errors.name.message)}</small>
                )}
              </label>
              <label>
                Price *
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  {...register('price')}
                />
                {errors.price && <small className="admin-error">Enter a valid price.</small>}
              </label>
              <div className="admin-field">
                <label htmlFor="product-category">Category</label>
                <div className="admin-category-choice">
                  <Select id="product-category" {...register('category_id')}>
                    <option value="">No category</option>
                    {categories.data?.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="admin-button"
                    onClick={() => {
                      addCategory.reset();
                      setCategoryOpen(true);
                    }}
                  >
                    Add category
                  </button>
                </div>
              </div>
              <label>
                Product type
                <input list="product-type-options" {...register('product_type')} />
                <datalist id="product-type-options">
                  {clothingLinks
                    .filter((link) => link.label !== 'All Products')
                    .map((link) => (
                      <option key={link.label} value={link.label} />
                    ))}
                </datalist>
              </label>
            </div>
            {categories.isError && (
              <p className="admin-error" role="alert">
                Categories could not load.{' '}
                <button
                  className="admin-text-action"
                  type="button"
                  onClick={() => void categories.refetch()}
                >
                  Retry
                </button>
              </p>
            )}
            <label>
              Description
              <textarea
                rows={3}
                placeholder="Fit, fabric and what makes this product stand out."
                {...register('description')}
              />
            </label>
          </section>
          <ProductImages
            images={images}
            onChange={setImages}
            onAppend={(rows) => setImages((current) => [...current, ...rows])}
            onBusyChange={setUploading}
          />
          <VariantEditor
            variants={variants}
            onChange={setVariants}
            canAdjust={canAdjust}
            savedIds={record?.product_variants.map((row: Row) => row.id) || []}
            onSelectionChange={setSelectedCombinations}
          />
          <section className="admin-form-section">
            <h2>Product card badge</h2>
            <p>Control the label above this product’s photo.</p>
            <label>
              Badge display
              <Select {...register('badge_mode')}>
                <option value="auto">Automatic — new, bestseller, sale or offer</option>
                <option value="hidden">Hide badge</option>
                <option value="custom">Custom badge</option>
              </Select>
            </label>
            {watch('badge_mode') === 'custom' && (
              <div className="admin-form-grid">
                <label>
                  Badge text
                  <input
                    maxLength={40}
                    {...register('badge_label')}
                    placeholder="e.g. Limited Edition"
                  />
                </label>
                <label>
                  Arabic badge text
                  <input maxLength={40} dir="rtl" {...register('badge_label_ar')} />
                </label>
                <label>
                  Badge style
                  <Select {...register('badge_variant')}>
                    <option value="new">New arrival</option>
                    <option value="bestseller">Best seller</option>
                    <option value="sale">Sale / red</option>
                    <option value="restock">Restock</option>
                    <option value="coming-soon">Coming soon</option>
                  </Select>
                </label>
              </div>
            )}
          </section>
          <details
            className="admin-advanced admin-form-section"
            open={advanced}
            onToggle={(event) => setAdvanced(event.currentTarget.open)}
          >
            <summary>Additional options · badges, translations & SEO</summary>
            <div className="admin-advanced-body">
              <div className="admin-form-grid">
                {[
                  ['name_ar', 'Arabic name'],
                  ['slug', 'Product link (auto-generated)'],
                  ['short_description', 'Short description'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input {...register(key)} />
                    {errors[key] && (
                      <small className="admin-error">{String(errors[key]?.message)}</small>
                    )}
                  </label>
                ))}
              </div>
              <label>
                Arabic description
                <textarea rows={3} dir="rtl" {...register('description_ar')} />
              </label>
              <section className="admin-form-section">
                <h2>Pricing</h2>
                <div className="admin-form-grid">
                  <label>
                    Compare-at price
                    <input type="number" min={0} step="0.01" {...register('compare_at_price')} />
                  </label>
                  {canAdjust && (
                    <label>
                      Cost per item (private)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Leave blank to keep current cost"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              </section>
              <section className="admin-form-section">
                <h2>Organization</h2>
                <div className="admin-form-grid">
                  <label>
                    Gender
                    <Select {...register('gender')}>
                      {['Men', 'Women', 'Unisex'].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </Select>
                  </label>

                  <label>
                    Tags (comma separated)
                    <input {...register('tags')} />
                  </label>
                </div>
                <div className="admin-checkbox-grid">
                  {collectionOptions.data
                    ?.filter((row) => !row.product_rule || row.product_rule === 'manual')
                    .map((row) => (
                      <label className="admin-check-label" key={row.id}>
                        <input
                          type="checkbox"
                          checked={collections.includes(row.id)}
                          onChange={(e) =>
                            setCollections(
                              e.target.checked
                                ? [...collections, row.id]
                                : collections.filter((id) => id !== row.id),
                            )
                          }
                        />
                        {row.name}
                      </label>
                    ))}
                </div>
              </section>
              <section className="admin-form-section">
                <h2>SEO</h2>
                <label>
                  Meta title
                  <input {...register('meta_title')} />
                </label>
                <label>
                  Meta description
                  <textarea {...register('meta_description')} />
                </label>
                <label>
                  OG image
                  <MediaPicker
                    value={og}
                    onChange={setOg}
                    folder="products"
                    onBusyChange={setOgUploading}
                  />
                </label>
              </section>
            </div>
          </details>
          <section className="admin-form-section">
            <h2>Visibility & merchandising</h2>
            <div className="admin-checkbox-grid">
              {[
                ['featured', 'Featured'],
                ['best_seller', 'Best seller'],
                ['new_arrival', 'New arrival'],
                ['archived', 'Archived'],
              ].map(([key, label]) => (
                <label className="admin-check-label" key={key}>
                  <input type="checkbox" {...register(key)} />
                  {label}
                </label>
              ))}
              {['RESTOCK', 'COMING_SOON', 'ACCESSORIES'].map((tag) => (
                <label className="admin-check-label" key={tag}>
                  <input
                    type="checkbox"
                    checked={String(watch('tags') || '')
                      .split(',')
                      .some(
                        (value) =>
                          value
                            .trim()
                            .toUpperCase()
                            .replace(/[\s-]+/g, '_') === tag,
                      )}
                    onChange={(event) => {
                      const tags = String(watch('tags') || '')
                        .split(',')
                        .map((value) => value.trim())
                        .filter(
                          (value) => value && value.toUpperCase().replace(/[\s-]+/g, '_') !== tag,
                        );
                      if (event.target.checked) tags.push(tag);
                      setValue('tags', tags.join(', '), { shouldDirty: true });
                    }}
                  />
                  {
                    {
                      RESTOCK: 'Restocked',
                      COMING_SOON: 'Coming soon (preview only)',
                      ACCESSORIES: 'Accessories',
                    }[tag]
                  }
                </label>
              ))}
            </div>
            <p className="admin-help">
              New arrivals and best sellers are independent. Coming soon products can be previewed
              but cannot be ordered. Sale and buy/get pages follow active prices and offers
              automatically.
            </p>
          </section>
          <section className="admin-form-section admin-publish-panel">
            <label className="admin-check-label">
              <input type="checkbox" {...register('active')} />
              Show this product in the store
            </label>
            <p>
              Leave unchecked to save a draft. Only active, unarchived products appear in the store.
            </p>
          </section>
        </fieldset>
        {Object.keys(errors).length > 0 && (
          <p className="admin-error-panel" role="alert">
            Check the highlighted fields before saving.
          </p>
        )}
        {(validation || save.isError) && (
          <p role="alert" className="admin-error-panel">
            {validation || save.error?.message}
          </p>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className="admin-button"
            onClick={() => navigate('/admin/products')}
          >
            Back to products
          </button>
          <button
            className="admin-button admin-primary"
            type="submit"
            disabled={save.isPending || uploading || ogUploading}
          >
            {uploading || ogUploading
              ? 'Uploading photos…'
              : save.isPending
                ? 'Saving…'
                : watch('active')
                  ? 'Save & publish'
                  : 'Save draft'}
          </button>
        </div>
        {save.isSuccess && (
          <p role="status" className="admin-notice">
            Product saved.
          </p>
        )}
      </form>
      {categoryOpen && (
        <Modal
          title="Add category"
          onClose={() => {
            if (!addCategory.isPending) setCategoryOpen(false);
          }}
        >
          {addCategory.isError && (
            <p className="admin-error" role="alert">
              {addCategory.error.message}
            </p>
          )}
          <RecordForm
            resource={resources.categories}
            pending={addCategory.isPending}
            onSave={(values) => addCategory.mutate(values)}
          />
        </Modal>
      )}
    </>
  );
}
export default function ProductEditorPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });
  if (id && query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => void query.refetch()} />;
  return <ProductForm key={id || 'new'} record={query.data} />;
}
