# ADR-0002: Expose flat browser state for tests

Status: accepted

The browser keeps its mutable values on one flat `globalThis.state` object. The bundled artifact
keeps implementation helpers in its closure; tests may mutate state properties through the source
seam. Grouping state by guessed ownership is deferred until the application has deliberate module
boundaries.
