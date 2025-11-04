from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.models.user import UserRole
from backend.models.supplier import Supplier
from backend.models.supplier_document import SupplierDocument
from backend.repositories.supplier_repository import SupplierRepository
from backend.repositories.supplier_document_repository import SupplierDocumentRepository
from backend.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate
from backend.core.config import settings
import os
import re
import shutil
from uuid import uuid4

router = APIRouter()


def sanitize_filename(name: str) -> str:
    """Sanitize supplier name to be used as directory name"""
    # Remove or replace invalid characters for Windows/Linux file paths
    # Keep only alphanumeric, Hebrew, spaces, and common punctuation
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    # Replace multiple spaces/underscores with single underscore
    sanitized = re.sub(r'[\s_]+', '_', sanitized)
    # If empty after sanitization, use a default
    if not sanitized:
        sanitized = 'supplier'
    return sanitized


def get_uploads_dir() -> str:
    """Get absolute path to uploads directory, resolving relative paths relative to backend directory"""
    if os.path.isabs(settings.FILE_UPLOAD_DIR):
        return settings.FILE_UPLOAD_DIR
    else:
        # Get the directory where this file is located, then go up to backend directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go from api/v1/endpoints to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        return os.path.abspath(os.path.join(backend_dir, settings.FILE_UPLOAD_DIR))


@router.get("/", response_model=list[SupplierOut])
async def list_suppliers(db: DBSessionDep, user = Depends(get_current_user)):
    """List suppliers - accessible to all authenticated users"""
    return await SupplierRepository(db).list()


@router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get supplier by ID - accessible to all authenticated users"""
    repo = SupplierRepository(db)
    supplier = await repo.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.post("/", response_model=SupplierOut)
async def create_supplier(db: DBSessionDep, data: SupplierCreate, user = Depends(get_current_user)):
    """Create supplier - accessible to all authenticated users"""
    supplier = Supplier(**data.model_dump())
    return await SupplierRepository(db).create(supplier)


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(supplier_id: int, db: DBSessionDep, data: SupplierUpdate, user = Depends(get_current_user)):
    """Update supplier - accessible to all authenticated users"""
    repo = SupplierRepository(db)
    supplier = await repo.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    return await repo.update(supplier)


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Delete supplier - Admin only"""
    repo = SupplierRepository(db)
    supplier = await repo.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await repo.delete(supplier)
    return {"ok": True}


