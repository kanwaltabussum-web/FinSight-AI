from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import pandas as pd
import io


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

            return normalized_columns[
                normalized_name
            ]

    return None


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

            "bank_statement":
                "Bank Statement",

            "general_ledger":
                "General Ledger (GL)",

            "cash_book":
                "Cash Book"

        }


        if data_type not in allowed_types:

            data_type = "bank_statement"


        record_type = allowed_types[
            data_type
        ]


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
                "error":
                    "Only CSV and Excel files are supported."
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
        # FIND AMOUNT
        # ==========================================

        amount_col = column_mapping[
            "amount"
        ]


        debit_col = column_mapping[
            "debit"
        ]


        credit_col = column_mapping[
            "credit"
        ]


        # ==========================================
        # CREATE STANDARD AMOUNT COLUMN
        # ==========================================

        if amount_col is None:

            if (
                debit_col is not None
                or credit_col is not None
            ):

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


        total_amount = 0

        average_amount = 0

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


        invoice_col = column_mapping[
            "invoice_id"
        ]


        if invoice_col is not None:

            duplicate_rows = df[
                df.duplicated(
                    subset=[invoice_col],
                    keep=False
                )
            ]


            duplicate_count = int(
                duplicate_rows[
                    invoice_col
                ].nunique()
            )


            duplicate_invoice_ids = [

                str(x)

                for x in duplicate_rows[
                    invoice_col
                ]
                .dropna()
                .unique()

            ]


        # ==========================================
        # ANOMALY DETECTION
        # ==========================================

        if len(valid_amounts) > 1:

            mean_amount = (
                valid_amounts.mean()
            )

            std_amount = (
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
                    df[amount_col]
                    > threshold
                ]


                anomaly_count = len(
                    anomaly_rows
                )


                # ==========================================
                # PROCESS ANOMALIES
                # ==========================================

                for _, row in anomaly_rows.iterrows():

                    transaction_col = (
                        column_mapping[
                            "transaction_id"
                        ]
                    )


                    transaction_id = (

                        row.get(
                            transaction_col,
                            "Unknown"
                        )

                        if transaction_col
                        else "Unknown"

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
                        column_mapping[
                            "supplier_id"
                        ]
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
                        column_mapping[
                            "category"
                        ]
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
                        column_mapping[
                            "payment_method"
                        ]
                    )


                    payment_method = (

                        row.get(
                            payment_col,
                            "Not available"
                        )

                        if payment_col
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

                        risk_level = (
                            "High Review"
                        )

                    else:

                        risk_level = (
                            "Review"
                        )


                    # ==========================================
                    # EXPLANATION
                    # ==========================================

                    explanation = (

                        f"Transaction "
                        f"{transaction_id} "
                        f"is unusual because its "
                        f"amount of "
                        f"{amount:,.2f} is above "
                        f"the detected threshold "
                        f"of {threshold:,.2f}. "
                        f"It is linked to invoice "
                        f"{invoice_id} from supplier "
                        f"{supplier_id}, categorized "
                        f"as {category}, and paid "
                        f"using {payment_method}."

                    )


                    # ==========================================
                    # ADD ANOMALY
                    # ==========================================

                    anomalies.append({

                        "transaction_id":
                            str(transaction_id),

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
                            str(invoice_id),

                        "supplier_id":
                            str(supplier_id),

                        "category":
                            str(category),

                        "payment_method":
                            str(payment_method),

                        "reason":
                            "Transaction amount is significantly higher than the observed pattern.",

                        "explanation":
                            explanation

                    })


        # ==========================================
        # OVERALL RISK SIGNALS
        # ==========================================

        high_risk_count = sum(

            1

            for item in anomalies

            if item["risk_level"]
            == "High Review"

        )


        review_count = sum(

            1

            for item in anomalies

            if item["risk_level"]
            == "Review"

        )


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

            "column_mapping":
                column_mapping,

            "anomalies":
                anomalies

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