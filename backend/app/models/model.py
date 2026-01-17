
import uuid
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Model(Base):
    __tablename__ = "models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    path_files = Column(String, nullable=False) # Directory path
    filesize_bytes = Column(BigInteger)
    ir_version = Column(Integer)
    opset_version = Column(Integer)
    graph_name = Column(String)
    meta_info = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    datasets = relationship("Dataset", back_populates="model", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="model", cascade="all, delete-orphan")
