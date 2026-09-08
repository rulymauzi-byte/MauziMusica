# Mauzi Música PWA 3.0 — General + accesos separados por coro

Esta versión usa **un solo Google Apps Script** y permite crear muchos enlaces independientes:

- Biblioteca general.
- Coro Bethel.
- Coro Juvenil.
- Coro Femenil.
- Coro de niños.
- Cualquier otra carpeta que usted quiera.

Cada enlace abre **únicamente la carpeta autorizada**. La app no recibe el enlace de Drive de otros coros ni permite subir a la carpeta padre.

## Organización recomendada en Google Drive

No comparta la carpeta padre `MAUZI COROS`.

```text
MI DRIVE/
  MAUZI GENERAL/                 ← compartir individualmente si quiere un enlace general
    HIMNOS/
    ESPECIALES/

  MAUZI COROS/                   ← PRIVADA, NO compartir
    CORO BETHEL/                 ← compartir SOLO esta carpeta
      01 - Canto.mp3
      01 - Canto.txt
      02 - Otro canto.mp3
      02 - Otro canto.txt

    CORO JUVENIL/                ← compartir SOLO esta carpeta
      canciones...

    CORO FEMENIL/                ← compartir SOLO esta carpeta
      canciones...
```

**Importante:** comparta cada carpeta de coro como `Cualquier persona con el enlace · Lector`, pero deje `MAUZI COROS` privada. Así una persona que tenga el enlace de un coro no recibe un enlace a la carpeta padre ni a los otros coros.

## Letras

No hay sincronización. Solo lectura normal.

```text
01 - Sublime Gracia.mp3
01 - Sublime Gracia.txt
```

La app tiene botones **A− / A+** para cambiar el tamaño de la letra entre 16 y 40 px. El tamaño queda guardado en ese celular.

## PASO 1 — Apps Script (una sola vez)

1. Abra Google Apps Script y cree un proyecto.
2. Pegue `apps-script/Code.gs`.
3. Abra **Configuración del proyecto**.
4. En **Propiedades de la secuencia de comandos**, agregue:
   - Propiedad: `ADMIN_KEY`
   - Valor: una contraseña larga que solo usted conozca.
5. Implemente como **Aplicación web**.
6. Ejecutar como: **Yo**.
7. Acceso: **Cualquier persona**.
8. Copie la URL que termina en `/exec`.

No coloque `ADMIN_KEY` dentro de GitHub ni dentro de `config.js`.

## PASO 2 — config.js

Cambie solamente:

```js
apiUrl: 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT',
```

por la URL `/exec` de su Apps Script.

Esta URL será la misma para TODOS los coros.

## PASO 3 — GitHub Pages

Suba la carpeta de la PWA a GitHub y active Pages. No necesita crear un GitHub distinto para cada coro.

## Cómo crear el enlace de un coro

Abra la app SIN parámetros, por ejemplo:

```text
https://usuario.github.io/mauzi-musica/
```

En **Administrador**:

1. Nombre: `Coro Bethel`.
2. Pegue el enlace de la carpeta `CORO BETHEL` de Drive.
3. Escriba su `ADMIN_KEY`.
4. Pulse **Crear acceso**.
5. La app crea y copia un enlace parecido a:

```text
https://usuario.github.io/mauzi-musica/?share=9b8c...token-largo...
```

Ese es el enlace que manda al Coro Bethel.

Después repite el proceso para Coro Juvenil, Coro Femenil, etc. **No cambia Google Apps Script, no cambia config.js y no crea otra app.**

## Revocar un coro

En el administrador pulse **Ver accesos creados**. Puede:

- Abrir.
- Copiar.
- Revocar.

Al revocar, ese enlace deja de funcionar inmediatamente y no afecta a los demás coros.

## Seguridad sin cuentas

Este sistema usa un token largo e impredecible como llave de acceso. La app solo lista archivos que estén dentro de la carpeta asignada a ese token, y la lectura de letras también verifica que el `.txt` pertenezca a esa biblioteca.

Como no hay cuentas de usuario, una persona que reciba un enlace puede reenviarlo a otra persona. Para impedir también eso sería necesario añadir PIN, login o usuarios autorizados.

## Reproducción

Incluye:

- Reproducir/pausar.
- Anterior/siguiente.
- Aleatorio.
- Repetir una canción (`1`).
- Repetir carpeta/lista (`∞`).
- Búsqueda.
- Subcarpetas dentro del coro.
- Letra `.txt` con tamaño ajustable.
- Instalación PWA en Android/iPhone/PC.
