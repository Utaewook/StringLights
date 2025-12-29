import logging
import os
from logging.handlers import TimedRotatingFileHandler

def setup_logger(name: str):
    """
    Sets up a logger with TimedRotatingFileHandler.
    Logs are saved to LOG_DIR/{name}/{name}.log
    Rotates every midnight, keeping 7 days of history.
    """
    log_dir_root = os.environ.get("LOG_DIR", "./logs")
    
    # Ensure specific log directory exists (e.g., logs/backend)
    # Actually, in docker-compose we bind ./logs/backend:/logs for backend service
    # So inside container, LOG_DIR should be /logs.
    # We will log to /logs/backend.log to keep it simple inside the container mount point.
    
    # But wait, user requested: "파일 명이나 로그 모듈 분리, 형식 같은거도 보기 좋게"
    # And "하루단위로 로테이션"
    
    log_file_path = os.path.join(log_dir_root, f"{name}.log")
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Check if handler already exists to avoid duplicate logs
    if logger.handlers:
        return logger
        
    # Formatter
    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console Handler (stdout) - good for Docker logs
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File Handler (Rotating)
    # Rotate at midnight
    file_handler = TimedRotatingFileHandler(
        log_file_path,
        when="midnight",
        interval=1,
        backupCount=7,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger
