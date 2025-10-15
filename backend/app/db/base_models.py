# Import models so that Base.metadata is populated for migrations/DDL
from app.models.user import User  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
