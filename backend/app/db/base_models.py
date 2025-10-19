# Import models so that Base.metadata is populated for migrations/DDL
from backend.app.models.user import User  # noqa: F401
from backend.app.models.project import Project  # noqa: F401
from backend.app.models.transaction import Transaction  # noqa: F401
from backend.app.models.audit_log import AuditLog  # noqa: F401
from backend.app.models.supplier import Supplier  # noqa: F401
from backend.app.models.supplier_document import SupplierDocument  # noqa: F401
