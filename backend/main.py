from fastapi import FastAPI, UploadFile, File
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):

    contents = await file.read()

    try:

        # ================================
        # READ FILE
        # ================================

        if file.filename.lower().endswith(".csv"):

            df = pd.read_csv(io.BytesIO(contents))

        elif file.filename.lower().endswith(
            (".xlsx", ".xls")
        ):

            df = pd.read_excel(io.BytesIO(contents))

        else:

            return {
                "success": False,
                "error": "Only CSV and Excel files are supported."
            }


        # ================================
        # FIND AMOUNT COLUMN
        # ================================

        amount_col = next(
            (
                col for col in df.columns
                if str(col).strip().lower()
                in [
                    "amount",
                    "transaction amount",
                    "total amount"
                ]
            ),
            None
        )


        transaction_count = len(df)

        total_amount = 0
        average_amount = 0

        anomaly_count = 0
        anomalies = []


        # ================================
        # AMOUNT ANALYSIS
        # ================================

        valid_amounts = pd.Series(dtype=float)

        if amount_col is not None:

            df[amount_col] = pd.to_numeric(
                df[amount_col]
                .astype(str)
                .str.replace(",", ""),
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


        # ================================
        # DUPLICATE INVOICE DETECTION
        # ================================

        duplicate_count = 0

        duplicate_invoice_ids = []


        if "invoice_id" in df.columns:

            duplicate_rows = df[
                df.duplicated(
                    subset=["invoice_id"],
                    keep=False
                )
            ]


            duplicate_count = int(
                duplicate_rows["invoice_id"].nunique()
            )


            duplicate_invoice_ids = [
                str(x)
                for x in duplicate_rows["invoice_id"]
                .dropna()
                .unique()
            ]


        # ================================
        # ANOMALY DETECTION
        # ================================

        if len(valid_amounts) > 1:

            mean_amount = valid_amounts.mean()
            std_amount = valid_amounts.std()


            if pd.notna(std_amount) and std_amount > 0:

                threshold = (
                    mean_amount +
                    (2 * std_amount)
                )


                anomaly_rows = df[
                    df[amount_col] > threshold
                ]


                anomaly_count = len(
                    anomaly_rows
                )


                for _, row in anomaly_rows.iterrows():

                    transaction_id = row.get(
                        "transaction_id",
                        "Unknown"
                    )

                    amount = float(
                        row[amount_col]
                    )


                    # ================================
                    # CONNECTED RECORDS
                    # ================================

                    invoice_id = row.get(
                        "invoice_id",
                        "Not available"
                    )

                    supplier_id = row.get(
                        "supplier_id",
                        "Not available"
                    )

                    category = row.get(
                        "category",
                        "Not available"
                    )

                    payment_method = row.get(
                        "payment_method",
                        "Not available"
                    )


                    # ================================
                    # RISK SCORE
                    # ================================

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


                    # ================================
                    # RISK LEVEL
                    # ================================

                    if risk_score >= 60:

                        risk_level = "High Review"

                    elif risk_score >= 30:

                        risk_level = "Review"

                    else:

                        risk_level = "Normal"


                    # ================================
                    # AI-STYLE EXPLANATION
                    # ================================

                    explanation = (
                        f"Transaction {transaction_id} is unusual "
                        f"because its amount of {amount:,.2f} is above "
                        f"the detected threshold of {threshold:,.2f}. "
                        f"It is linked to invoice {invoice_id} "
                        f"from supplier {supplier_id}, categorized "
                        f"as {category}, and paid using "
                        f"{payment_method}."
                    )


                    # ================================
                    # ANOMALY RESULT
                    # ================================

                    anomalies.append({

                        "transaction_id":
                            str(transaction_id),

                        "amount":
                            round(amount, 2),

                        "threshold":
                            round(threshold, 2),

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


        # ================================
        # OVERALL RISK SIGNALS
        # ================================

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


        # ================================
        # RESPONSE
        # ================================

        return {

            "success": True,

            "filename":
                file.filename,

            "transaction_count":
                transaction_count,

            "total_amount":
                round(total_amount, 2),

            "average_amount":
                round(average_amount, 2),

            "duplicate_invoice_patterns":
                duplicate_count,

            "anomaly_count":
                anomaly_count,

            "high_risk_count":
                high_risk_count,

            "review_count":
                review_count,

            "anomalies":
                anomalies

        }


    except Exception as e:

        return {

            "success": False,

            "error":
                str(e)

        }


# ================================
# SERVE FRONTEND
# ================================

FRONTEND_DIR = Path(__file__).resolve().parent.parent

app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_DIR,
        html=True
    ),
    name="frontend"
)