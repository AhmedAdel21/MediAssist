import json
import logging
import sys
from pathlib import Path


class _PrettyFormatter(logging.Formatter):
    LEVEL_COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.LEVEL_COLORS.get(record.levelname, "")
        ts = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        level = f"{color}{record.levelname:<8}{self.RESET}"
        name = record.name
        msg = record.getMessage()
        line = f"{ts} | {level} | {name} | {msg}"
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, val in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            }:
                payload[key] = val
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    if root.handlers:
        root.handlers.clear()

    # Console: INFO and above only
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(_PrettyFormatter())

    # File: full DEBUG for troubleshooting
    file_handler = logging.FileHandler(logs_dir / "app.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(_JsonFormatter())

    root.addHandler(console)
    root.addHandler(file_handler)

    # Silence noisy third-party loggers on console
    for noisy in (
        "uvicorn.access",
        "chromadb",
        "httpx",
        "httpcore",
        "sqlalchemy.engine",
        "sqlalchemy.pool",
        "aiosqlite",
        "passlib",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
