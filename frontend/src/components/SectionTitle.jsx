export function SectionTitle({ as: Heading = 'h2', children, className = '', ...props }) {
  return (
    <Heading className={`section-title ${className}`.trim()} {...props}>
      <span className="section-title-outline" aria-hidden="true">
        {children}
      </span>
      <span className="section-title-text">{children}</span>
    </Heading>
  );
}
