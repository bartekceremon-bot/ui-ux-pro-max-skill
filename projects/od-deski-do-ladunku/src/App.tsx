import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { ScrollJourney } from './components/scene/ScrollJourney';
import { Band } from './components/sections/Band';
import { Process } from './components/sections/Process';
import { Products } from './components/sections/Products';
import { Production } from './components/sections/Production';
import { Quality } from './components/sections/Quality';
import { Spec } from './components/sections/Spec';
import { Logistics } from './components/sections/Logistics';
import { Faq } from './components/sections/Faq';
import { Contact } from './components/sections/Contact';

export function App(): JSX.Element {
  return (
    <>
      <a href="#main" className="skip-link">
        Przejdź do treści
      </a>
      <Nav />
      <main id="main">
        <ScrollJourney />
        <Band />
        <Process />
        <Products />
        <Production />
        <Quality />
        <Spec />
        <Logistics />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
