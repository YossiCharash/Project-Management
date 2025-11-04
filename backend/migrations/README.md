# Database Migrations

## Add transaction_id to supplier_documents

העמודה `transaction_id` נוספה למודל `SupplierDocument` אבל לא קיימת עדיין בבסיס הנתונים.

### אפשרות 1: הרצת סקריפט Python (מומלץ)

```bash
cd backend
python migrations/add_transaction_id.py
```

### אפשרות 2: הרצת SQL ישירות

```bash
# באמצעות psql
psql -U your_username -d your_database -f backend/migrations/add_transaction_id_to_supplier_documents.sql
```

### אפשרות 3: הרצת SQL ידנית

הרץ את ה-SQL הבא דרך כלי ניהול בסיס הנתונים שלך (pgAdmin, DBeaver, וכו'):

```sql
ALTER TABLE supplier_documents 
ADD COLUMN IF NOT EXISTS transaction_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS ix_supplier_documents_transaction_id ON supplier_documents(transaction_id);

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_documents_transaction_id_fkey'
    ) THEN
        ALTER TABLE supplier_documents 
        ADD CONSTRAINT supplier_documents_transaction_id_fkey 
        FOREIGN KEY (transaction_id) REFERENCES transactions(id);
    END IF;
END $$;
```

---

## Add supplier_id to transactions

העמודה `supplier_id` נוספה למודל `Transaction` אבל לא קיימת עדיין בבסיס הנתונים.

### אפשרות 1: הרצת סקריפט Python (מומלץ)

```bash
cd backend
python migrations/add_transaction_id.py
```

### אפשרות 2: הרצת SQL ישירות

```bash
# באמצעות psql
psql -U your_username -d your_database -f backend/migrations/add_transaction_id_to_supplier_documents.sql
```

### אפשרות 3: הרצת SQL ידנית

הרץ את ה-SQL הבא דרך כלי ניהול בסיס הנתונים שלך (pgAdmin, DBeaver, וכו'):

```sql
ALTER TABLE supplier_documents 
ADD COLUMN IF NOT EXISTS transaction_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS ix_supplier_documents_transaction_id ON supplier_documents(transaction_id);

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_documents_transaction_id_fkey'
    ) THEN
        ALTER TABLE supplier_documents 
        ADD CONSTRAINT supplier_documents_transaction_id_fkey 
        FOREIGN KEY (transaction_id) REFERENCES transactions(id);
    END IF;
END $$;
```

