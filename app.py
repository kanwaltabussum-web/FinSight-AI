
import streamlit as st
import pandas as pd

st.set_page_config(
    page_title="FinSight AI",
    page_icon="💰",
    layout="wide"
)

st.title("💰 FinSight AI")
st.subheader("From Financial Data to Intelligent Risk Detection")

st.write(
    "Upload your financial transaction data to identify unusual patterns "
    "and generate explainable risk insights."
)

uploaded_file = st.file_uploader(
    "Upload your financial data",
    type=["csv", "xlsx"]
)

if uploaded_file is not None:
    try:
        if uploaded_file.name.lower().endswith(".csv"):
            df = pd.read_csv(uploaded_file)
        else:
            df = pd.read_excel(uploaded_file)

        st.success("File uploaded successfully!")

        st.write("### 📊 Uploaded Financial Data")
        st.dataframe(df, use_container_width=True)

        # Check for an amount column
        amount_col = next(
            (col for col in df.columns
             if str(col).strip().lower() in
             ["amount", "transaction amount", "total amount"]),
            None
        )
        amount_col = next(
            (col for col in df.columns
             if str(col).strip().lower() in
             ["amount", "transaction amount", "total amount"]),
            None
        )

        # Duplicate invoice detection
        if "invoice_id" in df.columns:

            duplicate_invoices = df[
                df.duplicated(
                    subset=["invoice_id"],
                    keep=False
                )
            ]

            st.write("### 🔁 Duplicate Invoice Check")

            if len(duplicate_invoices) > 0:
                st.warning(
                    f"{duplicate_invoices['invoice_id'].nunique()} "
                    "duplicate invoice pattern(s) detected."
                )

                st.dataframe(
                    duplicate_invoices,
                    use_container_width=True
                )
            else:
                st.success(
                    "No duplicate invoice patterns detected."
                )
        if amount_col is None:
            st.warning(
                "No amount column found. Please include a column "
                "named 'amount' or 'transaction amount' to "
                "calculate financial metrics and risk signals."
            )
        else:
            # Convert transaction amounts to numeric values
            df[amount_col] = pd.to_numeric(
                df[amount_col].astype(str).str.replace(",", ""),
                errors="coerce"
            )

            # Remove rows with missing or invalid amounts
            df = df.dropna(subset=[amount_col]).copy()

            if df.empty:
                st.warning("No valid transaction amounts found.")
            else:
                # Financial metrics
                total_transactions = len(df)
                total_amount = df[amount_col].sum()
                average_transaction = df[amount_col].mean()

                st.write("### 💹 Financial Overview")

                col1, col2, col3 = st.columns(3)

                with col1:
                    st.metric(
                        "Total Transactions",
                        f"{total_transactions:,}"
                    )

                with col2:
                    st.metric(
                        "Total Transaction Value",
                        f"{total_amount:,.2f}"
                    )

                with col3:
                    st.metric(
                        "Average Transaction",
                        f"{average_transaction:,.2f}"
                    )

                # Unusual amount detection
                average_amount = df[amount_col].mean()
                unusual_threshold = average_amount * 3

                df["risk_signal"] = (
                    df[amount_col] > unusual_threshold
                )

                st.write("### 🔎 Risk Signals")

                flagged_df = df[df["risk_signal"] == True]

                if len(flagged_df) > 0:
                    st.warning(
                        f"{len(flagged_df)} transaction(s) "
                        "show an unusual amount pattern."
                    )

                    st.write("#### ⚠️ Flagged Transactions")
                    st.dataframe(
                        flagged_df,
                        use_container_width=True
                    )
                else:
                    st.success(
                        "No unusually high transactions detected "
                        "using the current threshold."
                    )

                # Download analyzed data
                csv_data = df.to_csv(index=False).encode("utf-8")

                st.download_button(
                    label="📥 Download Analyzed Data",
                    data=csv_data,
                    file_name="finsight_ai_analysis.csv",
                    mime="text/csv"
                )

                st.caption(
                    "Note: This is a basic anomaly screening rule "
                    "based on transaction amounts, not a confirmed "
                    "fraud detection system."
                )

    except Exception as e:
        st.error(f"Error processing file: {e}")