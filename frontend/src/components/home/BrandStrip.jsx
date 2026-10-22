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
                <svg
                  className="brand-strip-mark"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14m0-14.14L4.93 19.07"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
