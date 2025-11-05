import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from backend.core.config import settings


class EmailService:
    def __init__(self):
        self.smtp_server = getattr(settings, 'SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_username = getattr(settings, 'SMTP_USERNAME', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.from_email = getattr(settings, 'FROM_EMAIL', 'noreply@example.com')

    async def send_verification_email(self, email: str, verification_code: str, full_name: str, verification_type: str, verification_link: str = None) -> bool:
        """Send email verification code and/or link"""
        try:
            link_text = f"\n\nאו לחצו על הקישור הבא:\n{verification_link}\n" if verification_link else ""

            if verification_type == 'admin_register':
                subject = "אימות כתובת אימייל - רישום מנהל מערכת"
                body = f"""
                שלום {full_name},

                קיבלתם הודעה זו כי נרשמתם כמנהל מערכת במערכת ניהול פרויקטי החזקת מבנים.

                קוד האימות שלכם הוא: {verification_code}
                {link_text}

                קוד זה תקף למשך 15 דקות.

                אם לא נרשמתם למערכת, אנא התעלמו מהודעה זו.

                בברכה,
                צוות המערכת
                """
            elif verification_type == 'member_register':
                subject = "אימות כתובת אימייל - רישום משתמש"
                body = f"""
                שלום {full_name},

                קיבלתם הודעה זו כי נרשמתם כמשתמש במערכת ניהול פרויקטי החזקת מבנים.

                קוד האימות שלכם הוא: {verification_code}
                {link_text}

                קוד זה תקף למשך 15 דקות.

                אם לא נרשמתם למערכת, אנא התעלמו מהודעה זו.

                בברכה,
                צוות המערכת
                """
            else:
                subject = "אימות כתובת אימייל"
                body = f"""
                שלום,

                קוד האימות שלכם הוא: {verification_code}
                {link_text}

                קוד זה תקף למשך 15 דקות.

                בברכה,
                צוות המערכת
                """

            return await self._send_email(email, subject, body)
        except Exception:
            return False

    async def send_admin_invite_email(self, email: str, full_name: str, invite_code: str) -> bool:
        """Send admin invite email"""
        try:
            subject = "הזמנה להצטרפות כמנהל מערכת"
            body = f"""
            שלום {full_name},

            הוזמנתם להצטרף כמנהל מערכת במערכת ניהול פרויקטי החזקת מבנים.

            קוד ההזמנה שלכם הוא: {invite_code}

            כדי להשלים את ההרשמה, גשו לקישור הבא:
            http://localhost:3000/admin-invite

            קוד זה תקף למשך 7 ימים.

            בברכה,
            צוות המערכת
            """

            return await self._send_email(email, subject, body)
        except Exception:
            return False

    async def send_member_invite_email(self, email: str, full_name: str, registration_link: str, expires_days: int) -> bool:
        """Send member/employee invite email with registration link"""
        try:
            subject = "הזמנה להצטרפות למערכת ניהול פרויקטים"
            body = f"""
            שלום {full_name},

            הוזמנתם להצטרף למערכת ניהול פרויקטי החזקת מבנים.

            כדי להשלים את ההרשמה, לחצו על הקישור הבא:
            {registration_link}

            הקישור תקף למשך {expires_days} ימים.

            אם לא יצרתם את הקישור הזה, אנא התעלמו מהודעה זו.

            בברכה,
            צוות המערכת
            """

            return await self._send_email(email, subject, body)
        except Exception:
            return False

    async def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        """Send email using SMTP"""
        try:
            # If no SMTP credentials, return True (for development)
            if not self.smtp_username or not self.smtp_password:
                return True

            # Create message
            message = MIMEMultipart()
            message["From"] = self.from_email
            message["To"] = to_email
            message["Subject"] = subject

            # Add body to email
            message.attach(MIMEText(body, "plain", "utf-8"))

            # Create SMTP session
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, to_email, message.as_string())

            return True
        except Exception:
            return False
