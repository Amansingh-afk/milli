const ASCII_TITLE = String.raw`
    ███╗   ███╗██╗██╗     ██╗     ██╗
    ████╗ ████║██║██║     ██║     ██║
    ██╔████╔██║██║██║     ██║     ██║
    ██║╚██╔╝██║██║██║     ██║     ██║
    ██║ ╚═╝ ██║██║███████╗███████╗██║
    ╚═╝     ╚═╝╚═╝╚══════╝╚══════╝╚═╝
`;

export function Hero() {
  return (
    <header className="hero">
      <div className="hero__tag">
        <span className="hero__blink">▌</span>
        <span>v0.0.1 &middot; STATUS: ONLINE &middot; {new Date().getUTCFullYear()}</span>
      </div>
      <pre className="hero__title" aria-label="milli">
        {ASCII_TITLE}
      </pre>
      <h1 className="hero__subtitle">
        <span data-text="pixel-perfect">pixel-perfect</span>{' '}
        <span data-text="animated">animated</span>{' '}
        <span data-text="ascii art">ascii art</span>
      </h1>
      <p className="hero__lede">
        <span className="hero__accent">[</span> drop an image or gif &middot; get an animated ascii
        &middot; export anywhere <span className="hero__accent">]</span>
      </p>
      <div className="hero__meta">
        <span>· CLI + WEB</span>
        <span>· LOCAL-ONLY (no upload)</span>
        <span>· OSS / MIT</span>
      </div>
    </header>
  );
}
