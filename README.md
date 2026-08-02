# Universo BDH Identity Provider

Microservicio de Identidad (IdP) OAuth 2.0 con Google, construido con Python 3.11 y FastAPI para desplegar en Google Cloud Run bajo el dominio `auth.galaxymanager.system`.

## Árbol de archivos

```text
.
├── .dockerignore
├── CNAME
├── Dockerfile
├── README.md
├── index.html
├── main.py
└── requirements.txt
```

## Endpoints principales

- `GET /auth/google/login`: construye la URL de autorización de Google y redirige al usuario a Google.
- `GET /auth/google/callback`: recibe `code`, intercambia el código por token con Google, obtiene `sub` y `email`, emite un JWT propio y redirige al frontend.
- `GET /healthz`: endpoint de salud para Cloud Run.

## Variables de entorno obligatorias

| Variable | Descripción |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID del OAuth Client de Google. |
| `GOOGLE_CLIENT_SECRET` | Client Secret del OAuth Client de Google. |
| `JWT_SECRET` | Secreto fuerte para firmar JWT HS256. |

## Variables opcionales

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `AUTH_DOMAIN` | `auth.galaxymanager.system` | Dominio público del IdP. |
| `GOOGLE_REDIRECT_URI` | URL generada por FastAPI | Úsala si Cloud Run queda detrás de un dominio custom. Recomendado: `https://auth.galaxymanager.system/auth/google/callback`. |
| `SESSION_SECRET` | Derivado de `JWT_SECRET` si existe | Secreto para firmar la cookie temporal de estado OAuth. |
| `JWT_TTL_MINUTES` | `60` | Tiempo de vida del JWT emitido. |
| `USE_QUERY_TOKEN_REDIRECT` | `false` | Si es `true`, redirige a `KILLROG.html?token=<JWT>`. Si es `false`, usa cookie `HttpOnly`, `Secure`, `SameSite=None`. |
| `AUTH_COOKIE_NAME` | `universobdh_auth` | Nombre de la cookie segura. |
| `FRONTEND_ERROR_URL` | `https://ent.universobdh.me/bor/KILLROG.html` | URL de retorno cuando hay error. |

## Recomendación de producción

La opción por defecto usa cookie `HttpOnly`, `Secure`, `SameSite=None` para reducir exposición del JWT a JavaScript, historial del navegador, logs y referers. Si el frontend heredado necesita leer explícitamente `?token=`, define `USE_QUERY_TOKEN_REDIRECT=true`.

## Despliegue en Google Cloud Run

Antes de desplegar, configura en Google Cloud Console este redirect URI autorizado:

```text
https://auth.galaxymanager.system/auth/google/callback
```

Comando base:

```bash
gcloud run deploy universobdh-idp \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars AUTH_DOMAIN=auth.galaxymanager.system,GOOGLE_REDIRECT_URI=https://auth.galaxymanager.system/auth/google/callback,USE_QUERY_TOKEN_REDIRECT=false \
  --set-secrets GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,JWT_SECRET=JWT_SECRET:latest,SESSION_SECRET=SESSION_SECRET:latest
```

> Crea previamente los secretos en Secret Manager o cambia `--set-secrets` por `--set-env-vars` solo en entornos no productivos.
