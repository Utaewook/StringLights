import logging
import os
from logging.handlers import TimedRotatingFileHandler

def setup_logger(name: str):
    """
    Sets up a logger with TimedRotatingFileHandler.
    Logs are saved to LOG_DIR/{name}.log
    """
    log_dir_root = os.environ.get("LOG_DIR", "./logs")
    
    log_file_path = os.path.join(log_dir_root, f"{name}.log")
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if logger.handlers:
        return logger
        
    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
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
