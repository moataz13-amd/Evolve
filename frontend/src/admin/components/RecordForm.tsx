import { Select } from '../../components/Select';
import { useEffect, useState } from 'react';
import { catalogSlug } from '../../utils/catalogEditor';
import { createUUID } from '../../utils/uuid';
import { deliverySettingsError } from '../../utils/deliveryEstimate';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { options } from '../../services/admin.service';
import { MediaPicker } from './MediaPicker';
import { OfferTypeSelect } from './OfferTypeSelect';
import type { Field, Resource, Row } from '../../types/admin';
function RelationSelect({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const query = useQuery({
    queryKey: ['options', field.relation],
    queryFn: () => options(field.relation!),
  });
  return (
    <Select
      id={`field-${field.key}`}
      aria-label={field.label}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select {field.label.toLowerCase()}</option>
      {query.data?.map((row) => (
        <option key={row.id} value={row.id}>
          {row.name || row.title}
        </option>
      ))}
    </Select>
  );
}
export function RecordForm({
  resource,
  record,
  pending,
  onSave,
}: {
  resource: Resource;
  record?: Row;
  pending: boolean;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of resource.fields) {
    if (field.type === 'checkbox') shape[field.key] = z.boolean();
    else if (field.type === 'number')
      shape[field.key] = z.preprocess(
        (value) => (value === '' || value == null ? null : Number(value)),
        field.required
          ? z
              .number()
              .min(field.min || 0)
              .max(field.max || 1e9)
          : z
              .number()
              .min(field.min || 0)
              .max(field.max || 1e9)
              .nullable(),
      );
    else if (field.type === 'media') shape[field.key] = z.string().uuid().nullable();
    else shape[field.key] = field.required ? z.string().trim().min(1, 'Required') : z.string();
    if (field.key === 'id') shape[field.key] = z.string().uuid('Enter an existing Auth user UUID.');
    if (field.key === 'slug')
      shape[field.key] = z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.');
    if (field.key === 'cta_url')
      shape[field.key] = z.string().regex(/^\/(?!\/)/, 'Use a store path such as /shop.');
    if (field.key === 'currency')
      shape[field.key] = z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code.');
    if (['email', 'store_email'].includes(field.key))
      shape[field.key] = field.required ? z.string().email() : z.string().email().or(z.literal(''));
    if (['instagram', 'facebook', 'tiktok'].includes(field.key))
      shape[field.key] = z.string().url().startsWith('https://').or(z.literal(''));
  }
  if (resource.table === 'offers') shape.offer_type_id = z.string().uuid().nullable();
  if (resource.table === 'offer_types') {
    shape.name = z.string().trim().min(1, 'Required').max(80, 'Use at most 80 characters.');
    shape.name_ar = z.string().trim().max(80, 'Use at most 80 characters.');
    shape.calculation = z.enum(['percentage', 'fixed', 'buy_get']);
  }
  const schema = z.object(shape).superRefine((values, context) => {
    if (resource.table === 'site_settings') {
      const message = deliverySettingsError(values);
      if (message)
        context.addIssue({ code: 'custom', path: ['delivery_estimates_enabled'], message });
    }
    if (['promo_codes', 'offers'].includes(resource.table)) {
      if (resource.table === 'offers') {
        if (values.discount_type === 'buy_get') {
          for (const key of ['buy_quantity', 'get_quantity'])
            if (
              !Number.isInteger(values[key]) ||
              Number(values[key]) < 1 ||
              Number(values[key]) > 100
            )
              context.addIssue({
                code: 'custom',
                path: [key],
                message: 'Enter a whole number between 1 and 100.',
              });
        } else if (values.discount_value == null || Number(values.discount_value) <= 0)
          context.addIssue({
            code: 'custom',
            path: ['discount_value'],
            message: 'Enter a discount value greater than zero.',
          });
      }
      if (values.discount_type === 'percentage' && Number(values.discount_value) > 100)
        context.addIssue({
          code: 'custom',
          path: ['discount_value'],
          message: 'Percentage must be between 0.01 and 100.',
        });
      if (
        values.starts_at &&
        values.ends_at &&
        new Date(String(values.ends_at)) <= new Date(String(values.starts_at))
      )
        context.addIssue({
          code: 'custom',
          path: ['ends_at'],
          message: 'End date must be after the start date.',
        });
    }
  });
  const [token] = useState(createUUID);
  const [advanced, setAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const defaults = Object.fromEntries(
    resource.fields.map((field) => [
      field.key,
      record?.[field.key] ??
        field.defaultValue ??
        (field.type === 'checkbox'
          ? field.key === 'active'
          : field.type === 'media'
            ? null
            : field.type === 'select'
              ? field.options?.[0] || ''
              : field.type === 'number' && field.required
                ? field.min || 0
                : ''),
    ]),
  );
  if (resource.table === 'offers') defaults.offer_type_id = record?.offer_type_id || null;
  for (const field of resource.fields) {
    if (field.type === 'datetime-local' && defaults[field.key]) {
      const date = new Date(defaults[field.key]);
      defaults[field.key] = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }
  }
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const name = watch('name');
  useEffect(() => {
    if (
      resource.fields.some((field) => field.key === 'slug') &&
      !record?.slug &&
      !getFieldState('slug').isDirty
    )
      setValue('slug', name?.trim() ? catalogSlug(name, token) : '');
  }, [name, token, resource, record?.slug, getFieldState, setValue]);
  function renderField(field: Field) {
    if (field.showWhen && !field.showWhen.values.includes(watch(field.showWhen.key))) return null;
    if (field.type === 'checkbox')
      return (
        <label className="admin-check-label" key={field.key}>
          <input id={`field-${field.key}`} type="checkbox" {...register(field.key)} />
          {field.label}
          {errors[field.key] && (
            <small className="admin-error" role="alert">
              {String(errors[field.key]?.message)}
            </small>
          )}
        </label>
      );
    return (
      <div className="admin-field" key={field.key}>
        <label htmlFor={`field-${field.key}`}>
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        {field.type === 'media' ? (
          <Controller
            name={field.key}
            control={control}
            render={({ field: input }) => (
              <MediaPicker
                value={input.value}
                onChange={input.onChange}
                onBusyChange={setUploading}
              />
            )}
          />
        ) : field.relation ? (
          <Controller
            name={field.key}
            control={control}
            render={({ field: input }) => (
              <RelationSelect field={field} value={input.value} onChange={input.onChange} />
            )}
          />
        ) : field.type === 'textarea' ? (
          <textarea id={`field-${field.key}`} rows={3} {...register(field.key)} />
        ) : resource.table === 'offers' && field.key === 'discount_type' ? (
          <OfferTypeSelect
            calculation={watch('discount_type')}
            typeId={watch('offer_type_id')}
            onChange={(calculation, typeId) => {
              setValue('discount_type', calculation, { shouldDirty: true });
              setValue('offer_type_id', typeId, { shouldDirty: true });
              if (calculation === 'buy_get') {
                setValue('discount_value', null);
                if (!(Number(watch('buy_quantity')) >= 1)) setValue('buy_quantity', 2);
                if (!(Number(watch('get_quantity')) >= 1)) setValue('get_quantity', 1);
              } else {
                setValue('buy_quantity', null);
                setValue('get_quantity', null);
              }
            }}
          />
        ) : field.type === 'select' ? (
          <Select
            id={`field-${field.key}`}
            aria-invalid={!!errors[field.key]}
            {...register(field.key)}
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {field.optionLabels?.[option] || option}
              </option>
            ))}
          </Select>
        ) : (
          <input
            id={`field-${field.key}`}
            type={field.type || 'text'}
            step={field.type === 'number' ? (field.step ?? 1) : undefined}
            inputMode={
              field.type === 'number' ? (field.step === 0.01 ? 'decimal' : 'numeric') : undefined
            }
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            aria-invalid={!!errors[field.key]}
            {...register(field.key)}
          />
        )}
        {field.help && <small className="admin-muted">{field.help}</small>}
        {errors[field.key] && (
          <small className="admin-error">{String(errors[field.key]?.message)}</small>
        )}
      </div>
    );
  }
  return (
    <form
      className="admin-form"
      noValidate
      onSubmit={handleSubmit(
        (values) => {
          if (uploading || pending) return;
          const output = { ...values };
          for (const field of resource.fields) {
            if (field.relation && !output[field.key]) output[field.key] = null;
            if (field.type === 'datetime-local')
              output[field.key] = output[field.key]
                ? new Date(String(output[field.key])).toISOString()
                : null;
          }
          if (output.code) output.code = String(output.code).toUpperCase();
          if (resource.table === 'offers') {
            if (output.discount_type === 'buy_get') output.discount_value = null;
            else {
              output.buy_quantity = null;
              output.get_quantity = null;
            }
          }
          onSave(output);
        },
        (invalid) => {
          if (resource.fields.some((field) => field.advanced && invalid[field.key]))
            setAdvanced(true);
        },
      )}
    >
      <fieldset className="admin-form-fields" disabled={pending}>
        <div className="admin-form-grid">
          {resource.fields.filter((field) => !field.advanced).map(renderField)}
        </div>
        {resource.fields.some((field) => field.advanced) && (
          <details
            className="admin-advanced"
            open={advanced}
            onToggle={(event) => setAdvanced(event.currentTarget.open)}
          >
            <summary>Additional options</summary>
            <div className="admin-form-grid admin-advanced-body">
              {resource.fields.filter((field) => field.advanced).map(renderField)}
            </div>
          </details>
        )}
      </fieldset>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="admin-error">
          Check the highlighted fields before saving.
        </p>
      )}
      <button className="admin-button admin-primary" disabled={pending || uploading} type="submit">
        {uploading
          ? 'Uploading image…'
          : pending
            ? 'Saving…'
            : record
              ? 'Save changes'
              : 'Create ' +
                (resource.table === 'categories'
                  ? 'category'
                  : resource.table === 'collections'
                    ? 'collection'
                    : resource.table === 'offers'
                      ? 'offer'
                      : resource.table === 'promo_codes'
                        ? 'offer'
                        : 'record')}
      </button>
    </form>
  );
}
