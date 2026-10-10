import { useRef, useState } from 'react';
import { ProductCard } from './ProductCard';

/** Native touch scrolling, with mouse dragging for desktop shoppers. */
export function ProductRail({ products = [], label, children }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  function startDrag(event) {
    suppressClick.current = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  }

  function moveDrag(event) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const delta = event.clientX - current.x;
    if (!current.moved && Math.abs(delta) < 6) return;
    if (!current.moved) {
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = current.scrollLeft - delta;
  }

  function finishDrag(event) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    suppressClick.current = current.moved;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className={`product-rail${dragging ? ' is-dragging' : ''}`}
      role="region"
      aria-label={label}
      tabIndex={products.length ? 0 : undefined}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onPointerLeave={(event) => {
        if (!gesture.current?.moved) finishDrag(event);
      }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      {children}
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
