from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db_name: str = "design_studio"

    imagekit_public_key: str = ""
    imagekit_private_key: str = ""
    imagekit_url_endpoint: str = ""

    auth_email: str = ""
    auth_password: str = ""
    jwt_secret: str = "change-me"

    ai_key: str = ""

    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
