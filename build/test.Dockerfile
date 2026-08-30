# Test image for the backend.
#
# Built from the same base as build/backend.Dockerfile on purpose. The code under
# test spawns child processes and is bounded by the container's memory ceiling,
# and neither behaves on a developer's machine the way it behaves on
# python:3.12-slim under Linux. A green suite on the host would say very little
# about production; this says something.
#
# Build and run from the repository root:
#   docker build -f build/test.Dockerfile -t string_lights_backend_test .
#   docker run --rm --memory=350m --memory-swap=350m string_lights_backend_test
#
# The memory flags mirror the backend's limit in build/docker-compose.yml. Run
# without them and the OOM path this code exists to prevent is not exercised.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# The build context is expected to be the repository root
COPY apps/backend/requirements.txt apps/backend/requirements-dev.txt ./
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir -r requirements-dev.txt

COPY apps/backend/app/ ./app/
COPY apps/backend/tests/ ./tests/

CMD ["python", "-m", "pytest", "-v", "--tb=short"]
