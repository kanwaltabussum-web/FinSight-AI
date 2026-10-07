from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import pandas as pd
import io
import math


app = FastAPI(
    title="FinSight AI API",
    description="Financial intelligence and risk signal detection API",
    version="1.0.0"
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# COLUMN NORMALIZATION
# ==========================================

def normalize_column_name(column):
    return (
        str(column)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def find_column(df, possible_names):
    normalized_columns = {
        normalize_column_name(col): col
        for col in df.columns
    }

    for name in possible_names:
        normalized_name = normalize_column_name(name)

        if normalized_name in normalized_columns:
            return normalized_columns[normalized_name]

    return None


# ==========================================
# SAFE VALUE
# ==========================================

def safe_value(value, default="Not available"):
    if value is None:
        return default

    try:
        if pd.isna(value):
            return default
    except Exception:
        pass

    return str(value)


# ==========================================
# ANALYZE FINANCIAL FILE
# ==========================================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    data_type: str = Form("bank_statement")
):

    contents = await file.read()

    try:

        # ==========================================
        # VALID RECORD TYPES
        # ==========================================

        allowed_types = {
            "bank_statement": "Bank Statement",
            "general_ledger": "General Ledger (GL)",
            "cash_book": "Cash Book"
        }

        if data_type not in allowed_types:
            data_type = "bank_statement"

        record_type = allowed_types[data_type]


        # ==========================================
        # READ FILE
        # ==========================================

        filename = file.filename or ""

        if filename.lower().endswith(".csv"):

            df = pd.read_csv(
                io.BytesIO(contents)
            )

        elif filename.lower().endswith(
            (".xlsx", ".xls")
        ):

            df = pd.read_excel(
                io.BytesIO(contents)
            )

        else:

            return {
                "success": False,
                "error": "Only CSV and Excel files are supported."
            }


        # ==========================================
        # BASIC VALIDATION
        # ==========================================

        if df.empty:

            return {
                "success": False,
                "error": "The uploaded file contains no records."
            }


        # ==========================================
        # CLEAN COLUMN NAMES
        # ==========================================

        df.columns = [
            str(col).strip()
            for col in df.columns
        ]


        # ==========================================
        # AUTOMATIC COLUMN MAPPING
        # ==========================================

        column_mapping = {

            "date": find_column(
                df,
                [
                    "date",
                    "transaction_date",
                    "transaction date",
                    "txn_date",
                    "txn date",
                    "posting_date",
                    "posting date",
                    "value_date",
                    "value date"
                ]
            ),

            "transaction_id": find_column(
                df,
                [
                    "transaction_id",
                    "transaction id",
                    "txn_id",
                    "txn id",
                    "transaction_no",
                    "transaction no",
                    "reference",
                    "reference_no",
                    "reference no"
                ]
            ),

            "amount": find_column(
                df,
                [
                    "amount",
                    "transaction_amount",
                    "transaction amount",
                    "total_amount",
                    "total amount",
                    "value",
                    "transaction_value"
                ]
            ),

            "debit": find_column(
                df,
                [
                    "debit",
                    "debit_amount",
                    "debit amount",
                    "dr",
                    "withdrawal",
                    "withdrawals"
                ]
            ),

            "credit": find_column(
                df,
                [
                    "credit",
                    "credit_amount",
                    "credit amount",
                    "cr",
                    "deposit",
                    "deposits"
                ]
            ),

            "description": find_column(
                df,
                [
                    "description",
                    "transaction_description",
                    "transaction description",
                    "details",
                    "narration",
                    "particulars",
                    "remarks",
                    "memo"
                ]
            ),

            "invoice_id": find_column(
                df,
                [
                    "invoice_id",
                    "invoice id",
                    "invoice",
                    "invoice_no",
                    "invoice no",
                    "invoice_number",
                    "invoice number"
                ]
            ),

            "supplier_id": find_column(
                df,
                [
                    "supplier_id",
                    "supplier id",
                    "supplier",
                    "vendor_id",
                    "vendor id",
                    "vendor"
                ]
            ),

            "category": find_column(
                df,
                [
                    "category",
                    "account_category",
                    "account category",
                    "expense_category",
                    "expense category",
                    "type"
                ]
            ),

            "payment_method": find_column(
                df,
                [
                    "payment_method",
                    "payment method",
                    "payment_type",
                    "payment type",
                    "method"
                ]
            )
        }


        # ==========================================
        # FIND AMOUNT COLUMNS
        # ==========================================

        amount_col = column_mapping["amount"]
        debit_col = column_mapping["debit"]
        credit_col = column_mapping["credit"]


        # ==========================================
        # CREATE STANDARD AMOUNT
        # ==========================================

        if amount_col is None:

            if debit_col is not None or credit_col is not None:

                debit_values = pd.Series(
                    0,
                    index=df.index,
                    dtype=float
                )

                credit_values = pd.Series(
                    0,
                    index=df.index,
                    dtype=float
                )

                if debit_col is not None:

                    debit_values = pd.to_numeric(
                        df[debit_col]
                        .astype(str)
                        .str.replace(
                            ",",
                            "",
                            regex=False
                        ),
                        errors="coerce"
                    ).fillna(0)

                if credit_col is not None:

                    credit_values = pd.to_numeric(
                        df[credit_col]
                        .astype(str)
                        .str.replace(
                            ",",
                            "",
                            regex=False
                        ),
                        errors="coerce"
                    ).fillna(0)

                df["_standard_amount"] = (
                    debit_values.abs()
                    + credit_values.abs()
                )

                amount_col = "_standard_amount"


        # ==========================================
        # TRANSACTION COUNT
        # ==========================================

        transaction_count = len(df)

        total_amount = 0.0
        average_amount = 0.0

        anomaly_count = 0
        anomalies = []


        # ==========================================
        # AMOUNT ANALYSIS
        # ==========================================

        valid_amounts = pd.Series(
            dtype=float
        )

        if amount_col is not None:

            df[amount_col] = pd.to_numeric(
                df[amount_col]
                .astype(str)
                .str.replace(
                    ",",
                    "",
                    regex=False
                ),
                errors="coerce"
            )

            valid_amounts = df[
                amount_col
            ].dropna()

            if len(valid_amounts) > 0:

                total_amount = float(
                    valid_amounts.sum()
                )

                average_amount = float(
                    valid_amounts.mean()
                )


        # ==========================================
        # DUPLICATE INVOICE DETECTION
        # ==========================================

        duplicate_count = 0
        duplicate_invoice_ids = []

        invoice_col = column_mapping["invoice_id"]

        if invoice_col is not None:

            invoice_values = (
                df[invoice_col]
                .dropna()
                .astype(str)
                .str.strip()
            )

            duplicate_mask = invoice_values.duplicated(
                keep=False
            )

            duplicate_values = invoice_values[
                duplicate_mask
            ]

            duplicate_invoice_ids = list(
                duplicate_values.unique()
            )

            duplicate_count = len(
                duplicate_invoice_ids
            )


        # ==========================================
        # ANOMALY DETECTION
        # ==========================================

        threshold = None

        anomaly_indexes = set()

        if len(valid_amounts) > 1:

            mean_amount = float(
                valid_amounts.mean()
            )

            std_amount = float(
                valid_amounts.std()
            )

            if (
                pd.notna(std_amount)
                and std_amount > 0
            ):

                threshold = (
                    mean_amount
                    +
                    (2 * std_amount)
                )

                anomaly_rows = df[
                    df[amount_col] > threshold
                ]

                anomaly_count = len(
                    anomaly_rows
                )

                anomaly_indexes = set(
                    anomaly_rows.index.tolist()
                )


                # ==========================================
                # PROCESS ANOMALIES
                # ==========================================

                for index, row in anomaly_rows.iterrows():

                    transaction_col = (
                        column_mapping["transaction_id"]
                    )

                    transaction_id = (
                        row.get(
                            transaction_col,
                            "Unknown"
                        )
                        if transaction_col
                        else f"TX-{index + 1}"
                    )

                    amount = float(
                        row[amount_col]
                    )


                    invoice_id = (
                        row.get(
                            invoice_col,
                            "Not available"
                        )
                        if invoice_col
                        else "Not available"
                    )


                    supplier_col = (
                        column_mapping["supplier_id"]
                    )

                    supplier_id = (
                        row.get(
                            supplier_col,
                            "Not available"
                        )
                        if supplier_col
                        else "Not available"
                    )


                    category_col = (
                        column_mapping["category"]
                    )

                    category = (
                        row.get(
                            category_col,
                            "Not available"
                        )
                        if category_col
                        else "Not available"
                    )


                    payment_col = (
                        column_mapping["payment_method"]
                    )

                    payment_method = (
                        row.get(
                            payment_col,
                            "Not available"
                        )
                        if payment_col
                        else "Not available"
                    )


                    date_col = (
                        column_mapping["date"]
                    )

                    transaction_date = (
                        row.get(
                            date_col,
                            "Not available"
                        )
                        if date_col
                        else "Not available"
                    )


                    description_col = (
                        column_mapping["description"]
                    )

                    description = (
                        row.get(
                            description_col,
                            "Not available"
                        )
                        if description_col
                        else "Not available"
                    )


                    # ==========================================
                    # RISK SCORE
                    # ==========================================

                    risk_score = 30

                    risk_reasons = [
                        "Unusual transaction amount"
                    ]


                    if (
                        invoice_id is not None
                        and str(invoice_id)
                        in duplicate_invoice_ids
                    ):

                        risk_score += 35

                        risk_reasons.append(
                            "Duplicate invoice pattern"
                        )


                    # ==========================================
                    # RISK LEVEL
                    # ==========================================

                    if risk_score >= 60:

                        risk_level = "High Review"

                    else:

                        risk_level = "Review"


                    # ==========================================
                    # EXPLANATION
                    # ==========================================

                    explanation = (
                        f"Transaction "
                        f"{safe_value(transaction_id)} "
                        f"has an unusual amount of "
                        f"{amount:,.2f}, above the "
                        f"detected threshold of "
                        f"{threshold:,.2f}. "
                        f"Invoice: "
                        f"{safe_value(invoice_id)}. "
                        f"Supplier: "
                        f"{safe_value(supplier_id)}. "
                        f"Category: "
                        f"{safe_value(category)}. "
                        f"Payment method: "
                        f"{safe_value(payment_method)}."
                    )


                    anomalies.append({

                        "row_index":
                            int(index),

                        "transaction_id":
                            safe_value(
                                transaction_id,
                                f"TX-{index + 1}"
                            ),

                        "date":
                            safe_value(
                                transaction_date
                            ),

                        "amount":
                            round(
                                amount,
                                2
                            ),

                        "threshold":
                            round(
                                threshold,
                                2
                            ),

                        "risk_score":
                            risk_score,

                        "risk_level":
                            risk_level,

                        "risk_reasons":
                            risk_reasons,

                        "invoice_id":
                            safe_value(
                                invoice_id
                            ),

                        "supplier_id":
                            safe_value(
                                supplier_id
                            ),

                        "category":
                            safe_value(
                                category
                            ),

                        "payment_method":
                            safe_value(
                                payment_method
                            ),

                        "description":
                            safe_value(
                                description
                            ),

                        "reason":
                            "Transaction amount is significantly higher than the observed pattern.",

                        "explanation":
                            explanation
                    })


        # ==========================================
        # TRANSACTION-LEVEL DATA
        # FOR PATTERN ANALYZER
        # ==========================================

        transactions = []

        for index, row in df.iterrows():

            transaction_col = (
                column_mapping["transaction_id"]
            )

            date_col = (
                column_mapping["date"]
            )

            description_col = (
                column_mapping["description"]
            )

            invoice_col = (
                column_mapping["invoice_id"]
            )

            supplier_col = (
                column_mapping["supplier_id"]
            )

            category_col = (
                column_mapping["category"]
            )

            payment_col = (
                column_mapping["payment_method"]
            )


            transaction_id = (
                row.get(transaction_col)
                if transaction_col
                else f"TX-{index + 1}"
            )

            transaction_date = (
                row.get(date_col)
                if date_col
                else None
            )

            description = (
                row.get(description_col)
                if description_col
                else None
            )

            invoice_id = (
                row.get(invoice_col)
                if invoice_col
                else None
            )

            supplier_id = (
                row.get(supplier_col)
                if supplier_col
                else None
            )

            category = (
                row.get(category_col)
                if category_col
                else None
            )

            payment_method = (
                row.get(payment_col)
                if payment_col
                else None
            )


            amount = None

            if amount_col is not None:

                raw_amount = row.get(
                    amount_col
                )

                if pd.notna(raw_amount):

                    try:
                        amount = float(
                            raw_amount
                        )
                    except Exception:
                        amount = None


            is_anomaly = (
                index in anomaly_indexes
            )


            matching_anomaly = next(
                (
                    item
                    for item in anomalies
                    if item["row_index"] == index
                ),
                None
            )


            if matching_anomaly:

                transaction_status = (
                    "High Risk"
                    if matching_anomaly[
                        "risk_level"
                    ] == "High Review"
                    else "Review"
                )

                risk_score = (
                    matching_anomaly[
                        "risk_score"
                    ]
                )

            else:

                transaction_status = "Normal"
                risk_score = 0


            transactions.append({

                "row_index":
                    int(index),

                "transaction_id":
                    safe_value(
                        transaction_id,
                        f"TX-{index + 1}"
                    ),

                "date":
                    safe_value(
                        transaction_date
                    ),

                "amount":
                    round(
                        amount,
                        2
                    )
                    if amount is not None
                    else None,

                "description":
                    safe_value(
                        description
                    ),

                "invoice_id":
                    safe_value(
                        invoice_id
                    ),

                "supplier_id":
                    safe_value(
                        supplier_id
                    ),

                "category":
                    safe_value(
                        category
                    ),

                "payment_method":
                    safe_value(
                        payment_method
                    ),

                "status":
                    transaction_status,

                "risk_score":
                    risk_score,

                "is_anomaly":
                    is_anomaly
            })


        # ==========================================
        # RISK COUNTS
        # ==========================================

        high_risk_count = sum(
            1
            for item in anomalies
            if item["risk_level"] == "High Review"
        )

        review_count = sum(
            1
            for item in anomalies
            if item["risk_level"] == "Review"
        )


        normal_count = max(
            transaction_count
            - high_risk_count
            - review_count,
            0
        )


        # ==========================================
        # OVERALL RISK
        # ==========================================

        if high_risk_count > 0:

            overall_risk = "HIGH RISK"

        elif review_count > 0:

            overall_risk = "REVIEW REQUIRED"

        else:

            overall_risk = "LOW RISK"


        # ==========================================
        # RISK SCORE
        # ==========================================

        if transaction_count > 0:

            risk_score = round(
                (
                    (
                        high_risk_count * 100
                    )
                    +
                    (
                        review_count * 60
                    )
                )
                / transaction_count,
                1
            )

        else:

            risk_score = 0


        # ==========================================
        # PATTERN SUMMARY
        # ==========================================

        pattern_summary = {

            "total_transactions":
                transaction_count,

            "normal_transactions":
                normal_count,

            "review_transactions":
                review_count,

            "high_risk_transactions":
                high_risk_count,

            "unusual_amount_transactions":
                anomaly_count,

            "duplicate_invoice_patterns":
                duplicate_count,

            "average_transaction_amount":
                round(
                    average_amount,
                    2
                ),

            "maximum_transaction_amount":
                round(
                    float(
                        valid_amounts.max()
                    ),
                    2
                )
                if len(valid_amounts) > 0
                else 0,

            "minimum_transaction_amount":
                round(
                    float(
                        valid_amounts.min()
                    ),
                    2
                )
                if len(valid_amounts) > 0
                else 0,

            "detected_threshold":
                round(
                    float(threshold),
                    2
                )
                if threshold is not None
                else None
        }


        # ==========================================
        # RESPONSE
        # ==========================================

        return {

            "success":
                True,

            "filename":
                file.filename,

            "data_type":
                data_type,

            "record_type":
                record_type,

            "transaction_count":
                transaction_count,

            "total_amount":
                round(
                    total_amount,
                    2
                ),

            "average_amount":
                round(
                    average_amount,
                    2
                ),

            "duplicate_invoice_patterns":
                duplicate_count,

            "anomaly_count":
                anomaly_count,

            "high_risk_count":
                high_risk_count,

            "review_count":
                review_count,

            "normal_count":
                normal_count,

            "overall_risk":
                overall_risk,

            "risk_score":
                risk_score,

            "column_mapping":
                column_mapping,

            "anomalies":
                anomalies,

            "transactions":
                transactions,

            "pattern_summary":
                pattern_summary

        }


    # ==========================================
    # ERROR HANDLING
    # ==========================================

    except Exception as e:

        return {

            "success":
                False,

            "error":
                str(e)

        }


# ==========================================
# SERVE FRONTEND
# ==========================================

FRONTEND_DIR = (
    Path(__file__).resolve().parent
    / "frontend"
)


app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_DIR,
        html=True
    ),
    name="frontend"
)