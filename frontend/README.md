# Frontend de Gomilandia

Consulta el README de la raíz para ejecutar, probar y publicar el sitio.

`src/GummyRain.jsx` presenta los controles de pausa y despeje, detecta la sacudida del teléfono y solicita el permiso de movimiento cuando el navegador lo requiere. `src/gummyScene.js` carga el modelo, representa los ositos y conecta la interacción con el puntero, el mouse y la barra espaciadora. `src/gummyPhysics.js` controla las apariciones aleatorias, la caída, las colisiones, la acumulación y el despeje. Hay 25 ositos en escritorio y 6 en pantallas de hasta 640 px o dispositivos con puntero táctil, incluso en horizontal; no hay minijuego ni puntuación.

El archivo `public/models/gummy.glb` es el modelo original facilitado para el proyecto. Se reutiliza una sola geometría y cinco materiales translúcidos con los colores rojo, verde, naranja, amarillo y rosa. La preferencia de movimiento reducido inicia la lluvia en pausa y elimina la animación de sacudida de la página.
