# Data Analysis

Analyze CSV, JSON, and tabular data using Python and pandas.

## Setup

```bash
pip install pandas
```

## Reading Data

```python
import pandas as pd
df = pd.read_csv("data.csv")
df = pd.read_json("data.json")
df = pd.read_csv("https://example.com/data.csv")
```

## Quick Exploration

```python
print(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")
print(f"Columns: {list(df.columns)}")
print(df.dtypes)
print(df.head())
print(df.describe())
print(df.isnull().sum())
```

## Filtering and Aggregation

```python
# Filter rows
active = df[df["status"] == "active"]

# Group and aggregate
summary = df.groupby("category").agg(
    count=("id", "count"),
    total=("amount", "sum"),
    average=("amount", "mean"),
).round(2)

# Top N
top10 = df.nlargest(10, "revenue")[["name", "revenue"]]
```

## Data Cleaning

```python
df = df.drop_duplicates(subset=["email"])
df["score"] = df["score"].fillna(df["score"].median())
df["date"] = pd.to_datetime(df["date"])
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["name"] = df["name"].str.strip().str.title()
```

## Generating Markdown Reports

```python
report = f"""# Report
- **Records**: {len(df):,}
- **Date range**: {df['date'].min()} to {df['date'].max()}
- **Total revenue**: ${df['revenue'].sum():,.2f}

## By Category
{summary.to_markdown()}
"""
with open("report.md", "w") as f:
    f.write(report)
```

## One-liner Bash Workflow

```bash
python3 -c "
import pandas as pd
df = pd.read_csv('sales.csv')
print(f'Rows: {len(df)}')
print(f'Revenue: \${df[\"amount\"].sum():,.2f}')
print(df.groupby('region')['amount'].agg(['count','sum','mean']).round(2))
"
```

## Exporting

```python
df.to_csv("output.csv", index=False)
df.to_json("output.json", orient="records", indent=2)
print(df.to_markdown(index=False))
```

## Tips
- Use `df.value_counts("column")` for frequency distributions
- Use `pd.cut()` to bin continuous variables into categories
- For large files, use `chunksize` parameter in `read_csv`
- Use `df.info()` to see memory usage and dtypes at a glance
- Write final reports as markdown for readable output
