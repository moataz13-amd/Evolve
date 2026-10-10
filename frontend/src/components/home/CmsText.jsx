import { Fragment } from 'react';
import { useContent } from '../../context/ContentContext';
import { useStore } from '../../context/StoreContext';
export function CmsText({ sectionKey, field, children }) {
  const { section, isDemo, loading, data } = useContent();
  const { isArabic } = useStore();
  const config = section(sectionKey);
  const value = isArabic ? config?.[field + '_ar'] || config?.[field] : config?.[field];
  if (!value) return isDemo || (loading && !data) ? children : null;
  return value.split('\n').map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}
