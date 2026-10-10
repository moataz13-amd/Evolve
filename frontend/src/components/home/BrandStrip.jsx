const messages = ['TRAIN HARD.', 'MOVE FREELY.', 'LIVE STRONG.'];

export function BrandStrip() {
  return (
    <div className="brand-strip" dir="ltr" tabIndex={0}>
      <div className="brand-strip-track">
        {[0, 1].map((copy) => (
          <div className="brand-strip-group" key={copy} aria-hidden={copy === 1}>
            {[...messages, ...messages].map((message, index) => (
              <span className="brand-strip-item" key={index}>
                <span>{message}</span>
                <i aria-hidden="true">✳</i>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
