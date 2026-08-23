"""Authentication endpoints: register, login, logout, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import TOKEN_COOKIE, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import auth_per_minute, client_key
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_token_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=TOKEN_COOKIE,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, request: Request, response: Response, db: Session = Depends(get_db)):
    if not auth_per_minute.allow(client_key(request)):
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    # Every user starts on the Free plan (database is the source of truth).
    from app.services.billing import get_or_create_subscription

    get_or_create_subscription(db, user)
    token = create_access_token(user.id)
    _set_token_cookie(response, token)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    if not auth_per_minute.allow(client_key(request)):
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token(user.id)
    _set_token_cookie(response, token)
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(TOKEN_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user
