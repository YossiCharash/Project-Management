import boto3
from botocore.config import Config
from backend.core.config import settings
from uuid import uuid4
from typing import BinaryIO


class S3Service:
    def __init__(self) -> None:
        # Basic validation so שנדע מיד אם חסר קונפיגורציה
        if not settings.AWS_S3_BUCKET:
            raise ValueError(
                "AWS_S3_BUCKET is not configured. Please set AWS_S3_BUCKET in your environment/.env file."
            )

        session = boto3.session.Session(
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        self._s3 = session.client(
            "s3",
            config=Config(s3={"addressing_style": "virtual"}),
        )
        self._bucket = settings.AWS_S3_BUCKET
        self._base_url = settings.AWS_S3_BASE_URL.rstrip("/") if settings.AWS_S3_BASE_URL else None

    def _build_key(self, prefix: str, filename: str) -> str:
        filename = filename or ""
        ext = ""
        if "." in filename:
            ext = "." + filename.split(".")[-1]
        return f"{prefix.rstrip('/')}/{uuid4().hex}{ext}"

    def upload_file(self, *, prefix: str, file_obj: BinaryIO, filename: str | None = None, content_type: str | None = None) -> str:
        key = self._build_key(prefix, filename or "")
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        self._s3.upload_fileobj(
            Fileobj=file_obj,
            Bucket=self._bucket,
            Key=key,
            ExtraArgs=extra_args or None,
        )

        if self._base_url:
            return f"{self._base_url}/{key}"
        # Default S3 URL
        return f"https://{self._bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


