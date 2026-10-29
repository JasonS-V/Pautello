# F6 — Grabado, intercambio y audio

Estado al 29 de octubre de 2026: implementación F6.1–F6.7 terminada. La puerta F6 queda pendiente de dos comprobaciones manuales: abrir el MusicXML en un editor ajeno a Pautello y escuchar el fragmento con salto junto con el WAV exportado. Las pruebas automáticas y la revisión visual de impresión sí están completas.

## Semántica compartida

- `buildPlaybackPlan` produce visitas por compás con pasada, tempo, métrica, armadura y duración. Repeticiones, casillas, D.C./D.S., Fine y Coda se resuelven sin duplicar los compases del Score; destinos ausentes o erróneos generan diagnóstico.
- `collectPerformedNotes` produce la línea temporal que consumen reproductor, MIDI y WAV. Une notas ligadas sin segundo ataque incluso al cambiar el tempo. El calderón sobre nota se interpreta con un factor de duración de 1,8; el calderón sobre silencio se conserva como notación y no inventa un tiempo acústico.
- La referencia revisada de _El Rey_ produce 55 compases escritos, 103 visitas, 183 ataques y 140,333 s. La ruta comprobada es 1–51, 2–49, 52–55.

## Grabado e impresión

- Las marcas metronómicas con figura, equivalencias, `C`, ensayos, segno/coda y navegación se dibujan en carriles separados. El calderón se dibuja también sobre silencio y la ligadura entrante se muestra al comenzar otro sistema.
- «Seguir saltos de la fuente» respeta los seis saltos explícitos de la referencia y muestra siete sistemas; el modo redistribuido permanece disponible. Los compases reciben anchura proporcional a su densidad para que las notas y alteraciones no se superpongan en los sistemas densos. Las etiquetas pedagógicas de altura se ocultan al imprimir.
- Edge sobre el build de producción: siete PNG de sistema revisados y dos PDF completos, Carta y A4. Ambos tienen dos páginas, cuatro sistemas en la primera y tres en la segunda; no se observó página adicional, recorte ni error de página. Los archivos de comprobación quedan en `tasks/local/f6-visual/`, fuera de Git.

## Intercambio

- MusicXML 4.0 emite e importa cambios locales de métrica, armadura y tempo; metronomía, equivalencia, ensayo, navegación, metadatos y saltos de página/sistema al inicio del compás siguiente. Usa divisiones enteras para 32avos con puntillo y tuplets, y conserva acordes, voces, ligaduras, silencios de compás completo y calderón sobre silencio. El parser alternativo rechaza claramente estructuras avanzadas que no puede representar.
- Se validaron con el XSD oficial MusicXML 4.0 un fixture de dos voces/acorde/tuplet/ligadura y la obra completa exportada, incluso el archivo descargado desde Edge. El MusicXML descargado se reimportó por la interfaz y se exportó otra vez a JSON: coincidencia semántica con la referencia tras excluir IDs, fechas, numeración inferida y representaciones equivalentes de una nota de un solo sonido. El JSON directo coincide tras la normalización del esquema.

## Audio

- El reproductor recorre visitas con reloj de prueba, mueve el cursor por notas, silencios y pulsos, y agenda el metrónomo y las partes sobre el mismo tiempo local. Pausa y reanudación vuelven al comienzo de la visita actual.
- El MIDI descargado en Edge es formato 0 con PPQ 960: 183 ataques, seis eventos de tempo, cinco de métrica y cuatro marcadores. Los 183 ataques coinciden en altura e instante con la línea temporal de referencia dentro de 2 ms.
- El WAV estéreo PCM de 44,1 kHz descargado en Edge dura 140,533 s, los 140,333 s del recorrido más 0,2 s de margen. La exportación comprueba cancelación y el presupuesto estimado de canales flotantes más PCM antes de reservar el contexto offline. La duración, los cambios de tempo y la ausencia de ataques dobles en ligaduras tienen pruebas automatizadas.

## Verificación

- `pnpm test -- --maxWorkers=2`: 491 pruebas en 63 archivos, todas aprobadas.
- `pnpm build`: correcto.
- ESLint y Prettier en los archivos F6: correctos.
- Edge: importación de JSON, exportación real de JSON/MusicXML/MIDI/WAV, reimportación MusicXML e impresión Carta/A4, sin errores de página.

Pendiente para cerrar la puerta: abrir el MusicXML descargado en un editor externo y escuchar el tramo D.S. al Coda y el WAV. La validación de esquema, el round-trip y la comparación de eventos no sustituyen esas dos comprobaciones perceptivas.
