import GummyRain from './GummyRain.jsx';
import packageData from './data/package.json';
import './Packages.css';
import './Showcase.css';

const productImages = import.meta.glob(
  './assets/images/{gomitas,cacahuates,snacks_salados}/**/*.{jpg,jpeg,png,webp}',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
);
const showcaseImages = Object.entries(
  import.meta.glob('./assets/images/showcase/*.{jpg,jpeg,png,webp}', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
).sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath));

const formatPrice = (amount) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: packageData.currency,
    maximumFractionDigits: 0,
  }).format(amount);

export default function App() {
  const whatsappMessage = encodeURIComponent(
    `Hola, me interesa el paquete para ${packageData.people} personas de Gomilandia.`,
  );
  const contacts = packageData.contactNumbers.map((number) => ({
    number,
    phoneLink: `tel:+${packageData.countryCode}${number}`,
    whatsappLink: `https://wa.me/${packageData.countryCode}${number}?text=${whatsappMessage}`,
  }));
  const whatsappLink = contacts[0].whatsappLink;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 font-sans text-gray-800">
      
      {/* Hero / Encabezado */}
      <header className="hero-header bg-gradient-to-r from-pink-400 via-purple-400 to-yellow-400 text-white text-center shadow-md">
        <div className="hero-awning" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <h1 className="brand-title mx-auto w-fit max-w-full drop-shadow-md" aria-label="Gomilandia">
          <span aria-hidden="true">
            <span className="brand-letter--purple">Go</span>
            <span className="brand-letter--blue">m</span>
            <span className="brand-letter--pink">ila</span>
            <span className="brand-letter--green">nd</span>
            <span className="brand-letter--red">ia</span>
          </span>
        </h1>
        <p className="hero-copy mt-4 text-xl md:text-2xl font-medium max-w-2xl mx-auto drop-shadow-sm">
          ¡Las barras de gomitas y snacks más coloridas y deliciosas para tus fiestas infantiles!
        </p>
        <p className="hero-location mt-3 text-sm md:text-base font-semibold drop-shadow-sm">
          📍 Servicio en Cuernavaca, Jiutepec y aledaños
        </p>
        <a 
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer" 
          className="hero-cta mt-8 inline-block bg-white text-purple-600 font-bold px-8 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
        >
          📱 Cotizar por WhatsApp
        </a>
      </header>

      <GummyRain />

      {showcaseImages.length > 0 && (
        <section className="showcase-section" aria-labelledby="showcase-heading">
          <div className="showcase-heading">
            <p className="packages-eyebrow">Así se vive Gomilandia</p>
            <h2 id="showcase-heading">Momentos para disfrutar</h2>
            <p>Un vistazo a nuestras barras y celebraciones.</p>
          </div>
          <div
            className="showcase-grid"
            aria-label="Fotos de eventos; desplázate horizontalmente para ver más"
            tabIndex={0}
          >
            {showcaseImages.map(([path, image]) => (
              <figure className="showcase-photo" key={path}>
                <img
                  src={image}
                  alt="Barra de gomitas y snacks de Gomilandia en un evento"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Paquetes y Precios */}
      <section className="packages-section" aria-labelledby="packages-heading">
        <div className="packages-heading">
          <div>
            <p className="packages-eyebrow">Una fiesta llena de antojos</p>
            <h2 id="packages-heading">Nuestros Paquetes</h2>
            <p>Un combo colorido, crujiente y hecho para compartir.</p>
          </div>
          <div className="package-price" aria-label={`Paquete para ${packageData.people} personas`}>
            <span className="package-people">Paquete para <strong>{packageData.people}</strong> personas</span>
            <strong className="package-promo">{formatPrice(packageData.price)}</strong>
          </div>
        </div>

        <div className="package-groups">
          {packageData.groups.map((group) => (
            <article key={group.id} className={`package-group package-group--${group.color}`}>
              <div className="package-group-heading">
                <h3>{group.name}</h3>
                <span>{group.selection}</span>
              </div>
              <ul className="package-items">
                {group.items.map((item) => {
                  const image = item.image
                    ? productImages[`./assets/images/${item.image}`]
                    : undefined;

                  return (
                    <li key={item.name} className="package-item">
                      <div className="package-item-image">
                        {image ? (
                          <img src={image} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span aria-hidden="true">{item.emoji}</span>
                        )}
                      </div>
                      <span className="package-item-name">{item.name}</span>
                      {item.included && <span className="package-item-tag">Incluido</span>}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>

        <div className="package-footer">
          <div className="package-footer-copy">
            <p className="package-custom-note">
              <strong>¿Buscas algo diferente?</strong> También armamos paquetes a tu medida.
            </p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="package-cta"
          >
            <span aria-hidden="true">💬</span> Cotizar por WhatsApp
          </a>
        </div>
      </section>

      {/* Footer / Contacto */}
      <footer className="site-footer bg-gray-900 text-gray-400 text-center py-10 mt-16 px-4">
        <p className="text-white font-bold text-lg">Gomilandia © 2026</p>
        <p className="text-sm mt-2">Haciendo tus eventos más dulces.</p>
        <p className="mx-auto mt-4 max-w-xl px-2 text-sm leading-relaxed">
          📍 Servicio en Cuernavaca, Jiutepec y aledaños. Contáctanos para confirmar si estás dentro del área de servicio.
        </p>
        <div className="contact-links" aria-label="Contacta a Gomilandia">
          {contacts.map((contact) => (
            <div className="contact-option" key={contact.number}>
              <a href={contact.whatsappLink} target="_blank" rel="noopener noreferrer">
                💬 WhatsApp {contact.number}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">📅 Reserva con el 50%</p>
      </footer>

    </div>
  );
}
