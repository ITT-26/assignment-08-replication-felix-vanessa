[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sPpq67Dc)

A replication of the interaction technique introduced in:

> Jens Grubert, Eyal Ofek, Michel Pahud, Matthias Kranz, and Dieter
> Schmalstieg. 2016. **GlassHands: Interaction Around Unmodified Mobile
> Devices Using Sunglasses.** In *Proceedings of the 2016 ACM International
> Conference on Interactive Surfaces and Spaces (ISS '16)*. ACM.
> https://dl.acm.org/doi/abs/10.1145/2992154.2992162

Our documentation on how we found the interaction technique we wanted to copy is in [`Research_doc.md`](./Research_doc.md)

## Getting Started

```powershell
cd frontend
npm install   # only needed the first time
npm run dev
```

`npm run dev` serves the app over **HTTPS** and prints a **Network** URL
(e.g. `https://x.x.x.x:5173`). Enter that IP address in the browser on
your phone to open the app. HTTPS (via `vite-plugin-mkcert`) is required
for webcam access on mobile, since browsers only grant camera permissions
in a secure context.

## Opening the App on Your Phone

The dev server uses a **self-signed certificate**, so the browser can't
verify it and will show a security warning ("Your connection is not
private" / "This connection is not secure"). This is expected, you need to
tell the browser to proceed anyway:

- **iOS, Safari (recommended):** tap **Show Details** → **visit this
  website** → **Visit Website**. Safari handles the untrusted certificate
  and camera permissions most reliably on iOS.
- **Android — Chrome:** tap **Advanced** → **Proceed to `<ip>` (unsafe)**.

Make sure your phone and computer are on the **same Wi-Fi network**, then
grant the **camera permission** when prompted.

