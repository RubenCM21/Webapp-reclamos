"""
routers/auth.py — Endpoints de autenticación.

POST /api/auth/login           → OAuth2 form (username + password)
POST /api/auth/logout          → Invalida token
GET  /api/auth/me              → Perfil del usuario autenticado
POST /api/auth/register        → Registro de nuevo cliente
POST /api/auth/verificar-cuenta → Verificar OTP
POST /api/auth/reenviar-codigo  → Reenviar OTP
POST /api/auth/recuperar-password  → Solicitar reset
POST /api/auth/restablecer-password → Nuevo password con token
"""

import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, get_client_ip
from auth import (
    verify_password, hash_password, create_access_token,
    store_otp, verify_otp, get_otp_user_id,
    store_reset_token, verify_reset_token, blacklist_token, decode_token
)
from auth import _otp_store   # acceso directo al OTP store para reenvío
import models, schemas, utils
from fastapi.security import OAuth2PasswordBearer


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _find_user_by_credentials(db: Session, username: str) -> models.Usuario | None:
    """Busca usuario por username, correo, DNI o RUC."""
    u = db.query(models.Usuario).filter(
        (models.Usuario.username == username) |
        (models.Usuario.correo == username)
    ).first()
    if u:
        return u
    # Buscar por documento del cliente
    cliente = db.query(models.Cliente).filter(
        models.Cliente.documento_numero == username
    ).first()
    if cliente and cliente.usuario:
        return cliente.usuario
    return None


# ── POST /api/auth/login ─────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.LoginResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    request: Request = None,
):
    user = _find_user_by_credentials(db, form_data.username)

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas. Verifica usuario y contraseña.",
        )

    if user.estado == "BLOQUEADO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está bloqueada. Contacta al administrador.",
        )

    if user.estado == "INACTIVO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta no está verificada. Revisa tu correo.",
        )

    # Actualizar último acceso
    user.ultimo_acceso = datetime.now()
    db.commit()

    # Crear token
    token, jti = create_access_token(
        user_id=user.usuario_id,
        role=user.rol.nombre,
        username=user.username,
    )

    # Guardar sesión
    sesion = models.SesionUsuario(
        usuario_id=user.usuario_id,
        token_jti=jti,
        ip_address=get_client_ip(request) if request else "0.0.0.0",
        user_agent=request.headers.get("user-agent", "") if request else "",
    )
    db.add(sesion)
    db.commit()

    p = user.personal
    nombre = f"{p.nombres} {p.apellidos}".strip() if p else user.username
    c = user.cliente
    if c and not nombre:
        nombre = f"{c.nombres or ''} {c.apellidos or ''} {c.razon_social or ''}".strip()

    return schemas.LoginResponse(
        access_token=token,
        user_id=user.usuario_id,
        username=user.username,
        role=user.rol.nombre,
        nombre_completo=nombre or user.username,
    )


# ── POST /api/auth/logout ────────────────────────────────────────────────────

@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if token:
        payload = decode_token(token)
        if payload:
            jti = payload.get("jti")
            if jti:
                blacklist_token(jti)
                db.query(models.SesionUsuario).filter(
                    models.SesionUsuario.token_jti == jti
                ).update({"activa": False, "fecha_fin": datetime.now()})
                db.commit()
    return {"detail": "Sesión cerrada correctamente."}


# ── GET /api/auth/me ─────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.MeResponse)
def me(current_user: models.Usuario = Depends(get_current_user)):
    p = current_user.personal
    c = current_user.cliente

    nombre = ""
    if p:
        nombre = f"{p.nombres} {p.apellidos}".strip()
    elif c:
        nombre = (f"{c.nombres or ''} {c.apellidos or ''}".strip()
                  or c.razon_social or current_user.username)
    else:
        nombre = current_user.username

    return schemas.MeResponse(
        user_id=current_user.usuario_id,
        username=current_user.username,
        correo=current_user.correo,
        role=current_user.rol.nombre,
        nombre_completo=nombre,
        area=current_user.area.nombre if current_user.area else None,
        estado=current_user.estado,
        ultimo_acceso=utils.fmt_datetime(current_user.ultimo_acceso),
    )


