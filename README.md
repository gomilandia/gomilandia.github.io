# Gomilandia

Página de catering de gomitas y snacks para fiestas y eventos, con React, Vite y Tailwind. Incluye una lluvia de ositos Three.js que chocan con el puntero y se acumulan en la parte baja de la pantalla: 25 en escritorio y 6 en móvil.

## Desarrollo

Usa Node.js 22.12 o posterior y npm. El frontend está en `frontend/`.

```sh
cd frontend
npm ci
npm run dev
```

La vista local se abre en la dirección que imprime Vite (puerto 4317). `npm test` comprueba la física, las colisiones y el despeje de los ositos; `npm run build` genera `frontend/dist/`. `npm run preview` permite revisar esa compilación.

## Lluvia de ositos

Los ositos aparecen desde arriba en posiciones e intervalos aleatorios. Chocan con el puntero, entre sí y con el piso de la pantalla, donde se van acumulando. Son decorativos: no hay marcador ni acciones al hacer clic y los enlaces de la página permanecen disponibles.

Para despejarlos, mueve el mouse rápidamente de un lado a otro, pulsa la barra espaciadora o usa «Agitar». En móvil, agita el teléfono; si el navegador solicita permiso, pulsa «Activar movimiento» y autoriza el sensor. El botón «Limpiar ositos» también funciona sin sensores o si no se concede el permiso. La sacudida despeja los ositos y una nueva lluvia comienza desde arriba.

El control «Pausar» detiene la lluvia; también se detiene al ocultar la pestaña. Si se solicita movimiento reducido, comienza en pausa y la página no muestra la animación de sacudida. Los sensores de movimiento requieren un contexto seguro (HTTPS o localhost) y su disponibilidad depende del dispositivo y el navegador.

## Publicación

Los cambios en `main` ejecutan las pruebas, compilan el frontend con Node.js 22 y despliegan `frontend/dist/` mediante `.github/workflows/deploy-pages.yml`.

Sitio: [gomilandia.party](https://gomilandia.party/).

## Paquetes

Edita `frontend/src/data/package.json` para actualizar el paquete, sus precios, el código de país, los teléfonos de contacto y las opciones de cada grupo. Ambos teléfonos aparecen como enlaces para WhatsApp. Las imágenes se indican con rutas relativas a `frontend/src/assets/images/`; cuando una opción no tiene foto, se muestra su emoji. En snacks salados, `included: true` marca los dos productos incluidos.

## Galería

Agrega fotos de eventos en `frontend/src/assets/images/showcase/` para mostrarlas automáticamente en la galería.
