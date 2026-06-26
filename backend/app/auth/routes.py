from fastapi import APIRouter

from app.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    ValidateDocumentRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    PasswordRequestCode,
    PasswordVerifyCode,
    PasswordReset,
)

from app.auth.service import (
    login_service,
    register_service,
    validate_document_service,
    verify_email_service,
    resend_verification_service,
    password_request_code_service,
    password_verify_code_service,
    password_reset_service,
    refresh_token_service,
    logout_service,
)


router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


@router.post("/login")
def login(payload: LoginRequest):
    return login_service(payload)


@router.post("/register")
def register(payload: RegisterRequest):
    return register_service(payload)


@router.post("/validate-document")
def validate_document(payload: ValidateDocumentRequest):
    return validate_document_service(payload)


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest):
    return verify_email_service(payload)


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest):
    return resend_verification_service(payload)


@router.post("/password/request-code")
def password_request_code(payload: PasswordRequestCode):
    return password_request_code_service(payload)


@router.post("/password/verify-code")
def password_verify_code(payload: PasswordVerifyCode):
    return password_verify_code_service(payload)


@router.post("/password/reset")
def password_reset(payload: PasswordReset):
    return password_reset_service(payload)


@router.post("/refresh")
def refresh_token(payload: dict):
    return refresh_token_service(payload)


@router.post("/logout")
def logout(payload: dict):
    return logout_service(payload)