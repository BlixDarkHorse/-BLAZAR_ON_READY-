"""OAuth 2.0 Identity Provider microservice for Google Sign-In.

Designed for Google Cloud Run with FastAPI. All secrets are read from
environment variables; no credentials are hard-coded.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

LOGGER = logging.getLogger("universobdh-idp")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

AUTH_DOMAIN = os.getenv("AUTH_DOMAIN", "auth.galaxymanager.system")
FRONTEND_ORIGIN = "https://ent.universobdh.me"
FRONTEND_SUCCESS_URL = f"{FRONTEND_ORIGIN}/bor/KILLROG.html"
FRONTEND_ERROR_URL = os.getenv("FRONTEND_ERROR_URL", FRONTEND_SUCCESS_URL)
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = "openid email profile"
JWT_ALGORITHM = "HS256"
JWT_ISSUER = f"https://{AUTH_DOMAIN}"
JWT_AUDIENCE = FRONTEND_ORIGIN
JWT_TTL_MINUTES = int(os.getenv("JWT_TTL_MINUTES", "60"))
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "10"))
COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "universobdh_auth")
USE_QUERY_TOKEN_REDIRECT = os.getenv("USE_QUERY_TOKEN_REDIRECT", "false").lower() == "true"


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _google_redirect_uri(request: Request) -> str:
    configured = os.getenv("GOOGLE_REDIRECT_URI")
    if configured:
        return configured
    return str(request.url_for("google_callback"))


def _frontend_error_redirect(code: str) -> RedirectResponse:
    separator = "&" if "?" in FRONTEND_ERROR_URL else "?"
    return RedirectResponse(
        f"{FRONTEND_ERROR_URL}{separator}error={code}",
        status_code=status.HTTP_302_FOUND,
    )


def _create_jwt(*, user_id: str, email: str) -> str:
    jwt_secret = _required_env("JWT_SECRET")
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=JWT_TTL_MINUTES),
    }
    return jwt.encode(payload, jwt_secret, algorithm=JWT_ALGORITHM)


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    service: str = Field(examples=["universobdh-idp"])


app = FastAPI(
    title="Universo BDH Identity Provider",
    description="OAuth 2.0 IdP microservice for Google Sign-In on Cloud Run.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", os.getenv("JWT_SECRET", secrets.token_urlsafe(32))),
    same_site="none",
    https_only=True,
)


@app.get("/healthz", response_model=HealthResponse, tags=["health"])
async def healthz() -> HealthResponse:
    return HealthResponse(status="ok", service="universobdh-idp")


@app.get("/auth/google/login", tags=["oauth-google"])
async def google_login(request: Request) -> RedirectResponse:
    """Build Google's authorization URL and redirect the browser to Google."""
    client_id = _required_env("GOOGLE_CLIENT_ID")
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state

    params = {
        "client_id": client_id,
        "redirect_uri": _google_redirect_uri(request),
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state,
        "access_type": "online",
        "include_granted_scopes": "true",
        "prompt": "select_account",
    }
    return RedirectResponse(
        f"{GOOGLE_AUTH_URL}?{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )


@app.get("/auth/google/callback", tags=["oauth-google"])
async def google_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    """Exchange Google's authorization code, issue our JWT, and return to frontend."""
    if error:
        LOGGER.warning("Google OAuth returned error: %s", error)
        return _frontend_error_redirect("google_oauth_denied")
    if not code:
        return _frontend_error_redirect("missing_code")
    expected_state = request.session.pop("oauth_state", None)
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        LOGGER.warning("Invalid OAuth state received")
        return _frontend_error_redirect("invalid_state")

    token_payload = {
        "client_id": _required_env("GOOGLE_CLIENT_ID"),
        "client_secret": _required_env("GOOGLE_CLIENT_SECRET"),
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": _google_redirect_uri(request),
    }

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            token_response = await client.post(GOOGLE_TOKEN_URL, data=token_payload)
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                LOGGER.error("Google token response did not include access_token")
                return _frontend_error_redirect("token_exchange_failed")

            user_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_response.raise_for_status()
            google_user = user_response.json()
    except httpx.HTTPStatusError as exc:
        LOGGER.warning("Google API rejected OAuth exchange: %s", exc.response.text)
        return _frontend_error_redirect("google_rejected_token")
    except httpx.HTTPError:
        LOGGER.exception("Google OAuth HTTP communication failed")
        return _frontend_error_redirect("google_unavailable")

    user_id = google_user.get("sub")
    email = google_user.get("email")
    if not user_id or not email:
        LOGGER.warning("Google userinfo missing required fields: %s", google_user)
        return _frontend_error_redirect("invalid_google_profile")

    issued_token = _create_jwt(user_id=user_id, email=email)
    if USE_QUERY_TOKEN_REDIRECT:
        return RedirectResponse(
            f"{FRONTEND_SUCCESS_URL}?token={issued_token}",
            status_code=status.HTTP_302_FOUND,
        )

    response = RedirectResponse(FRONTEND_SUCCESS_URL, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=COOKIE_NAME,
        value=issued_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_TTL_MINUTES * 60,
        path="/",
    )
    return response


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError) -> JSONResponse:
    LOGGER.error("Configuration error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Identity service configuration error."},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
