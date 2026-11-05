# Frontend de Gomilandia

Consulta el README de la raíz para ejecutar, probar y publicar el sitio.

`src/GummyRain.jsx` monta el canvas sin controles visibles, detecta la sacudida del teléfono y solicita el permiso de movimiento una sola vez desde el primer gesto táctil real cuando el navegador lo requiere. Un doble toque breve en una zona no interactiva ofrece limpieza sin sensores; no se interceptan enlaces, controles ni la galería desplazable. `src/gummyScene.js` carga el modelo, representa los ositos y conecta la interacción con el puntero, el mouse y la barra espaciadora. `src/gummyPhysics.js` controla las apariciones aleatorias continuas, la caída, las colisiones, la acumulación y el despeje.

El primer lote contiene 25 ositos en escritorio y 6 en pantallas de hasta 640 px o dispositivos con puntero táctil, incluso en horizontal. Siguen llegando hasta apilarse por toda la pantalla, con menor flujo en móvil; no hay minijuego, puntuación ni panel de control.

El archivo `public/models/gummy.glb` es el modelo original facilitado para el proyecto. Se reutiliza una sola geometría y cinco materiales translúcidos con los colores rojo, verde, naranja, amarillo y rosa. La preferencia de movimiento reducido mantiene la lluvia en pausa y elimina la animación de sacudida de la página.
