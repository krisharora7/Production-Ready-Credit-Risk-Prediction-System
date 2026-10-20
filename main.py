from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal
import pandas as pd
import joblib
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles

ml_model = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model['model'] = joblib.load('credit_risk_model.pkl')
    ml_model['threshold'] = joblib.load('best_threshold.pkl')

    yield

    ml_model.clear()


app = FastAPI(lifespan=lifespan)



class LoanApplication(BaseModel):
    person_age: int = Field(ge=18, le=100)
    person_income: float
    person_home_ownership: Literal['RENT', 'OWN', 'MORTGAGE', 'OTHER']
    person_emp_length: float
    loan_intent: Literal['PERSONAL', 'EDUCATION', 'MEDICAL', 'VENTURE', 'HOMEIMPROVEMENT',
       'DEBTCONSOLIDATION']
    loan_grade: Literal['D', 'B', 'C', 'A', 'E', 'F', 'G']
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: Literal['Y', 'N']
    cb_person_cred_hist_length: int


@app.post('/predict')

@app.post('/predict')
def predict(data: LoanApplication):
    data_df = pd.DataFrame([data.model_dump()])

    probability = float(
        ml_model['model'].predict_proba(data_df)[0, 1]
    )

    threshold = float(ml_model['threshold'])

    prediction = int(probability >= threshold)

    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "result": "High Risk" if prediction == 1 else "Low Risk"
    }


app.mount("/", StaticFiles(directory="static", html=True), name="static")