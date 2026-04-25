import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { Footer } from '../components/Footer';
import { AsciiBackground } from '../components/AsciiBackground';
import { GithubLink } from '../components/GithubLink';

export function Landing() {
  return (
    <>
      <AsciiBackground />
      <GithubLink />
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

        <Footer />
      </div>
    </>
  );
}
