import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Hero } from './components/sections/Hero';
import { About } from './components/sections/About';
import { ScrollJourney } from './components/scene/ScrollJourney';
import { Process } from './components/sections/Process';
import { Houses } from './components/sections/Houses';
import { Sawmill } from './components/sections/Sawmill';
import { Technology } from './components/sections/Technology';
import { Gallery } from './components/sections/Gallery';
import { CTA } from './components/sections/CTA';

export function App(): JSX.Element {
  return (
    <>
      <a href="#main" className="skip-link">
        Przejdź do treści
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <ScrollJourney />
        <About />
        <Process />
        <Houses />
        <Sawmill />
        <Technology />
        <Gallery />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
