export type VariantRecord = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color_name: string;
  color_hex: string;
  stock: number;
  low_stock_threshold: number;
  track_quantity: boolean;
  price_override: number | null;
  active: boolean;
};
export type ImageRecord = {
  id: string;
  product_id: string;
  media_id: string | null;
  external_url: string | null;
  alt: string;
  display_order: number;
  color_name: string | null;
  media?: { path: string } | null;
};
export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  product_variants: VariantRecord[];
  product_images: ImageRecord[];
  product_collections: { collection_id: string }[];
  product_costs?: { cost: number } | null;
  [key: string]: unknown;
};
