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

    async def send_verification_email(self, email: str, verification_code: str, full_name: str, verification_type: str) -> bool:
        """Send email verification code"""
        try:
            if verification_type == 'admin_register':
                subject = "אימות כתובת אימייל - רישום מנהל מערכת"
                body = f"""
                שלום {full_name},

                קיבלתם הודעה זו כי נרשמתם כמנהל מערכת במערכת ניהול פרויקטי החזקת מבנים.

                קוד האימות שלכם הוא: {verification_code}

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

                קוד זה תקף למשך 15 דקות.

                בברכה,
                צוות המערכת
                """

            return await self._send_email(email, subject, body)
        except Exception as e:
            print(f"Error sending verification email: {e}")
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
        except Exception as e:
            print(f"Error sending invite email: {e}")
            return False

    async def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        """Send email using SMTP"""
        try:
            # If no SMTP credentials, just print to console (for development)
            if not self.smtp_username or not self.smtp_password:
                print(f"\n{'='*50}")
                print(f"EMAIL TO: {to_email}")
                print(f"SUBJECT: {subject}")
                print(f"BODY:\n{body}")
                print(f"{'='*50}\n")
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
        except Exception as e:
            print(f"Error sending email: {e}")
            return False
