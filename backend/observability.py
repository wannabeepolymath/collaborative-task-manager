"""Bounded request metrics, redacted JSON logs, and optional OTLP traces."""
import json
import logging
import os
import time
from fastapi import Request, Response
from prometheus_client import Counter, Histogram, CONTENT_TYPE_LATEST, generate_latest
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

REQUESTS = Counter("teamtasks_http_requests_total", "HTTP requests", ["method", "route", "status"])
LATENCY = Histogram("teamtasks_http_request_duration_seconds", "HTTP duration", ["method", "route"])
logger = logging.getLogger("teamtasks.requests")


def configure_observability(app):
    @app.get("/metrics", include_in_schema=False)
    def metrics():
        return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})

    @app.middleware("http")
    async def observe(request: Request, call_next):
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            # Route templates avoid user IDs, query strings and unbounded labels.
            route = getattr(request.scope.get("route"), "path", "unmatched")
            if route not in ("/metrics", "/api/health", "/api/ready"):
                elapsed = time.perf_counter() - started
                method = request.method if request.method in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"} else "OTHER"
                REQUESTS.labels(method, route, str(status)).inc()
                LATENCY.labels(method, route).observe(elapsed)
                ctx = trace.get_current_span().get_span_context()
                logger.info(json.dumps({"event": "http_request", "method": method, "route": route,
                                        "status": status, "duration_ms": round(elapsed * 1000, 2),
                                        "trace_id": format(ctx.trace_id, "032x"),
                                        "version": os.environ.get("APP_VERSION", "dev")}))

    if os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        provider = TracerProvider(resource=Resource.create({
            "service.name": "teamtasks-api", "service.version": os.environ.get("APP_VERSION", "dev")
        }))
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app, excluded_urls="health,ready,metrics")
        return provider
