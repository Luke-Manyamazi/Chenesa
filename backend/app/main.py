from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routers import auth, accounts, runs, scheduler, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Chenesa API starting up...")
    yield
    print("Chenesa API shutting down.")


app = FastAPI(title="Chenesa API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(accounts.router,  prefix="/accounts",  tags=["accounts"])
app.include_router(runs.router,      prefix="/runs",      tags=["runs"])
app.include_router(scheduler.router, prefix="/scheduler", tags=["scheduler"])
app.include_router(settings.router,  prefix="/settings",  tags=["settings"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "Chenesa API"}
