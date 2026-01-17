
# String Lights Architecture

## Overview
String Lights is designed with a modular architecture to support scalability and maintainability.
The project is split into a **Frontend (React/Vite)** and a **Backend (FastAPI/PostgreSQL)**.

## Directory Structure & Modules

### Backend
The backend follows a layered architecture, separating API routes, data models, and business logic.

### Backend
The backend follows a **Layered Architecture** within the `app/` directory, promoting separation of concerns and testability.

- **`main.py`**: Entry point that delegates to `app.main`.
- **`app/main.py`**: Application factory, middleware setup, and router inclusion.
- **`app/core/`**: Core configuration and utilities.
  - `config.py`: Environment configuration via Pydantic Settings.
- **`app/api/`**: API Routers (Controllers).
  - `v1/endpoints/`: Route handlers grouped by resource (e.g., `models.py`, `datasets.py`).
- **`app/services/`**: Business Logic Layer. Contains core logic and calls Repositories.
  - `model_service.py`, `dataset_service.py`
- **`app/repositories/`**: Data Access Layer. Abstracts DB interactions.
  - `base.py`: Generic CRUD operations.
  - `model_repo.py`, `dataset_repo.py`
- **`app/models/`**: SQLAlchemy ORM Models (Database Entities).
  - `model.py`, `dataset.py`, `run.py`
- **`app/schemas/`**: Pydantic Models (Data Transfer Objects).
  - `model.py`, `dataset.py`
- **`app/db/`**: Database connection and session management.
- **`app/utils/`**: Helper modules (e.g., ONNX parsing, Logging).

### Frontend
The frontend is organized using a **Feature-based Folder Structure**, grouping related components and logic together.

- **`features/`**: Modules representing distinct user features.
  - **`model-explorer/`**: Everything related to the Model Tree Explorer.
    - `ModelExplorer.jsx`: Main tree container.
    - `TreeItem.jsx`: Recursive tree node component.
  - **`inspector/`**: Components for the right-hand details panel.
    - `NodeInspector.jsx`: Displays properties of Models, Datasets, and Tensors.
  - **`input-management/`**: Logic for adding input inputs.
    - `InputManager.jsx`, `InputActionModal.jsx`: Forms and logic for generating/uploading inputs.
- **`components/`**: Shared presentation components.
  - **`layout/`**: Structural components (Header, Sidebar, MainWorkspace, Layout).
  - **`common/`**: Reusable generic components (Buttons, ErrorPage, CookieConsent, GraphCanvas).
- **`store/`**: Global state management using Zustand.
  - `modelStore.js`: Domain state (Models, Datasets, Selection).
  - `uiStore.js`: UI state (Sidebar toggles, Theme).
- **`api/`**: API client and endpoints definitions.

## Key Design Principles
1.  **Separation of Concerns**: Logic is separated from presentation (Frontend) and Routes are separated from Business Logic (Backend).
2.  **Modularity**: Features are self-contained where possible (`features/` dir), making it easier to add new features without affecting others.
3.  **Recursive Component Design**: The Tree View uses a recursive `TreeItem` to handle arbitrary depth consistently.
4.  **State Management**: Complex global state is managed via Stores, avoiding Prop Drilling.
