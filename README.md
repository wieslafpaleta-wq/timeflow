# ⏱ TimeFlow — Tracker Dnia (PWA)

Nowoczesna aplikacja Progressive Web App do śledzenia dnia w blokach czasowych z analizą produktywności.

---

## 🚀 Jak uruchomić — krok po kroku

### Metoda 1: Lokalny serwer HTTP (zalecana)

Service Worker **wymaga** serwera HTTP (nie działa z `file://`).

#### Opcja A — Python (najszybsza)
```bash
# Przejdź do folderu aplikacji
cd timeflow-pwa

# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```
Otwórz: **http://localhost:8080**

#### Opcja B — Node.js (npx)
```bash
cd timeflow-pwa
npx serve .
```
Otwórz: adres podany w terminalu (zwykle http://localhost:3000)

#### Opcja C — VS Code Live Server
1. Zainstaluj rozszerzenie **Live Server** (Ritwick Dey)
2. Kliknij prawym na `index.html` → **Open with Live Server**

#### Opcja D — PHP
```bash
cd timeflow-pwa
php -S localhost:8080
```

---

### Metoda 2: Deploy na hosting (produkcja)

Skopiuj cały folder na dowolny hosting statyczny:
- **GitHub Pages** — darmowy, HTTPS automatycznie
- **Netlify** — drag & drop folderu
- **Vercel** — `vercel deploy`
- **Firebase Hosting** — `firebase deploy`

> ⚠️ HTTPS jest wymagane dla Service Worker w produkcji!

---

## 📱 Instalacja na telefonie (Add to Home Screen)

### Android (Chrome):
1. Otwórz aplikację w Chrome
2. Kliknij przycisk **📲 Zainstaluj** w górnym pasku
   — lub —
   Menu (⋮) → **"Dodaj do ekranu głównego"**

### iOS (Safari):
1. Otwórz aplikację w Safari
2. Kliknij przycisk **Udostępnij** (kwadrat ze strzałką)
3. Wybierz **"Dodaj do ekranu głównego"**

---

## 📁 Struktura plików

```
timeflow-pwa/
├── index.html          # Główny HTML — cały markup aplikacji
├── style.css           # Wszystkie style, dark mode, animacje
├── app.js              # Logika aplikacji, State, Storage, UI
├── service-worker.js   # Cache offline, strategia fetch
├── manifest.json       # Metadane PWA (nazwa, ikony, display)
└── README.md           # Ta dokumentacja
```

---

## ✨ Funkcje

| Funkcja | Opis |
|--------|------|
| ➕ Dodawanie bloków | Godzina od/do + opis aktywności |
| 🤖 Auto-klasyfikacja | Automatyczna kategoria na podstawie słów kluczowych |
| 📋 Lista bloków | Przegląd z możliwością usuwania |
| 📅 Timeline | Kolorowa oś czasu całego dnia |
| 📊 Analiza | Procent produktywności, godziny per kategoria |
| 🌙 Dark Mode | Automatyczny + ręczny przełącznik |
| 💾 Offline | Działa bez internetu (Service Worker) |
| 📲 Instalacja | Add to Home Screen (PWA) |
| ✅ Walidacja | Sprawdzanie nakładania się bloków |
| 🔔 Toasty | Powiadomienia o akcjach |

---

## 🎨 Kategorie aktywności

| Kategoria | Kolor | Przykłady |
|-----------|-------|-----------|
| 🟢 Produktywne | Zielony | praca, nauka, trening, projekt |
| ⬜ Neutralne | Szary | jedzenie, odpoczynek, spacer |
| 🔴 Strata czasu | Czerwony | social media, Netflix, TikTok |

---

## 🛠 Technologie

- **HTML5** — semantyczny markup, WAI-ARIA dostępność
- **CSS3** — CSS Variables, Grid, Flexbox, animacje
- **Vanilla JS** — bez frameworków, ES6+
- **Service Worker** — cache-first strategia, offline support
- **Web App Manifest** — PWA standard
- **localStorage** — persystencja danych
- **Google Fonts** — Syne (display) + DM Sans (body)

---

## 📋 Wymagania przeglądarki

| Przeglądarka | Wersja |
|-------------|--------|
| Chrome / Edge | 80+ |
| Firefox | 79+ |
| Safari (iOS) | 14+ |
| Samsung Internet | 12+ |

---

## 🔧 Dostosowanie

### Dodaj własne słowa kluczowe (app.js):
```js
const KEYWORDS = {
  productive: ['twoje-słowo', 'inne-słowo', ...],
  wasteful: ['rozpraszacz', ...],
};
```

### Zmień kolory (style.css):
```css
:root {
  --accent-primary: #6c63ff;  /* główny kolor akcentu */
  --productive: #00c896;       /* kolor produktywności */
  --wasteful: #ff5a7e;         /* kolor straty czasu */
}
```

---

## 📄 Licencja

MIT — możesz dowolnie używać, modyfikować i dystrybuować.
