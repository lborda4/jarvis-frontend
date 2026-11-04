# SEO de JARVIS

Las páginas públicas se generan como HTML durante `npm run build`. No necesitan
JavaScript, una sesión ni una respuesta del backend para mostrar sus textos,
precios, preguntas frecuentes, enlaces y metadatos a los buscadores.

| URL canónica | Necesidad que atiende |
| --- | --- |
| https://www.jarviscol.com/ | Conocer JARVIS y elegir una solución |
| https://www.jarviscol.com/siigo | Automatización contable con Siigo, IA y cargue masivo de documentos soporte |
| https://www.jarviscol.com/facturacion-electronica | Facturación electrónica en Colombia: factura de venta, documento soporte, nota débito, nota crédito y RADIAN; planes y precios |

Estos temas son hipótesis de intención de búsqueda basadas en el producto, no una
investigación de volúmenes o una medición de posiciones. Deben contrastarse con
consultas e impresiones reales de Search Console después de publicar.

## Implementación y comprobación

- `src/marketing/seo.ts` es la fuente de títulos, descripciones, canonical,
  metadatos sociales y datos estructurados para HTML y navegación en el navegador.
- `src/marketing/catalog.ts` contiene las rutas públicas, los planes de Siigo y
  las recargas. El sitemap de producción se genera desde las rutas públicas.
- `src/marketing/content.ts` contiene preguntas frecuentes y pasos de uso. Las
  respuestas son visibles mediante HTML nativo, sin depender de JavaScript.
- `scripts/prerender.mjs` genera `dist/index.html`, las dos páginas de producto y
  `dist/app.html`, que es el fallback de la aplicación privada y tiene `noindex`.
- `vercel.json` sirve cada HTML público por su URL propia. Las demás rutas usan
  el fallback de la aplicación; los enlaces a login y la autenticación siguen
  funcionando. Si hay una sesión almacenada, se carga la aplicación existente
  para validarla; la detección de almacenamiento no autoriza acceso.
- El JavaScript y CSS del sistema contable se descargan al entrar a la aplicación,
  en lugar de formar parte de la carga inicial de un visitante de la landing.
- `npm run build` comprueba tipos, compila, genera los HTML y ejecuta las pruebas
  de SEO sobre los archivos finales. `npm run check:seo` repite únicamente esa
  última verificación cuando ya existe `dist`.

No se incluyen calificaciones, testimonios, direcciones ni certificaciones no
verificadas en los datos estructurados. El marcado de software describe las
ofertas, sin garantizar resultados enriquecidos. Las preguntas frecuentes ayudan
a los visitantes; no se promete que aparezcan como un resultado FAQ en Google.

## Pendiente al publicar en el dominio real

1. Desplegar con `npm run build` y publicar `dist` usando las reglas de
   `vercel.json`. Si el alojamiento no es Vercel, reproducir esas reglas: cada
   URL pública debe servir su HTML propio; el resto debe usar `app.html`.
2. Verificar con respuestas HTTP reales que `/`, `/siigo` y
   `/facturacion-electronica` devuelven `200`, su contenido completo y su propio
   canonical, sin encabezados `X-Robots-Tag: noindex` de un entorno de pruebas.
   Confirmar que los archivos CSS, JS, imágenes, `robots.txt` y `sitemap.xml` se
   sirven como archivos y no como el HTML de fallback.
3. Confirmar que el dominio sin `www` y las variantes HTTP redirigen al dominio
   HTTPS con `www`. La configuración del dominio se realiza en el alojamiento.
4. Verificar la propiedad del dominio en Google Search Console con la cuenta del
   propietario. No se ha agregado ningún token de verificación ficticio.
5. Enviar `https://www.jarviscol.com/sitemap.xml`, inspeccionar las tres URLs y
   solicitar indexación. Comprobar la URL canónica seleccionada por Google.
6. Medir clics, impresiones, consultas, páginas indexadas y Core Web Vitals.
   Comparar las consultas de marca con las de cada solución; ajustar los textos
   usando datos reales, sin repetir palabras clave de forma artificial.
7. Mantener precios y alcance actualizados. Publicar guías basadas en procesos
   reales cuando respondan preguntas de clientes y enlazarlas con la solución
   correspondiente. Obtener menciones y enlaces mediante relaciones comerciales
   reales, sin comprar enlaces ni inventar reseñas.

La optimización no garantiza indexación ni una posición concreta. No se realizó
un envío a Search Console ni un despliegue desde esta sesión. Tampoco se obtuvo
la transcripción del video de Oscar Contreras; las decisiones técnicas se
contrastaron con las siguientes fuentes oficiales:

- [Buenas prácticas de Google Search](https://developers.google.com/search/docs/essentials)
- [SEO para JavaScript y prerenderizado](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Canonical y URLs duplicadas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Excluir páginas con noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Datos estructurados de software](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Cambios en resultados FAQ](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [Prerenderizado con Vite](https://vite.dev/guide/ssr.html)
- [Rewrites de Vercel](https://vercel.com/docs/routing/rewrites)
