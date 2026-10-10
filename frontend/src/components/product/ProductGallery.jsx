import { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useContent } from '../../context/ContentContext';

export function ProductGallery({ product }) {
  const { isArabic } = useStore();
  const { isDemo } = useContent();
  const [selectedView, setSelectedView] = useState(0);
  const images = product.images?.length
    ? product.images
    : isDemo
      ? [{ url: product.image }, { url: product.image }]
      : [{ url: product.image, alt: product.name }];

  return (
    <div className="gallery">
      <img
        className={isDemo && selectedView ? 'detail-crop' : ''}
        src={images[selectedView]?.url || product.image}
        alt={images[selectedView]?.alt || product.name}
        width="800"
        height="1000"
        fetchPriority="high"
      />
      <div className="thumbnails">
        {images.map((image, view) => (
          <button
            key={view}
            className={selectedView === view ? 'selected' : ''}
            aria-label={`View ${image.alt || product.name}, image ${view + 1}`}
            onClick={() => setSelectedView(view)}
          >
            <img
              className={isDemo && view ? 'detail-crop' : ''}
              src={image.url}
              alt={view ? 'Close-up' : 'Full view'}
              width="80"
              height="100"
            />
          </button>
        ))}
      </div>
      {isDemo && (
        <small>
          {isArabic
            ? 'صور توضيحية؛ الألوان واللقطات القريبة تجريبية.'
            : 'Sample photography · colors and close-up are illustrative.'}
        </small>
      )}
    </div>
  );
}
