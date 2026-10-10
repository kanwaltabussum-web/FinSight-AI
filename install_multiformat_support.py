from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
MAIN = BACKEND / "main.py"
REQUIREMENTS = BACKEND / "requirements.txt"
ROUTE = BACKEND / "document_routes.py"

if not MAIN.exists():
    print(f"ERROR: Cannot find {MAIN}. Extract this package into the FinSight-AI project root.")
    sys.exit(1)
if not ROUTE.exists():
    print(f"ERROR: Missing {ROUTE}. Extract the full ZIP and preserve folder structure.")
    sys.exit(1)

text = MAIN.read_text(encoding="utf-8")
original = text
backup = BACKEND / "main.py.before_multiformat_support.bak"
if not backup.exists():
    shutil.copy2(MAIN, backup)

# Add the fourth financial record type to the existing allowed_types dictionary.
if '"other_financial_data"' not in text:
    cash_line = re.compile(r'(?m)^(?P<indent>[ \t]*)"cash_book"[ \t]*:[ \t]*"Cash Book(?: \(.*?\))?"[ \t]*,?[ \t]*$')
    match = cash_line.search(text)
    if not match:
        print('ERROR: Could not safely locate the Cash Book line inside allowed_types.')
        print('No backend/main.py changes have been saved. Please share your current backend/main.py.')
        sys.exit(2)
    indent = match.group("indent")
    replacement = f'{indent}"cash_book": "Cash Book",\n{indent}"other_financial_data": "Other Financial Transactions"'
    text = text[:match.start()] + replacement + text[match.end():]

# Import and register document-inspection + feedback routes exactly once.
if "document_routes" not in text and "document_router" not in text:
    import_block = (
        "try:\n"
        "    from .document_routes import router as document_router\n"
        "except ImportError:\n"
        "    from document_routes import router as document_router\n\n"
    )
    app_decl = re.search(r'(?m)^app\s*=\s*FastAPI\(', text)
    if not app_decl:
        print('ERROR: Could not find app = FastAPI(...). No backend/main.py changes have been saved.')
        sys.exit(3)
    text = text[:app_decl.start()] + import_block + text[app_decl.start():]

if "app.include_router(document_router)" not in text:
    middleware = re.search(r'(?m)^\s*app\.add_middleware\(', text)
    if middleware:
        text = text[:middleware.start()] + "app.include_router(document_router)\n\n" + text[middleware.start():]
    else:
        # Place router registration before the frontend static mount.
        mount = re.search(r'(?m)^\s*app\.mount\(', text)
        if not mount:
            print('ERROR: Could not find app.add_middleware or app.mount to register document router safely.')
            sys.exit(4)
        text = text[:mount.start()] + "app.include_router(document_router)\n\n" + text[mount.start():]

if text != original:
    MAIN.write_text(text, encoding="utf-8")
    print("Updated backend/main.py. Existing /analyze logic was preserved; router + Other Financial Transactions were added.")
else:
    print("backend/main.py already has document routes and Other Financial Transactions; no changes were needed.")
print(f"Backup: {backup}")

# Add reader packages without overwriting existing requirements.
if REQUIREMENTS.exists():
    req_text = REQUIREMENTS.read_text(encoding="utf-8")
else:
    req_text = "fastapi[standard]\nuvicorn\npandas\nopenpyxl\npython-multipart\n"
base_required = ["fastapi[standard]", "uvicorn", "pandas", "openpyxl", "python-multipart"]
extra = ["xlrd>=2.0.1", "pypdf>=4.2.0", "python-docx>=1.1.0", "python-pptx>=0.6.23"]
lines = [line.strip() for line in req_text.splitlines() if line.strip() and not line.strip().startswith("#")]
lower_lines = [line.lower() for line in lines]
added = []
for package in extra:
    package_name = package.split(">=")[0].lower()
    if not any(line.lower().split("=")[0].split(">")[0].strip() == package_name for line in lines):
        lines.append(package)
        added.append(package)
REQUIREMENTS.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("Updated backend/requirements.txt.")
if added:
    print("Added: " + ", ".join(added))
else:
    print("Document/Excel reader dependencies were already present.")
print("NEXT: redeploy/restart the FastAPI backend after installing backend/requirements.txt.")
