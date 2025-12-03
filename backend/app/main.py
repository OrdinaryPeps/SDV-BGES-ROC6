from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.logging import logger
from .routers import auth, users, tickets, stats, webhook, notifications, performance, export

app = FastAPI(title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json")

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(tickets.router, prefix=f"{settings.API_V1_STR}/tickets", tags=["tickets"])
app.include_router(stats.router, prefix=f"{settings.API_V1_STR}/statistics", tags=["stats"])
app.include_router(performance.router, prefix=f"{settings.API_V1_STR}/performance", tags=["performance"])
app.include_router(export.router, prefix=f"{settings.API_V1_STR}/export", tags=["export"])
app.include_router(webhook.router, prefix=f"{settings.API_V1_STR}/webhook", tags=["webhook"])


app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])

@app.get("/")
async def root():
    return {"message": "Welcome to BotSDV Backend API"}
