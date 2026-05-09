# Íconos PWA

Para completar la configuración PWA, generá los siguientes íconos y colocalos en esta carpeta:

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `icon-72x72.png` | 72×72 | Android |
| `icon-96x96.png` | 96×96 | Android |
| `icon-128x128.png` | 128×128 | Android |
| `icon-144x144.png` | 144×144 | Android |
| `icon-152x152.png` | 152×152 | iPad |
| `icon-192x192.png` | 192×192 | Android (principal) |
| `icon-384x384.png` | 384×384 | Android |
| `icon-512x512.png` | 512×512 | Android / Splash |
| `apple-touch-icon.png` | 180×180 | iPhone 14 home screen |

## Cómo generarlos

Podés usar [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator):

```bash
npx pwa-asset-generator logo.png ./public/icons --manifest ./public/manifest.json
```

O subir el logo a [favicon.io](https://favicon.io/) y descargar el paquete completo.

## Diseño sugerido

- Fondo: #0D0F14 (dark) o #6366F1 (accent)
- Letra "A" en blanco, tipografía Inter Bold
- Radio de borde: 22% (maskable icon spec)
