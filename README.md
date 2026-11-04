# Gomilandia

Página de catering de gomitas y snacks para fiestas y eventos, con React, Vite y Tailwind. Incluye una lluvia interactiva de 25 ositos Three.js sobre toda la página: cinco de cada color.

## Desarrollo

Usa Node.js 22.12 o posterior y npm. El frontend está en `frontend/`.

```sh
cd frontend
npm ci
npm run dev
```

La vista local se abre en la dirección que imprime Vite (puerto 4317). `npm test` comprueba la física y las reglas de puntuación; `npm run build` genera `frontend/dist/`. `npm run preview` permite revisar esa compilación.

## Juego

Los ositos caen y giran automáticamente. Un clic o toque los hace rebotar y abre el marcador. Solo los clics consecutivos en el mismo osito suman a la racha actual. Cambiar de osito inicia una nueva racha; dejar caer el osito seleccionado la termina y conserva el récord de la sesión.

El marcador aparece solo al tocar un osito y puede cerrarse para ocultar el juego. Incluye un botón de rebote para continuar con teclado y un control de pausa. La lluvia se detiene cuando se oculta la pestaña. Si se solicita movimiento reducido, comienza en pausa y se activa al tocar un osito.

## Publicación

Los cambios en `main` ejecutan las pruebas, compilan el frontend con Node.js 22 y despliegan `frontend/dist/` mediante `.github/workflows/deploy-pages.yml`.

Sitio: [gomilandia.party](https://gomilandia.party/).
