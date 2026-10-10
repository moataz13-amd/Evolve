import { useContent } from '../context/ContentContext';
import { SectionTitle } from '../components/SectionTitle';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductGallery } from '../components/product/ProductGallery';
import { ProductDetails } from '../components/product/ProductDetails';
import { RelatedProducts } from '../components/product/RelatedProducts';
import { SizeGuideDialog } from '../components/product/SizeGuideDialog';
import { useQuery } from '@tanstack/react-query';
import { storefrontProduct } from '../services/products.service';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

function ProductContent({ product }) {
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  return (
    <div className="section product-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / {product.name}
      </div>
      <div className="product-detail">
        <ProductGallery product={product} />
        <ProductDetails product={product} onOpenSizeGuide={() => setIsSizeGuideOpen(true)} />
      </div>
      <RelatedProducts productId={product.id} />
      {isSizeGuideOpen && <SizeGuideDialog onClose={() => setIsSizeGuideOpen(false)} />}
    </div>
  );
}

export default function ProductPage() {
  const { products, isDemo } = useContent();
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['storefront', 'product', id],
    queryFn: () => storefrontProduct(id),
    enabled: !isDemo,
  });
  const product = isDemo ? products.find((product) => product.id === id) : query.data;
  useDocumentMeta(
    product?.metaTitle || (product ? product.name + ' | EVOLVE' : ''),
    product?.metaDescription || product?.description,
    product?.ogImage || product?.image,
  );
  if (!isDemo && query.isPending)
    return (
      <div className="empty" role="status">
        Loading product…
      </div>
    );
  if (query.isError)
    return (
      <div className="empty" role="alert">
        <p>{query.error.message}</p>
        <button className="button button-primary" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );

  if (!product) {
    return (
      <div className="empty">
        <SectionTitle as="h1">Product not found</SectionTitle>
        <Link to="/shop">Browse essentials</Link>
      </div>
    );
  }

  // Reset product-specific selections when navigating to another product.
  return <ProductContent key={product.id} product={product} />;
}
