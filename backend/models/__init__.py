# Import all models to ensure they are registered with SQLAlchemy
from backend.models.user import User, UserRole
from backend.models.project import Project
from backend.models.subproject import Subproject
from backend.models.transaction import Transaction, TransactionType, ExpenseCategory
from backend.models.audit_log import AuditLog
from backend.models.supplier import Supplier
from backend.models.supplier_document import SupplierDocument
from backend.models.admin_invite import AdminInvite
from backend.models.email_verification import EmailVerification
from backend.models.group_code import GroupCode

__all__ = [
    "User",
    "UserRole", 
    "Project",
    "Subproject",
    "Transaction",
    "TransactionType",
    "ExpenseCategory",
    "AuditLog",
    "Supplier",
    "SupplierDocument",
    "AdminInvite",
    "EmailVerification",
    "GroupCode"
]
