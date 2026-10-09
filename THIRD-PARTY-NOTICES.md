# Third-Party Notices

The MIT license in this package applies to original VisoReady Agent code and the maintainer's original VisoReady editor code included in the release. It does not replace third-party licenses, grant rights to users' screenshots or imply endorsement by OpenAI, Anthropic or other vendors.

The lockfile is the dependency version inventory. Dependencies are downloaded by pnpm, not copied into the release folder. Their license/notice files remain in the installed packages. Chromium is downloaded separately by Playwright and retains its own third-party notices.

The Google Maps demo and the maintainer-supplied cover contain third-party Google Maps interface/map content. These portions are not relicensed under MIT. Keep visible attribution and review `demos/google-maps-walking-route/ATTRIBUTION.md` for reuse conditions. The cover is promotional artwork supplied by the maintainer, not evidence of an unmodified browser capture.

The bundled VisoReady.html embeds third-party code. Its existing Cropper.js (Chen Fengyuan, MIT), Lucide (ISC) and Feather-derived icon (Cole Bemis, MIT) notices must remain intact. Optional model/runtime downloads used by the editor retain their upstream terms and are not part of the Agent release payload.

Before publication review the license metadata and notices of the final locked dependencies and bundled editor. This notice is not a replacement for upstream license text and does not assert ownership of third-party content.
