import { useEffect } from 'react';
export function useDocumentMeta(title, description, image) {
  useEffect(() => {
    if (!title) return;
    const original = document.title;
    document.title = title;
    const changes = [];
    for (const [attribute, key, value] of [
      ['name', 'description', description],
      ['property', 'og:title', title],
      ['property', 'og:description', description],
      ['property', 'og:image', image],
    ]) {
      if (!value) continue;
      let tag = document.querySelector(`meta[${attribute}="${key}"]`);
      const existed = !!tag;
      const previous = tag?.getAttribute('content');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, key);
        document.head.append(tag);
      }
      tag.setAttribute('content', value);
      changes.push({ tag, existed, previous });
    }
    return () => {
      document.title = original;
      for (const { tag, existed, previous } of changes) {
        if (existed) tag.setAttribute('content', previous || '');
        else tag.remove();
      }
    };
  }, [title, description, image]);
}