# ── POST /api/auth/register ──────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: schemas.RegisterClienteCreate,
    db: Session = Depends(get_db),
):
    # Validar duplicados
    if db.query(models.Usuario).filter(models.Usuario.correo == payload.email).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")
    if db.query(models.Cliente).filter(models.Cliente.documento_numero == payload.document_number).first():
        raise HTTPException(status_code=400, detail="El documento ya está registrado.")

    # Obtener rol de cliente
    rol_nombre = "cliente-persona" if payload.account_type == "persona" else "cliente-empresa"
    rol = db.query(models.Rol).filter(models.Rol.nombre == rol_nombre).first()
    if not rol:
        # Fallback
        rol = db.query(models.Rol).filter(models.Rol.nombre.ilike("%cliente%")).first()
    if not rol:
        raise HTTPException(status_code=500, detail="Rol de cliente no configurado. Ejecuta el script de seed.")

    # Crear usuario
    username = payload.email.split("@")[0]
    # Asegurar username único
    base = username
    counter = 1
    while db.query(models.Usuario).filter(models.Usuario.username == username).first():
        username = f"{base}{counter}"
        counter += 1

    new_user = models.Usuario(
        rol_id=rol.rol_id,
        username=username,
        correo=payload.email,
        password_hash=hash_password(payload.password),
        estado="INACTIVO",   # Inactivo hasta verificar OTP
    )
    db.add(new_user)
    db.flush()   # Para obtener usuario_id

    # Crear cliente
    tipo = "PERSONA" if payload.account_type == "persona" else "EMPRESA"
    new_cliente = models.Cliente(
        usuario_id=new_user.usuario_id,
        tipo_cliente=tipo,
        nombres=payload.names,
        apellidos=payload.last_names,
        razon_social=payload.company_name,
        documento_tipo=payload.document_type.upper(),
        documento_numero=payload.document_number,
        correo=payload.email,
        telefono=payload.phone,
        direccion=payload.address,
    )
    db.add(new_cliente)
    db.commit()

    # Generar y almacenar OTP
    otp_code = "".join(random.choices(string.digits, k=6))
    store_otp(payload.email, otp_code, new_user.usuario_id)

    # TODO: En producción enviar OTP por correo/SMS
    print(f"[DEV] OTP para {payload.email}: {otp_code}")

    return {
        "id": new_user.usuario_id,
        "account_type": payload.account_type,
        "email": payload.email,
        "detail": "Cuenta creada. Verifica tu correo con el código enviado.",
    }


# ── POST /api/auth/verificar-cuenta ─────────────────────────────────────────

@router.post("/verificar-cuenta")
def verificar_cuenta(
    payload: schemas.VerifyAccountRequest,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """
    Verifica el OTP. El correo puede venir en el payload o del token JWT.
    En DEV acepta el código "123456" para cualquier correo.
    """
    correo = payload.correo

    # Si no viene correo en payload, sacarlo del token (si está autenticado)
    if not correo and token:
        jwt_payload = decode_token(token)
        if jwt_payload:
            sub = jwt_payload.get("sub")
            if sub:
                u = db.query(models.Usuario).filter(models.Usuario.usuario_id == int(sub)).first()
                if u:
                    correo = u.correo

    if not correo:
        raise HTTPException(status_code=400, detail="No se pudo determinar el correo a verificar.")

    user_id = verify_otp(correo, payload.code)
    if user_id is None:
        # Intentar buscar el user_id del store aunque el código no coincida (para demo)
        user_id = get_otp_user_id(correo)
        if not user_id or payload.code != "123456":
            raise HTTPException(status_code=400, detail="Código inválido o expirado.")

    user = db.query(models.Usuario).filter(models.Usuario.usuario_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    user.estado = "ACTIVO"
    db.commit()

    return {"detail": "Cuenta verificada correctamente. Ya puedes iniciar sesión."}


# ── POST /api/auth/reenviar-codigo ───────────────────────────────────────────

@router.post("/reenviar-codigo")
def reenviar_codigo(
    payload: schemas.ResendCodeRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.Usuario).filter(models.Usuario.correo == payload.correo).first()
    if not user:
        # No revelar si existe o no
        return {"detail": "Si el correo existe, recibirás un nuevo código."}

    otp_code = "".join(random.choices(string.digits, k=6))
    store_otp(payload.correo, otp_code, user.usuario_id)

    print(f"[DEV] OTP reenviado para {payload.correo}: {otp_code}")

    return {"detail": "Código reenviado. Revisa tu correo."}


# ── POST /api/auth/recuperar-password ────────────────────────────────────────

@router.post("/recuperar-password")
def recuperar_password(
    payload: schemas.RecuperarPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.Usuario).filter(models.Usuario.correo == payload.correo).first()
    if user:
        import secrets
        reset_token = secrets.token_urlsafe(32)
        store_reset_token(reset_token, user.usuario_id)
        print(f"[DEV] Reset token para {payload.correo}: {reset_token}")
        # TODO: Enviar por email en producción

    return {"detail": "Si el correo existe, recibirás un enlace para restablecer tu contraseña."}


# ── POST /api/auth/restablecer-password ──────────────────────────────────────

@router.post("/restablecer-password")
def restablecer_password(
    payload: schemas.RestablecerPasswordRequest,
    db: Session = Depends(get_db),
):
    user_id = verify_reset_token(payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")

    user = db.query(models.Usuario).filter(models.Usuario.usuario_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    user.password_hash = hash_password(payload.nueva_password)
    user.fecha_actualizacion = datetime.now()
    db.commit()

    return {"detail": "Contraseña restablecida correctamente."}


# ── POST /api/auth/cambiar-password (usuario autenticado) ────────────────────

@router.post("/cambiar-password")
def cambiar_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.password_actual, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")

    current_user.password_hash = hash_password(payload.password_nueva)
    current_user.fecha_actualizacion = datetime.now()
    db.commit()

    return {"detail": "Contraseña actualizada correctamente."}
