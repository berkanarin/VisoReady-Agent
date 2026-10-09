# Demo Verification

Capture date: 9 October 2026. Source: live Google Maps, signed-out Chromium, English interface, 1440 x 900 viewport.

## Completed

- Seven real source screenshots inspected for map rendering, English controls, private-account information and retained Google attribution.
- Seven editable project screens imported into the actual VisoReady editor without changing screenshot bytes or annotation coordinates.
- Offline HTML player checked at 1440 x 900 and 390 x 900.
- All 14 expected annotation states visited, including the six next-screen links at both sizes. Zero automated quality errors.
- Full-map framing retained; no camera zoom or circular annotation markers.
- Caption heading update: all seven English headings verified at both viewport sizes (14/14). Original image bytes, annotation bounds, camera settings and navigation links compared against the previous project and preserved. The recipe, manifest, editable project and offline HTML use the same revised copy.
- Agent validation: lint, typecheck, build, 17 unit tests and 4 browser integration tests passed.

## Known Limitations

The automated quality result remains **needs-review**, with 14 warnings: seven small mobile targets and seven downscaled mobile screenshots. This is a desktop-first walkthrough, not a separate mobile Google Maps tutorial. The player's Next control offers an alternative to tapping small targets.

The source map retains normal Google Maps tooltips and original street/business names. English UI does not translate every local proper name.

The captures demonstrate the actual three-place route and detailed directions. Sharing is explained but not executed; no route was sent to another person or saved to an account. This demo does not demonstrate dragging to reorder stops.

No OCR, live travel-data guarantee or blanket third-party redistribution clearance is claimed. The automated audit does not fully test completion/restart or every back-navigation permutation. See ATTRIBUTION.md before publication.

This folder accompanies the public 0.1.0 beta repository. Earlier local release ZIPs predate this demo; regenerate a release bundle from the current source to include it.
