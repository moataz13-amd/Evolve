import { SectionTitle } from './SectionTitle';
export function PageIntro({ label, title, copy }) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{label}</span>
      <SectionTitle as="h1">{title}</SectionTitle>
      {copy && <p>{copy}</p>}
    </div>
  );
}
