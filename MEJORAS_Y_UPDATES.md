# Mejoras y Posibles Updates - Groq Novel Translator

## Objetivo

Consolidar la aplicacion como una herramienta de traduccion de novelas ligeras con alta consistencia terminologica, flujo editorial y exportacion lista para publicacion.

## Estado Actual (ya implementado)

- Gestion de novelas: crear, seleccionar y eliminar.
- Glosario por novela: alta y baja de terminos.
- Traduccion por capitulo con Groq.
- Historial de traducciones por novela.
- Exportacion en txt, docx y epub.
- Verificacion de cumplimiento de glosario en cada traduccion.
- Importador de archivo fuente txt/docx con deteccion de capitulos.
- Interfaz renovada con Tailwind para un flujo mas claro.

## Aseguramiento de Glosario (implementado)

Para reducir errores de consistencia, el backend aplica varias capas:

1. Tokenizacion de terminos
- Antes de traducir, reemplaza terminos detectados del glosario por tokens del tipo [[GLOSSARY_N]].
- Esto evita que el modelo "reinvente" traducciones para esos terminos.

2. Reglas obligatorias al modelo
- El prompt exige mantener los tokens intactos.
- Se inyecta un mapa token -> traduccion obligatoria.

3. Restauracion posterior
- Tras recibir la respuesta, los tokens se restauran por su traduccion fija del glosario.

4. Validacion automatica
- Se comprueba si cada traduccion obligatoria requerida aparece en el texto final.

5. Reparacion en segunda pasada
- Si faltan terminos, se ejecuta una pasada de correccion con temperatura 0.
- Se vuelve a validar y se guarda el estado de cumplimiento.

6. Trazabilidad
- Cada traduccion guarda:
  - strict (cumple o no)
  - repaired (si se corrigio en segunda pasada)
  - passes (cantidad de pasadas)
  - missingTerms (terminos que faltaron)

## Mejoras Prioritarias (proximo sprint)

1. Importacion de archivos fuente
- Cargar txt/docx para traduccion directa.
- Separacion por capitulos automatica.

Estado: Completado en MVP actual.

2. Exportacion avanzada
- EPUB con metadata completa (autor, serie, volumen, portada).
- DOCX con estilos editoriales (dialogos, encabezados, notas).

3. Modo lote
- Traducir multiples capitulos en cola.
- Reintentos automaticos por limites de API.

4. Control de calidad linguistica
- Deteccion de inconsistencias de nombres entre capitulos.
- Lista de advertencias de puntuacion/registro.

5. Versionado de glosario
- Historial de cambios por termino.
- Comparar versiones y revertir cambios.

## Mejoras de Producto (mediano plazo)

1. Roles y colaboracion
- Editor, traductor, revisor.
- Comentarios por parrafo.

2. Memoria de estilo por novela
- Reglas fijas de tratamiento, tono y localizacion.
- Perfiles de estilo reutilizables.

3. Costos y observabilidad
- Dashboard de tokens por novela/capitulo/modelo.
- Estimacion de costo por lote.

4. Integracion editorial
- Exportacion compatible con flujo Kindle y agregadores EPUB.
- Plantillas de salida por sello/editorial.

## Posibles Updates Tecnicos

1. Persistencia robusta
- Migrar de JSON local a SQLite o PostgreSQL.
- Indices por novela, capitulo y estado de revision.

2. Seguridad
- Autenticacion de usuario.
- Cifrado de secretos y separacion de entornos.

3. Escalabilidad
- Cola de trabajos (BullMQ/Redis) para traducciones largas.
- Workers para exportaciones pesadas.

4. Testing
- Pruebas unitarias para tokenizacion y validacion de glosario.
- Pruebas de integracion para endpoints de traduccion/exportacion.

## Criterios de Exito

- Cumplimiento de glosario >= 99% en traducciones guardadas.
- Tiempo medio de traduccion por capitulo dentro de objetivo definido.
- Cero fallos en exportacion de formatos soportados.
- Reduccion de correcciones manuales por termino inconsistente.

## Roadmap sugerido

- Semana 1: importador txt/docx + mejoras de EPUB.
- Semana 2: modo lote + reintentos + dashboard basico de tokens.
- Semana 3: versionado de glosario + reportes de consistencia.
- Semana 4: autenticacion y preparacion para despliegue multiusuario.
