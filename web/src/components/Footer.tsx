export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__sep">{'─'.repeat(64)}</div>
      <div className="footer__row">
        <span>/ milli</span>
        <span>— pixel-perfect ascii —</span>
        <span>MIT · oss</span>
      </div>
      <div className="footer__row footer__row--dim">
        <span>TERMINAL-FIRST · WEB-EQUIVALENT</span>
        <span>EVERYTHING RUNS LOCAL · ZERO UPLOAD</span>
      </div>
    </footer>
  );
}
