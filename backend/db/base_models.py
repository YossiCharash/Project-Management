# Import models so that Base.metadata is populated for migrations/DDL
from backend.models.user import User  # noqa: F401
from backend.models.project import Project  # noqa: F401
from backend.models.subproject import Subproject  # noqa: F401
from backend.models.transaction import Transaction  # noqa: F401
from backend.models.audit_log import AuditLog  # noqa: F401
from backend.models.supplier import Supplier  # noqa: F401
from backend.models.supplier_document import SupplierDocument  # noqa: F401
from backend.models.admin_invite import AdminInvite  # noqa: F401
from backend.models.email_verification import EmailVerification  # noqa: F401
from backend.models.group_code import GroupCode  # noqa: F401
