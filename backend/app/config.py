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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
