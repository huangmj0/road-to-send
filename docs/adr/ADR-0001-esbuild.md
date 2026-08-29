# ADR-0001: Build the artifact with esbuild

Status: accepted

The committed root `index.html` remains the deployed single-file artifact. Its browser code is
bundled and minified with pinned `esbuild`; the embedded Apps Script is interpolated after that
step so its template-literal contract remains intact. `esbuild` is a pinned dev dependency and CI
uses `npm ci`, so a failed install blocks a new deploy while Pages continues serving the last good
artifact.
