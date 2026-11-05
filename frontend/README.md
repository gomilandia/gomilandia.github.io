# Frontend de Gomilandia

Consulta el README de la raíz para ejecutar, probar y publicar el sitio.

`src/GummyRain.jsx` monta el canvas sin controles visibles, detecta la sacudida del teléfono y solicita el permiso de movimiento una sola vez desde el primer gesto táctil real cuando el navegador lo requiere. Un doble toque breve en una zona no interactiva ofrece limpieza sin sensores; no se interceptan enlaces, controles ni la galería desplazable. `src/gummyScene.js` carga el modelo, representa los ositos y conecta la interacción con el puntero, el mouse y la barra espaciadora. `src/gummyPhysics.js` controla las apariciones aleatorias continuas, la caída, las colisiones, la acumulación y el despeje.

`src/gummyGestures.js` reconoce los gestos del mouse y las sacudidas del teléfono. El detector móvil combina la aceleración lineal con una lectura de gravedad filtrada, admite ejes sin datos y utiliza el tiempo de muestreo del sensor. Las lecturas ya autorizadas por el navegador se procesan sin exigir un toque previo; el permiso se solicita desde un gesto solo cuando hace falta.

El primer lote contiene 15 ositos en escritorio y 6 en pantallas de hasta 640 px o dispositivos con puntero táctil. La densidad máxima del escritorio se reduce un 35% y su intervalo de emisión es de 0.4 segundos. En móvil vertical, `bearSize` es 0.65; en horizontal conserva 0.95, con intervalo de 0.85 segundos. Los tamaños se ajustan al ancho disponible. No hay minijuego, puntuación ni panel de control.

Al limpiar, la física desactiva los bordes y conserva los mismos ositos mientras vuelan hacia los lados. Solo se ocultan al salir completamente de la ventana; la emisión permanece suspendida hasta terminar la expulsión y después reinicia el lote inicial. El redimensionado conserva la fase abierta. Si se activa movimiento reducido durante la salida, se finaliza inmediatamente para no dejar la simulación bloqueada.

El archivo `public/models/gummy.glb` es el modelo original facilitado para el proyecto. Se reutiliza una sola geometría y cinco materiales translúcidos con los colores rojo, verde, naranja, amarillo y rosa. La preferencia de movimiento reducido mantiene la lluvia en pausa y elimina la animación de sacudida de la página.
