import { Link, useNavigate } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { Showcase } from '../components/Showcase';
import { Footer } from '../components/Footer';
import { AsciiBackground } from '../components/AsciiBackground';

export function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <AsciiBackground />
      <div className="shell">
        <div className="scanlines" aria-hidden />
        <div className="noise" aria-hidden />

        <Hero />

        <p className="bg-credit">
          <span className="bg-credit__line">
            <span className="bg-credit__arrow">▸</span>
            background: animated ascii jellyfish, generated with{' '}
            <a href="https://github.com/Amansingh-afk/milli" target="_blank" rel="noopener">milli</a>
          </span>
          <span className="bg-credit__line">
            rendered live in your browser via{' '}
            <a href="https://www.npmjs.com/package/@amansingh-afk/milli" target="_blank" rel="noopener">
              @amansingh-afk/milli/web
            </a>
          </span>
        </p>

        <div className="hero__cta">
          <Link to="/create" className="btn btn--cta">
            [ ▸ launch the tool ]
          </Link>
        </div>

        <div className="scroll-hint" aria-hidden>
          <span>SCROLL</span>
          <span className="scroll-hint__arrow">▼</span>
        </div>

        <main className="main">
          <Showcase onPick={(name) => navigate(`/create?showcase=${name}`)} />
        </main>

        <Footer />
      </div>
    </>
  );
}
