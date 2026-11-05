# Gomilandia

Página de catering de gomitas y snacks para fiestas y eventos, con React, Vite y Tailwind. La decoración Three.js ocupa el fondo; el contenido, la navegación y las llamadas a WhatsApp permanecen al frente. Un osito grande se asoma ocasionalmente desde las esquinas inferiores.

## Desarrollo

Usa Node.js 22.12 o posterior y npm. El frontend está en `frontend/`.

```sh
cd frontend
npm ci
npm run dev
```

La vista local se abre en la dirección que imprime Vite (puerto 4317). `npm test` comprueba la física, las colisiones, el ciclo de vida de la lluvia y las apariciones en las esquinas; `npm run build` genera `frontend/dist/`. `npm run preview` permite revisar esa compilación.

## Lluvia de ositos

En la primera entrada de cada pestaña, caen 25 ositos en escritorio o 15 en móvil. Rebotan y se apilan unos segundos en el borde superior del pie de página, junto al área de “Gomilandia © 2026”. Los más antiguos se desvanecen gradualmente después de aterrizar. Quedan seis ositos decorativos en escritorio o cuatro en móvil, y continúa una lluvia suave de pocos ositos que también desaparecen con el tiempo. La población permanece limitada.

Al terminar esa entrada, `sessionStorage` recuerda la visita para que una recarga de la misma pestaña comience directamente con la decoración y la lluvia suave. El osito grande alterna esquinas con pausas largas y nunca captura clics ni bloquea los botones. Para revisar de nuevo la entrada completa en desarrollo local se puede abrir `http://127.0.0.1:4317/?intro=1`.

La animación se detiene al ocultar la pestaña. La preferencia de movimiento reducido muestra solo la decoración estática y oculta las apariciones del osito grande. No se solicitan sensores ni permisos de movimiento.

## Publicación

Los cambios en `main` ejecutan las pruebas, compilan el frontend con Node.js 22 y despliegan `frontend/dist/` mediante `.github/workflows/deploy-pages.yml`.

Sitio: [gomilandia.party](https://gomilandia.party/).

## Paquetes

Edita `frontend/src/data/package.json` para actualizar el paquete, sus precios, el código de país, los teléfonos de contacto y las opciones de cada grupo. Ambos teléfonos aparecen como enlaces para WhatsApp. Las imágenes se indican con rutas relativas a `frontend/src/assets/images/`; cuando una opción no tiene foto, se muestra su emoji. En snacks salados, `included: true` marca los dos productos incluidos.

## Galería

Agrega fotos de eventos en `frontend/src/assets/images/showcase/` para mostrarlas automáticamente en la galería.
