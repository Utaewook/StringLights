import os
import numpy as np
import warnings

def analyze_numpy_file(file_path: str):
    """
    Analyzes a numpy file (.npy) and returns detailed metadata.
    
    Returns:
        dict: {
            "shape": list,
            "dtype": str,
            "min": float,
            "max": float,
            "mean": float,
            "std": float,
            "has_nan": bool,
            "has_inf": bool,
            "size_bytes": int
        }
    """
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # Memory map to avoid loading large files entirely into RAM if possible,
        # but for stats we usually need to read.
        # mode='r' allows reading.
        data = np.load(file_path, mmap_mode='r')
        
        stats = {
            "shape": list(data.shape),
            "dtype": str(data.dtype),
            "size_bytes": os.path.getsize(file_path),
            "ndim": data.ndim
        }
        
        # Calculate stats if numeric and not empty
        if data.size > 0 and np.issubdtype(data.dtype, np.number):
            # We might want to limit this for huge files, 
            # but for now let's assume reasonable size or take a sample for huge ones.
            # If size > 100MB, maybe sample? Let's just do full for accuracy as requested.
            
            # Use safe casting or handling
            try:
                # To compute stats, we might need full load if mmap is slow over network,
                # but local disk is fine.
                stats["min"] = float(np.min(data))
                stats["max"] = float(np.max(data))
                stats["mean"] = float(np.mean(data))
                stats["std"] = float(np.std(data))
                stats["has_nan"] = bool(np.isnan(data).any())
                stats["has_inf"] = bool(np.isinf(data).any())
            except Exception as e:
                # e.g. overflow or other numpy issues
                print(f"Stats calculation warning: {e}")
                stats["error_stats"] = str(e)
        
        return stats
        
    except Exception as e:
        return {"error": str(e)}
