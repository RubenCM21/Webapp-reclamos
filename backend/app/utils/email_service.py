import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def send_email(to_email: str, subject: str, html_body: str):
    if not settings.SMTP_HOST:
        raise RuntimeError("SMTP_HOST no está configurado.")

    if not settings.SMTP_USERNAME:
        raise RuntimeError("SMTP_USERNAME no está configurado.")

    if not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP_PASSWORD no está configurado.")

    if not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP_FROM_EMAIL no está configurado.")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email

    message.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, to_email, message.as_string())


def send_verification_code_email(to_email: str, code: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #222;">
        <h2>Claro Atención 360</h2>
        <p>Hemos recibido una solicitud de verificación de cuenta.</p>
        <p>Tu código de verificación es:</p>
        <h1 style="letter-spacing: 4px;">{code}</h1>
        <p>Este código es temporal y solo debe ser usado por ti.</p>
        <p>Si no solicitaste esta operación, ignora este mensaje.</p>
    </div>
    """

    send_email(
        to_email=to_email,
        subject="Código de verificación - Claro Atención 360",
        html_body=html
    )


def send_password_reset_code_email(to_email: str, code: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; color: #222;">
        <h2>Claro Atención 360</h2>
        <p>Hemos recibido una solicitud para recuperar tu contraseña.</p>
        <p>Tu código de recuperación es:</p>
        <h1 style="letter-spacing: 4px;">{code}</h1>
        <p>Este código es temporal. No lo compartas con nadie.</p>
        <p>Si no solicitaste esta operación, ignora este mensaje.</p>
    </div>
    """

    send_email(
        to_email=to_email,
        subject="Recuperación de contraseña - Claro Atención 360",
        html_body=html
    )