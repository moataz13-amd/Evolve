import { z } from 'zod';
export const variantSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().trim().min(1),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  color_name: z.string().trim().min(1, 'Enter a color name.'),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stock: z.coerce.number().int().min(0),
  low_stock_threshold: z.coerce.number().int().min(0),
  track_quantity: z.boolean(),
  price_override: z.preprocess(
    (value) => (value == null || (typeof value === 'string' && !value.trim()) ? null : value),
    z.coerce.number().min(0).nullable(),
  ),
  active: z.boolean(),
});
export const variantsSchema = variantSchema
  .array()
  .min(1, 'Add at least one size and color.')
  .superRefine((variants, context) => {
    const combinations = new Set<string>();
    const skus = new Set<string>();
    variants.forEach((variant, index) => {
      const combination = `${variant.size}:${variant.color_name.toLowerCase()}`;
      if (combinations.has(combination))
        context.addIssue({
          code: 'custom',
          path: [index, 'color_name'],
          message: `${variant.size} / ${variant.color_name} already exists. Choose a different size or color.`,
        });
      if (skus.has(variant.sku))
        context.addIssue({
          code: 'custom',
          path: [index, 'sku'],
          message: 'Each variant needs a unique SKU.',
        });
      combinations.add(combination);
      skus.add(variant.sku);
    });
  });
export const productSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.'),
    price: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0)),
    compare_at_price: z.union([z.literal(''), z.null(), z.coerce.number().min(0)]).optional(),
    category_id: z.string().uuid().or(z.literal('')),
    gender: z.enum(['Men', 'Women', 'Unisex']),
  })
  .passthrough();
