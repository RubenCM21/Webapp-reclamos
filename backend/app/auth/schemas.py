from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    identifier: str
    password: str
    selected_role: str
    remember_me: bool = False


class RegisterRequest(BaseModel):
    account_type: str
    document_type: str
    document_number: str
    first_name: str | None = None
    last_name: str | None = None
    business_name: str | None = None
    representative_name: str | None = None
    business_area: str | None = None
    email: EmailStr
    phone: str
    address: str
    service_type: str
    service_number: str
    plan_type: str
    password: str = Field(min_length=8)
    notification_preferences: dict | None = None


class ValidateDocumentRequest(BaseModel):
    account_type: str
    document_type: str
    document_number: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str
    purpose: str = "REGISTRO"


class ResendVerificationRequest(BaseModel):
    email: EmailStr
    purpose: str = "REGISTRO"


class PasswordRequestCode(BaseModel):
    account_type: str
    identifier: str


class PasswordVerifyCode(BaseModel):
    account_type: str
    identifier: str
    code: str


class PasswordReset(BaseModel):
    account_type: str
    identifier: str
    reset_token: str
    new_password: str = Field(min_length=8)