@router.get("/{supplier_id}/documents", response_model=list[dict])
async def list_supplier_documents(supplier_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """List all documents for a supplier - accessible to all authenticated users"""
    supplier = await SupplierRepository(db).get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    docs = await SupplierDocumentRepository(db).list_by_supplier(supplier_id)
    # Convert file paths to relative URLs
    uploads_dir = get_uploads_dir()
    suppliers_dir = os.path.join(uploads_dir, 'suppliers')
    
    # Get supplier name for directory
    supplier_name = sanitize_filename(supplier.name)
    supplier_specific_dir = os.path.join(suppliers_dir, supplier_name)
    # Also keep ID-based directory for backward compatibility
    supplier_id_dir = os.path.join(suppliers_dir, str(supplier_id))
    
    result = []
    
    print(f"[INFO] Found {len(docs)} documents in database for supplier {supplier_id}")
    
    for doc in docs:
        original_path = doc.file_path
        actual_file_path = None
        
        # Strategy 1: Check if file exists at stored path (absolute)
        if os.path.exists(doc.file_path):
            actual_file_path = doc.file_path
            print(f"[DEBUG] Document {doc.id}: Found at stored path: {doc.file_path}")
        
        # Strategy 2: If not found, try to resolve relative paths
        elif not os.path.isabs(doc.file_path):
            filename = os.path.basename(doc.file_path)
            # Try multiple possible locations, including supplier name-based directory
            possible_paths = [
                os.path.join(uploads_dir, doc.file_path.lstrip('./')),
                os.path.join(supplier_specific_dir, filename),  # New: supplier name-based dir
                os.path.join(supplier_id_dir, filename),  # ID-based dir (backward compatibility)
                os.path.join(suppliers_dir, filename),  # Old location (backward compatibility)
                os.path.join(suppliers_dir, str(supplier_id), filename),  # Explicit supplier ID dir
                os.path.join(uploads_dir, 'suppliers', filename),
                os.path.join(uploads_dir, 'suppliers', str(supplier_id), filename),
                os.path.join(uploads_dir, 'suppliers', supplier_name, filename),
            ]
            
            for possible_path in possible_paths:
                if os.path.exists(possible_path):
                    actual_file_path = possible_path
                    print(f"[DEBUG] Document {doc.id}: Found at alternative path: {possible_path}")
                    # Update the database record with correct path
                    try:
                        doc.file_path = actual_file_path
                        await SupplierDocumentRepository(db).update(doc)
                        print(f"[DEBUG] Updated document {doc.id} path in database")
                    except Exception as e:
                        print(f"[WARNING] Could not update document path in DB: {e}")
                    break
        
        # Strategy 3: If still not found, check if filename exists in supplier directories
        if not actual_file_path:
            filename = os.path.basename(doc.file_path)
            # First check supplier name-based directory
            possible_path = os.path.join(supplier_specific_dir, filename)
            if os.path.exists(possible_path):
                actual_file_path = possible_path
                print(f"[DEBUG] Document {doc.id}: Found by filename in supplier name dir: {possible_path}")
                # Update the database record
                try:
                    doc.file_path = actual_file_path
                    await SupplierDocumentRepository(db).update(doc)
                    print(f"[DEBUG] Updated document {doc.id} path in database")
                except Exception as e:
                    print(f"[WARNING] Could not update document path in DB: {e}")
            # Check ID-based directory (old format)
            elif os.path.exists(os.path.join(supplier_id_dir, filename)):
                possible_path = os.path.join(supplier_id_dir, filename)
                actual_file_path = possible_path
                print(f"[DEBUG] Document {doc.id}: Found by filename in supplier ID dir: {possible_path}")
                # Move to supplier name-based directory and update DB
                try:
                    new_path = os.path.join(supplier_specific_dir, filename)
                    os.makedirs(supplier_specific_dir, exist_ok=True)
                    shutil.move(possible_path, new_path)
                    doc.file_path = new_path
                    await SupplierDocumentRepository(db).update(doc)
                    actual_file_path = new_path
                    print(f"[DEBUG] Moved and updated document {doc.id} to supplier name-based directory")
                except Exception as e:
                    print(f"[WARNING] Could not move/update document: {e}")
            # Fallback to old suppliers directory
            elif os.path.exists(os.path.join(suppliers_dir, filename)):
                possible_path = os.path.join(suppliers_dir, filename)
                actual_file_path = possible_path
                print(f"[DEBUG] Document {doc.id}: Found by filename in old suppliers dir: {possible_path}")
                # Move to supplier name-based directory and update DB
                try:
                    new_path = os.path.join(supplier_specific_dir, filename)
                    os.makedirs(supplier_specific_dir, exist_ok=True)
                    shutil.move(possible_path, new_path)
                    doc.file_path = new_path
                    await SupplierDocumentRepository(db).update(doc)
                    actual_file_path = new_path
                    print(f"[DEBUG] Moved and updated document {doc.id} to supplier name-based directory")
                except Exception as e:
                    print(f"[WARNING] Could not move/update document: {e}")
        
        # If file still not found, skip this document (don't show it)
        if not actual_file_path:
            print(f"[WARNING] Document {doc.id}: File not found at any location, skipping.")
            print(f"[WARNING] Original path in DB: {original_path}")
            print(f"[WARNING] Uploads dir: {uploads_dir}")
            print(f"[WARNING] Suppliers dir: {suppliers_dir}")
            # Skip this document - don't add it to the result
            continue
        
        # Verify file actually exists before adding to result
        if not os.path.exists(actual_file_path):
            print(f"[WARNING] Document {doc.id}: File path found but file doesn't exist: {actual_file_path}, skipping.")
            continue
        
        # Final verification: make absolutely sure file exists
        if not os.path.isfile(actual_file_path):
            print(f"[WARNING] Document {doc.id}: Path exists but is not a file: {actual_file_path}, skipping.")
            continue
        
        # Get relative path from uploads directory
        try:
            if os.path.isabs(actual_file_path):
                rel_path = os.path.relpath(actual_file_path, uploads_dir).replace('\\', '/')
            else:
                rel_path = actual_file_path.replace('\\', '/').lstrip('./')
            
            # Ensure it starts with suppliers/ if it's a supplier document
            if not rel_path.startswith('suppliers/'):
                # Extract filename and prepend suppliers/{supplier_name}/
                filename = os.path.basename(actual_file_path)
                rel_path = f"suppliers/{supplier_name}/{filename}"
            # If it's in old suppliers/ location (with ID or without subdirectory), update to supplier name-based
            elif rel_path.startswith('suppliers/') and not rel_path.startswith(f'suppliers/{supplier_name}/'):
                # Check if it's in ID-based directory
                if rel_path.startswith(f'suppliers/{supplier_id}/'):
                    # Replace ID with supplier name
                    filename = os.path.basename(actual_file_path)
                    rel_path = f"suppliers/{supplier_name}/{filename}"
                elif not '/' in rel_path.replace('suppliers/', ''):
                    # It's directly in suppliers/ without subdirectory
                    filename = os.path.basename(actual_file_path)
                    rel_path = f"suppliers/{supplier_name}/{filename}"
        except ValueError:
            # If paths are on different drives or can't be related, use filename
            filename = os.path.basename(actual_file_path)
            rel_path = f"suppliers/{supplier_name}/{filename}"
        
        # Verify the final path would be accessible
        final_full_path = os.path.join(uploads_dir, rel_path.replace('/', os.sep))
        if not os.path.isfile(final_full_path):
            print(f"[WARNING] Document {doc.id}: Final path does not exist: {final_full_path}, skipping.")
            continue
        
        result.append({
            "id": doc.id,
            "supplier_id": doc.supplier_id,
            "transaction_id": doc.transaction_id,
            "file_path": f"/uploads/{rel_path}",
            "description": doc.description,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })
        print(f"[INFO] Document {doc.id} added to result list: {rel_path}")
    
    print(f"[INFO] Returning {len(result)} documents (filtered from {len(docs)} total)")
    return result


@router.post("/{supplier_id}/documents", response_model=dict)
async def upload_supplier_document(
    supplier_id: int, 
    db: DBSessionDep, 
    file: UploadFile = File(...),
    description: str | None = Form(None),
    user = Depends(get_current_user)
):
    """Upload supplier document - accessible to all authenticated users"""
    supplier = await SupplierRepository(db).get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    uploads_dir = get_uploads_dir()
    suppliers_dir = os.path.join(uploads_dir, 'suppliers')
    # Create directory for this specific supplier using supplier name
    supplier_name = sanitize_filename(supplier.name)
    supplier_specific_dir = os.path.join(suppliers_dir, supplier_name)
    os.makedirs(supplier_specific_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename or "")[1]
    path = os.path.join(supplier_specific_dir, f"{uuid4().hex}{ext}")
    
    # Log for debugging
    print(f"[DEBUG] Uploading supplier document to: {path}")
    print(f"[DEBUG] Uploads dir: {uploads_dir}")
    print(f"[DEBUG] Suppliers dir exists: {os.path.exists(suppliers_dir)}")
    
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)
    
    # Verify file was saved
    if os.path.exists(path):
        print(f"[DEBUG] File saved successfully: {path}")
    else:
        print(f"[ERROR] File was not saved: {path}")
    doc = SupplierDocument(
        supplier_id=supplier_id, 
        file_path=path,
        description=description.strip() if description and description.strip() else None
    )
    await SupplierDocumentRepository(db).create(doc)
    # Return relative path for frontend
    rel_path = os.path.relpath(path, uploads_dir).replace('\\', '/')
    return {"file_path": f"/uploads/{rel_path}", "id": doc.id}
