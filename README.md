# RP Vespera Next.js migration

This is a direct Next.js rewrite of the uploaded Angular app.

## What is included

- Preserved public routes so existing links stay valid:
  - `/interments`
  - `/interments/[documentNo]`
  - `/intermentsReviewLink/[documentNo]`
  - `/intermentsUploadInterredPhotoLink_ForPost/[documentNo]`
  - `/slideshow/[documentNo]`
  - `/photolinkupload/[documentNo]`
- Preserved admin routes:
  - `/allReviews`
  - `/lapidaDashboard`
  - `/isReviewedEmail`
- Shared public assets copied from the Angular project.
- API integration kept against `https://api.rp-vespera.cloud/api` by default.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Notes

- The Angular app shipped with Windows-installed `node_modules`, so the original project was not portable here.
- This rewrite keeps the same backend endpoints and route paths to minimize backend and email-link changes.
- The slideshow page includes file processing, AI orientation checks, manual crop/rotate flow, batch upload, and border application.
- The Lapida upload page includes crop + validate before upload, matching the Angular behavior.

## Main differences from Angular

- Standalone Angular components were rewritten as React client components.
- Angular services were replaced with `fetch`-based service modules.
- Angular routing was replaced with App Router pages while preserving URLs.
- The UI styling was simplified into a lightweight CSS system instead of Angular/Tailwind utility markup.
