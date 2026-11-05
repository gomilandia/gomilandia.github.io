# Frontend de Gomilandia

Consulta el README de la raíz para ejecutar y probar el sitio.

- `src/GummyRain.jsx` monta el fondo y el osito de las esquinas; recuerda la entrada en la sesión de la pestaña.
- `src/gummyScene.js` carga el modelo, mantiene las luces y representa la opacidad individual de cada osito.
- `src/gummyLifecycle.js` limita la lluvia inicial, desvanece los ositos antiguos y conserva unos pocos como decoración.
- `src/gummyPeek.js` anima al osito grande, alternando las esquinas sin capturar eventos.
- `src/gummyPhysics.js` conserva las caídas, rebotes y colisiones.

El contenido y la navegación tienen sus propias capas sobre la lluvia. El osito que se asoma es una excepción visual por encima del contenido, con `pointer-events: none`. Su renderer tiene un entorno de iluminación independiente.

`public/models/gummy.glb` es el modelo original facilitado para el proyecto. La geometría se comparte y la paleta conserva los cinco colores originales. Se respeta la preferencia de movimiento reducido.
