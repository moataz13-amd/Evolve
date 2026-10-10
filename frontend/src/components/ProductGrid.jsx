import { ProductCard } from './ProductCard';

export function ProductGrid({ products, children }) {
  return (
    <div className="product-grid">
      {products.length
        ? products.map((product) => <ProductCard key={product.id} product={product} />)
        : children}
    </div>
  );
}
