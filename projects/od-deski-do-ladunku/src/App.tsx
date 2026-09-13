import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { ScrollJourney } from './components/scene/ScrollJourney';
import { Process } from './components/sections/Process';
import { Products } from './components/sections/Products';
import { Production } from './components/sections/Production';
import { Quality } from './components/sections/Quality';
import { Spec } from './components/sections/Spec';
import { Logistics } from './components/sections/Logistics';
import { CTA } from './components/sections/CTA';

export function App(): JSX.Element {
  return (
    <>
      <a href="#main" className="skip-link">
        Przejdź do treści
      </a>
      <Nav />
      <main id="main">
        <ScrollJourney />
        <Process />
        <Products />
        <Production />
        <Quality />
        <Spec />
        <Logistics />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
