# assets/

Static assets for the College Examination System.

- `images/` — static imagery. Student profile photos are stored directly in
  IndexedDB (students store, `photo` field as data-URL), so no binary files
  are required here for the prototype.
- `icons/` — the interface renders icons from inline SVG (see `js/navigation.js`,
  the `ICONS` map). Add static SVG files here if you customise the theme.
- `uploads/` — uploaded examination routines (PDF / images) are stored as
  **Blob objects inside the IndexedDB object store `examinationRoutines`**
  (fields `fileBlob`, `fileName`, `fileType`). This folder is only a
  conventional placeholder; browser sandboxing prevents direct disk writes.
