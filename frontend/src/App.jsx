import GummyRain from './GummyRain.jsx';

// Datos de los paquetes para actualizar fácilmente
const PACKAGES = [
  {
    name: "Mini-Sugar 🍭",
    capacity: "Hasta 30 niños",
    gummies: "4 variedades",
    snacks: "Papitas y palomitas",
    price: "$1,500",
    color: "border-pink-300 bg-pink-50"
  },
  {
    name: "Mega-Snack 🍿",
    capacity: "30 a 60 niños",
    gummies: "6 variedades + Toppings",
    snacks: "Papitas, palomitas y jicaletas",
    price: "$2,800",
    color: "border-purple-300 bg-purple-50"
  },
  {
    name: "Premium Candy 🎈",
    capacity: "Más de 60 niños",
    gummies: "Variedades ilimitadas",
    snacks: "Barra libre de snacks y fruta",
    price: "$4,500",
    color: "border-yellow-300 bg-yellow-50"
  }
];

export default function App() {
  // Configura tu número de WhatsApp aquí (con código de país, ej: 52 para México)
  const whatsappNumber = "521234567890"; 
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Hola!%20Me%20interesa%20una%20cotizacion%20para%20una%20barra%20de%20gomitas%20y%20snacks.`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 font-sans text-gray-800">
      
      {/* Hero / Encabezado */}
      <header className="bg-gradient-to-r from-pink-400 via-purple-400 to-yellow-400 text-white text-center py-16 px-4 shadow-md">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-wide drop-shadow-md">
          🍬 Gomiland 🎉
        </h1>
        <p className="mt-4 text-xl md:text-2xl font-medium max-w-2xl mx-auto drop-shadow-sm">
          ¡Las barras de gomitas y snacks más coloridas y deliciosas para tus fiestas infantiles!
        </p>
        <a 
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer" 
          className="mt-8 inline-block bg-white text-purple-600 font-bold px-8 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
        >
          📱 Cotizar por WhatsApp
        </a>
      </header>

      <GummyRain />

      {/* Características del Servicio */}
      <section className="max-w-6xl mx-auto py-12 px-4">
        <h2 className="text-3xl font-bold text-center text-purple-700 mb-8">¿Qué incluye nuestro servicio?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-4xl">🧼</span>
            <h3 className="font-bold text-lg mt-2">100% Higiénico</h3>
            <p className="text-gray-600 text-sm mt-1">Servicio con pinzas, cucharones y bolsitas individuales para los niños.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-4xl">🎨</span>
            <h3 className="font-bold text-lg mt-2">Mesas Temáticas</h3>
            <p className="text-gray-600 text-sm mt-1">Decoramos la barra con los colores y el personaje favorito del cumpleañero.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-4xl">🌶️</span>
            <h3 className="font-bold text-lg mt-2">Toppings llimitados</h3>
            <p className="text-gray-600 text-sm mt-1">Chamoy, miguelito, salsas y todo lo necesario para armar el snack perfecto.</p>
          </div>
        </div>
      </section>

      {/* Paquetes y Precios */}
      <section className="max-w-6xl mx-auto py-12 px-4 bg-white rounded-3xl shadow-sm border border-gray-100 my-8">
        <h2 className="text-3xl font-bold text-center text-purple-700 mb-4">Nuestros Paquetes</h2>
        <p className="text-center text-gray-500 mb-10">Elige el tamaño ideal para tu evento</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PACKAGES.map((pkg, index) => (
            <div key={index} className={`border-2 ${pkg.color} rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow`}>
              <div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{pkg.name}</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-center">✨ <strong>Capacidad:</strong> &nbsp; {pkg.capacity}</li>
                  <li className="flex items-center">🍬 <strong>Gomitas:</strong> &nbsp; {pkg.gummies}</li>
                  <li className="flex items-center">🍿 <strong>Snacks:</strong> &nbsp; {pkg.snacks}</li>
                  <li className="flex items-center">⏱️ <strong>Servicio:</strong> &nbsp; Montaje incluido</li>
                </ul>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <span className="text-3xl font-extrabold text-purple-700">{pkg.price}</span>
                <span className="text-gray-500 text-sm block">Pesos MXN</span>
                <a 
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block bg-purple-600 text-white text-center font-bold py-2 rounded-xl hover:bg-purple-700 transition-colors"
                >
                  Apartar Fecha
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer / Contacto */}
      <footer className="bg-gray-900 text-gray-400 text-center py-10 mt-16 px-4">
        <p className="text-white font-bold text-lg">Gomiland © 2026</p>
        <p className="text-sm mt-2">Haciendo tus eventos más dulces.</p>
        <div className="mt-4 flex justify-center space-x-6 text-sm">
          <span>📍 Cobertura Local</span>
          <span>•</span>
          <span>📅 Reserva con el 50%</span>
        </div>
      </footer>

    </div>
  );
}
