import uuid
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from database import Base

class RunStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class ModelORM(Base):
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
    datasets = relationship("DatasetORM", back_populates="model", cascade="all, delete-orphan")
    runs = relationship("RunORM", back_populates="model", cascade="all, delete-orphan")


class DatasetORM(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String) # 'Auto' or 'Manual'
    path_dir = Column(String, nullable=False)
    meta_info = Column(JSONB, default={}) # Dynamic axes, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelORM", back_populates="datasets")
    tensors = relationship("TensorORM", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("RunORM", back_populates="dataset")


class TensorORM(Base):
    __tablename__ = "tensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name = Column(String, nullable=False) # e.g. input_1
    filename = Column(String, nullable=False) # e.g. input_1.npy
    shape = Column(ARRAY(Integer))
    dtype = Column(String)
    size_bytes = Column(BigInteger)

    # Relationships
    dataset = relationship("DatasetORM", back_populates="tensors")


class RunORM(Base):
    __tablename__ = "runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=False)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    status = Column(String, default=RunStatus.PENDING.value)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True))
    output_path = Column(String) # Result directory
    error_log = Column(Text)
    metrics = Column(JSONB, default={})

    # Relationships
    model = relationship("ModelORM", back_populates="runs")
    dataset = relationship("DatasetORM", back_populates="runs")
