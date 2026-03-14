
import uuid
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String) # 'Auto' or 'Manual'
    path_dir = Column(String, nullable=False)
    meta_info = Column(JSONB, default={}) # Dynamic axes, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("Model", back_populates="datasets")
    tensors = relationship("Tensor", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="dataset")


class Tensor(Base):
    __tablename__ = "tensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name = Column(String, nullable=False) # e.g. input_1
    filename = Column(String, nullable=False) # e.g. input_1.npy
    shape = Column(ARRAY(Integer))
    dtype = Column(String)
    size_bytes = Column(BigInteger)
    statistics = Column(JSONB, default={})

    # Relationships
    dataset = relationship("Dataset", back_populates="tensors")
