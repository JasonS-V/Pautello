# F0.2: referencia validada de El Rey y referencias de validación

27 de octubre de 2026. Estado: **revisada y aprobada (`status: reviewed`)**.

La anotación de _El Rey_ se realizó sobre la página completa y los siete sistemas ampliados, sin importar tokens, IR ni Score del modelo, y se verificó mediante audición del control WAV lineal compás por compás. El PDF original, los recortes y las transcripciones privadas se mantienen localmente. `tasks/local/` está excluido de Git porque no hay permiso de redistribución de la fuente/transcripción.

Archivos de referencia:

- `tasks/local/el-rey-ground-truth.json`: referencia de aceptación de _El Rey_ (`status: reviewed`, 7 sistemas, 55 compases, 107 eventos: 100 notas, 7 silencios, 2 ligaduras, 14 indicaciones).
- `tasks/local/el-rey-events.tsv`: tabla por evento/compás verificada.
- `tasks/local/el-rey-audition-linear.wav`: control auditivo generado desde la anotación, con tempos locales y ligaduras en orden escrito.
- `tasks/local/build-el-rey-reference.mjs`: registro reproducible de la anotación manual y de sus salidas; no depende del OMR.
- `src/omr/__tests__/fixtures/line-reference.json`: referencia pública de validación en clave de Sol (`G2`, dominio público PDMX `0021737310`, `status: reviewed`, 1 sistema, 6 compases, 12 eventos: 9 notas, 3 silencios).
- `tasks/local/qdrt-ground-truth.json` y `tasks/local/build-qdrt-reference.mjs`: referencia local independiente de validación en clave de Fa (`F4`, _Que De Raro Tiene_, `status: reviewed`, 10 sistemas, 100 compases, 188 eventos: 182 notas, 6 silencios, 4 sostenidos en armadura, 4 indicaciones de navegación).

Verificación mediante CLI:

```powershell
pnpm omr:reference --input tasks/local/el-rey-ground-truth.json
pnpm omr:reference --input src/omr/__tests__/fixtures/line-reference.json
pnpm omr:reference --input tasks/local/qdrt-ground-truth.json
```

El comprobador valida IDs, orden, alturas, fracciones/puntillos, capacidad según métrica local, posiciones dentro del raster, ligaduras consecutivas, anclajes de indicaciones, destinos de navegación, exigencia de audición/cero pendientes para estado `reviewed` y resolución explícita de la función musical del compás inicial incompleto.

## Inventario visual y auditivo confirmado (_El Rey_)

| Sistema   | Compases de referencia | Número impreso al inicio |       Eventos (notas + silencios) |
| --------- | ---------------------- | ------------------------ | --------------------------------: |
| 1         | 1–10                   | Ninguno                  |                                14 |
| 2         | 11–18                  | 11                       |                                20 |
| 3         | 19–27                  | 19                       |                                20 |
| 4         | 28–38                  | 28                       |                                20 |
| 5         | 39–49                  | 39                       |                                17 |
| 6         | 50–51                  | 50                       |                                 4 |
| 7         | 52–55                  | 52                       |                                12 |
| **Total** | **1–55**               | **6 números impresos**   | **107 (100 notas + 7 silencios)** |

## Resolución musical del compás inicial incompleto

El compás 1 contiene únicamente dos silencios de negra en 3/4 (`r:4 r:4`). Se resolvió su función musical (`initialMeasureRole: "pickup-counted-as-measure-1"`): corresponde a una **anacrusa de dos tiempos** (donde las voces melódicas del mariachi entran antes del tiempo fuerte del _Segno_ en el compás 2 mientras el guitarrón guarda silencio), y la edición de Jeff Nevin la incluye como compás 1 dentro de la numeración editorial (el sistema 1 abarca los compases 1–10 y el sistema 2 lleva impreso el número `11`). En consecuencia:

- El índice interno começa en `0` y el número de referencia en `1`.
- El número impreso (`printedNumber`) es un campo independiente y solo aparece en los inicios de sistema `11`, `19`, `28`, `39`, `50` y `52`.
- No se rellena el compás 1 con un tercer silencio inventado ni se desplaza la numeración a `0`.

## Indicaciones verificadas con imagen y audio

| Ubicación   | Lectura verificada                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| Inicio      | Clave de Fa, armadura sin alteraciones, 3/4, «Ranchera Valseada», blanca = 60 |
| 2           | Segno                                                                         |
| 10 → 11     | Ligadura entre las notas La2 al cruzar de sistema                             |
| 14          | Doble barra izquierda, C (4/4) y calderón sobre el silencio de blanca         |
| 15          | Ensayo A, «Ranchera Lenta», negra = 90                                        |
| 22          | Doble barra izquierda, regreso a 3/4; corchea anterior = negra nueva (♩=180)  |
| 26          | Ensayo B                                                                      |
| 35–37       | Fa sostenido en 35 y 36; becuadro explícito (`n`) en 37                       |
| 48 → 49     | Ligadura entre las notas La2                                                  |
| Final de 49 | Símbolo de salida a coda (`to-coda`)                                          |
| Final de 51 | «D.S. al Coda», regreso al segno (2) y salida en 49 hacia destino 52          |
| 52          | Destino coda                                                                  |
| Final de 55 | Barra final                                                                   |
