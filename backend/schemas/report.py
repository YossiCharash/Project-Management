from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class ReportOptions(BaseModel):
    project_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    include_summary: bool = True
    include_budgets: bool = True
    include_funds: bool = False
    include_transactions: bool = True
    transaction_types: Optional[List[str]] = None  # ["Income", "Expense"]
    only_recurring: bool = False
    
    # Filter options
    categories: Optional[List[str]] = None # List of category names
    suppliers: Optional[List[int]] = None # List of supplier IDs
    
    # Extra inclusions for ZIP
    include_project_image: bool = False
    include_project_contract: bool = False
    
    format: str = "pdf"  # "pdf", "excel", "zip"
