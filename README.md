# Gomilandia

Página de catering de gomitas y snacks para fiestas y eventos, con React, Vite y Tailwind. Incluye una lluvia continua de ositos Three.js que chocan con el puntero y se acumulan desde la parte baja. El primer lote es de 15 ositos en escritorio y 6 en móvil, donde la lluvia también es más lenta. En móvil vertical son más pequeños; en horizontal conservan su tamaño. El escritorio utiliza una cantidad máxima menor.

## Desarrollo

Usa Node.js 22.12 o posterior y npm. El frontend está en `frontend/`.

```sh
cd frontend
npm ci
npm run dev
```

La vista local se abre en la dirección que imprime Vite (puerto 4317). `npm test` comprueba la física, las colisiones, la emisión continua y la detección de sacudidas con distintas lecturas del sensor; `npm run build` genera `frontend/dist/`. `npm run preview` permite revisar esa compilación.

## Lluvia de ositos

Los ositos aparecen desde arriba en posiciones e intervalos aleatorios. Chocan con el puntero, entre sí y con el piso de la pantalla; siguen llegando y apilándose, con menor densidad en escritorio. Son decorativos: no hay marcador, panel ni botones para controlarlos, y los enlaces de la página permanecen disponibles.

Para despejarlos, mueve el mouse rápidamente de un lado a otro o pulsa la barra espaciadora. En móvil, agita el teléfono. Los navegadores que requieren permiso de movimiento lo solicitan en el primer toque real; si se deniega, no se vuelve a solicitar. También puedes dar un doble toque breve en una zona sin enlaces, controles ni galería para limpiar sin sensores. La sacudida abre temporalmente los bordes y dispara los ositos hacia los lados: permanecen visibles hasta salir de la pantalla. La lluvia se pausa durante la expulsión y vuelve a comenzar después de que salgan todos.

La lluvia se detiene al ocultar la pestaña. Si se solicita movimiento reducido, permanece en pausa, la limpieza es inmediata y la página no muestra la animación de sacudida. Los sensores de movimiento requieren un contexto seguro (HTTPS o localhost) y su disponibilidad depende del dispositivo y el navegador; el doble toque funciona sin ese permiso.

## Publicación

Los cambios en `main` ejecutan las pruebas, compilan el frontend con Node.js 22 y despliegan `frontend/dist/` mediante `.github/workflows/deploy-pages.yml`.

Sitio: [gomilandia.party](https://gomilandia.party/).

## Paquetes

Edita `frontend/src/data/package.json` para actualizar el paquete, sus precios, el código de país, los teléfonos de contacto y las opciones de cada grupo. Ambos teléfonos aparecen como enlaces para WhatsApp. Las imágenes se indican con rutas relativas a `frontend/src/assets/images/`; cuando una opción no tiene foto, se muestra su emoji. En snacks salados, `included: true` marca los dos productos incluidos.

## Galería

Agrega fotos de eventos en `frontend/src/assets/images/showcase/` para mostrarlas automáticamente en la galería.
