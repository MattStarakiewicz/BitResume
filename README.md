# BitResume

**EN** · [PL](#polski)

BitResume is a **CV / resume editor** that keeps **Polish and English** content in **one JSON template**. You can switch languages and visual themes, edit inline, save to disk, and export a **PDF** that matches the current layout and colors.

---

## Features

- **Bilingual template** — PL and EN versions live in a single structured JSON file; toolbar switch changes the active language for editing and preview.
- **Visual modes** — dark (web), mixed (light card with navy accents), and print-oriented light layout; PDF export respects the active mode.
- **Edit mode** — toggle to enable inline text editing, lists, drag-and-drop reordering (where supported), sections, profile photo (crop/upload), and related controls.
- **Save & load** — quick save to a configured location, “Save as” for file name and folder (desktop: native dialogs), load JSON from disk; **Electron** adds a **File** menu (open template, recent files, save shortcuts, print to PDF).
- **Desktop app** — packaged with **Electron** and **electron-builder** (Windows installer / portable); **web** workflow still available via Next.js.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router), React, TypeScript  
- [Tailwind CSS](https://tailwindcss.com/)  
- [Electron](https://www.electronjs.org/) (desktop shell)  
- [Lucide](https://lucide.dev/) icons  

## Getting started

### Web (development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Desktop (development)

```bash
npm install
npm run electron:dev
```

Runs Next.js on port 3000 and opens the Electron window against the dev server.

### Production build

| Command            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `npm run build`    | Next.js static export / production build     |
| `npm run electron:build` | Next build (Electron mode) + installer |
| `npm run electron:pack`  | Next build + unpacked app dir        |

## Project layout (high level)

- `src/app/` — main UI (`page.tsx`), global styles  
- `src/components/`, `src/lib/` — CV logic, persistence, migration helpers  
- `electron/` — main process, preload, bundled help HTML  
- `data/` — default template seed  

## License

This project is licensed under the **MIT License** — see [`LICENSE`](./LICENSE). Third-party notices: [`THIRD_PARTY_LICENSES.en.txt`](./THIRD_PARTY_LICENSES.en.txt) / [`THIRD_PARTY_LICENSES.pl.txt`](./THIRD_PARTY_LICENSES.pl.txt).

## Author

**Mateusz Starakiewicz**

---

## Polski

**PL** · [EN](#bitresume)

BitResume to **edytor CV**, w którym **polska i angielska** wersja treści znajduje się w **jednym szablonie JSON**. Możesz przełączać język i motyw kolorystyczny, edytować na żywo, zapisywać na dysku i wyeksportować **PDF** zgodny z bieżącym układem i kolorami.

### Możliwości

- **Szablon dwujęzyczny** — PL i EN w jednym pliku JSON; przełącznik na pasku ustawia aktywną wersję do edycji i podglądu.
- **Tryby widoku** — tryb ciemny (web), mieszany (jasna karta, granatowe akcenty) oraz jasny układ zbliżony do wydruku; eksport PDF uwzględnia aktywny motyw.
- **Tryb edycji** — włączenie edycji inline, list, przeciągania (tam gdzie jest dostępne), sekcji, zdjęcia profilowego (wgranie/kadrowanie) i powiązanych akcji.
- **Zapis i wczytanie** — szybki zapis w skonfigurowanej lokalizacji, „Zapisz jako” (nazwa pliku i folder; na desktopie: natywne okna), wczytanie JSON z dysku; w **Electron** menu **Plik** (otwarcie szablonu, ostatnie pliki, skróty zapisu, druk do PDF).
- **Aplikacja desktopowa** — pakiet **Electron** + **electron-builder** (instalator / wersja portable na Windows); nadal możesz uruchamiać wersję **web** przez Next.js.

### Stos technologiczny

- [Next.js](https://nextjs.org/) (App Router), React, TypeScript  
- [Tailwind CSS](https://tailwindcss.com/)  
- [Electron](https://www.electronjs.org/)  
- Ikony [Lucide](https://lucide.dev/)  

### Uruchomienie

#### Wersja web (development)

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

#### Wersja desktop (development)

```bash
npm install
npm run electron:dev
```

Uruchamia Next.js na porcie 3000 i okno Electron podpięte pod serwer deweloperski.

#### Build produkcyjny

| Polecenie              | Zastosowanie                          |
| ---------------------- | ------------------------------------- |
| `npm run build`        | Build Next.js (produkcja / eksport)   |
| `npm run electron:build` | Build pod Electron + instalator   |
| `npm run electron:pack`  | Build + katalog z aplikacją       |

### Układ repozytorium (skrót)

- `src/app/` — główny interfejs (`page.tsx`), style globalne  
- `src/components/`, `src/lib/` — logika CV, zapis, migracje szablonu  
- `electron/` — proces główny, preload, pliki pomocy  
- `data/` — domyślny szablon startowy  

### Licencja

Projekt na licencji **MIT** — plik [`LICENSE`](./LICENSE). Komponenty stron trzecich: [`THIRD_PARTY_LICENSES.pl.txt`](./THIRD_PARTY_LICENSES.pl.txt) / [`THIRD_PARTY_LICENSES.en.txt`](./THIRD_PARTY_LICENSES.en.txt).

### Autor

**Mateusz Starakiewicz**
