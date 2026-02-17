# Chrome Extension UI Redesign

**Datum:** 2026-02-17
**Status:** Approved
**Ersatter:** UI/UX-sektionen i `2026-02-15-chrome-extension-design.md`

## Bakgrund

Forsta versionen av widgeten fungerar men ar for liten och kanns inte integrerad med YouTube. Den tar bara en brakdel av sidopanelen och erbjuder ingen visuell feedback.

Marknadsanalys visar att ledande extensions (Glasp 500K+, YTScribe 550K+, Eightify) alla anvander hoger sidebar med tabbar, auto-scrollande transkript, och YouTube-native styling. De hogst rankade (4.9/5) har dessutom dark mode-stod och sok i transkriptet.

## Designbeslut

| Beslut | Val |
|--------|-----|
| Primara features | Summary + Chat + Save transcript |
| Placering | Hoger sidebar, ersatter rekommendationer |
| Auto-load | Nej -- vantar pa klick per tab |
| Visuell stil | YouTube-native, dark mode-stod |
| Minimize/stang | Tre lagen, sparar preferens |

## Layout

Widgeten **ersatter hela `#secondary`-panelen** (rekommenderade videor). Rekommendationerna doljs nar widgeten ar oppen och visas igen vid minimering/stangning.

### Tre lagen

**1. Oppen (default vid forsta besok):**
```
+---------------------------------+
| Transcript Tool        [-] [x] |  Header med minimize/stang
|---------------------------------|
| [Transcript] [Summary] [Chat]  |  Tabbar
|---------------------------------|
|                                 |
|  (Tab-innehall, scrollbart)     |  Fullt utrymme (~400px bred)
|                                 |
|---------------------------------|
| [Copy]  [Save to library]      |  Action-bar, alltid synlig
+---------------------------------+
```

**2. Minimerad (klick pa [-]):**
```
+---------------------------------+
| > Transcript Tool               |
+---------------------------------+

  Rekommenderade videor visas
  som vanligt nedanfor
```

**3. Stangd (klick pa [x]):**
Widgeten forsvinner helt. YouTube ser ut som vanligt. Oppnas via extension-ikonen i verktygsfalt.

### Minneshantering
- Oppen/minimerad/stangd sparas i `chrome.storage.local`
- Om minimerad pa forra videon -- minimerad pa nasta
- Om stangd -- stangd tills oppnad via extension-ikon
- Aktivt tab-val (Transcript/Summary/Chat) sparas mellan videor

## Tab 1: Transcript

Transkriptet hamtas forst nar anvandaren klickar pa Transcript-tabben.

```
|---------------------------------|
| [Transcript*] [Summary] [Chat] |
|---------------------------------|
| Search transcript...            |  Sokfalt
|---------------------------------|
| | 0:00  Welcome to today's     |  Aktiv rad (highlightad)
|   0:15  video about how we      |
|   0:32  can use AI agents to    |
|   0:45  automate our workflow   |
|   1:02  Let me show you the     |
|   1:18  first example here...   |
|   ...                           |  Scrollbar, auto-scroll
|                                 |  foljer videon
|---------------------------------|
| [Copy]  [Save to library]      |
+---------------------------------+
```

### Beteende
- **Auto-scroll:** Transkriptet scrollar automatiskt. Aktiv rad markeras med bla vansterborder + ljusbla bakgrund.
- **Klick = seek:** Klicka pa en rad -- videon hoppar till den tidpunkten.
- **Sok:** Filtrerar/highlightar matchande rader. Enter hoppar mellan traffar.
- **Copy:** Kopierar hela markdown-transkriptet till clipboard.
- **Save:** Sparar till biblioteket (kraver inloggning).
- Rader har generos klick-yta (padding) och tydlig hover-effekt.
- Timestamps i monospace, text i vanlig font.

## Tab 2: Summary

AI-sammanfattning genereras on-demand nar anvandaren klickar.

### Initial vy (fore klick):
```
|---------------------------------|
|                                 |
|      +-------------------+      |
|      |  Summarize        |      |  Tydlig CTA-knapp
|      +-------------------+      |
|                                 |
|   AI generates key takeaways    |
|   and a concise summary         |
|                                 |
+---------------------------------+
```

### Under generering:
```
|---------------------------------|
|  ...  Generating summary...     |  Animerad loader
|                                 |
|  ░░░░░░░░░░░░░░░░░░░░          |  Skeleton-text
|  ░░░░░░░░░░░░░░                 |
|  ░░░░░░░░░░░░░░░░░░░            |
+---------------------------------+
```

### Fardig sammanfattning:
```
|---------------------------------|
|                                 |
|  ## Key Takeaways               |
|  * AI agents can automate 80%   |
|    of repetitive coding tasks   |
|  * The key is clear prompts     |
|    and iterative refinement     |
|  * Claude Code handles multi-   |
|    file refactoring well        |
|                                 |
|  ## Summary                     |
|  This video demonstrates how    |
|  AI coding agents can transform |
|  developer workflows by...      |
|                                 |
|---------------------------------|
| [Copy]  [Save to library]      |
+---------------------------------+
```

### Beteende
- Sammanfattningen **cachas lokalt** (`chrome.storage.local`) per video-ID.
- Renderas som formaterad markdown (rubriker, bullet points, fetstil).
- Scrollbar om innehallet ar langt.
- Copy kopierar sammanfattningen som text.

## Tab 3: Chat

Chat kraver inloggning. Icke-inloggade ser en mjuk uppmaning.

### Ej inloggad:
```
|---------------------------------|
|                                 |
|   Chat with this video          |
|                                 |
|   Ask questions, get answers    |
|   based on the video content    |
|                                 |
|   +---------------------+      |
|   |  Sign in to start   |      |  Oppnar popup
|   +---------------------+      |
|                                 |
+---------------------------------+
```

### Inloggad, aktiv chatt:
```
|---------------------------------|
|                                 |
|  +-------------------------+    |
|  | What are the 3 main     | Du |  Hoger-justerat
|  | tools mentioned?        |    |
|  +-------------------------+    |
|                                 |
|  +-------------------------+    |
|  | The video mentions:     | AI |  Vanster-justerat
|  | 1. Claude Code          |    |
|  | 2. Cursor               |    |
|  | 3. GitHub Copilot       |    |
|  +-------------------------+    |
|                                 |
|---------------------------------|
| [Ask a question...        ] [>] |  Input + skicka
+---------------------------------+
```

### Beteende
- Meddelande-bubblor: rundade, subtila farger.
- Dina meddelanden: hoger, ljusbla bakgrund.
- AI-svar: vanster, gra bakgrund, renderas som markdown.
- "Thinking..." animation medan AI svarar.
- Chat-historik per video under sessionen (rensas vid ny video).
- Input: `Enter` for att skicka, `Shift+Enter` for ny rad.
- Foreslagna fragor visas initialt:
  - "Summarize the key points"
  - "What are the action items?"
  - "Explain the main argument"

## Dark Mode

Widgeten arver YouTubes tema automatiskt.

### Detektion
YouTube satter `dark` attribut pa `<html>`. Vi detekterar detta med en MutationObserver pa dokumentet och applicerar en `.dark` class pa widget-host-elementet.

### CSS Custom Properties

```css
:host {
  --bg-primary: #ffffff;
  --bg-secondary: #f2f2f2;
  --bg-hover: #f2f2f2;
  --text-primary: #0f0f0f;
  --text-secondary: #606060;
  --border: #e5e5e5;
  --accent: #065fd4;
  --accent-light: #def1ff;
}

:host(.dark) {
  --bg-primary: #0f0f0f;
  --bg-secondary: #272727;
  --bg-hover: #272727;
  --text-primary: #f1f1f1;
  --text-secondary: #aaaaaa;
  --border: #3f3f3f;
  --accent: #3ea6ff;
  --accent-light: #263850;
}
```

### Typografi och spacing
- Font: `Roboto, Arial, sans-serif` (matchar YouTube)
- Border-radius: `12px` pa widgeten (som YT-kort), `8px` pa knappar
- Inga emojis -- ikoner via inline SVG eller Unicode-symboler

## Theater Mode

YouTube doljer `#secondary` i theater mode. Widgeten forsvinner naturligt eftersom den ar inuti `#secondary`. Inget speciellt behover hanteras.

## Navigering mellan videor

YouTube ar en SPA. Vi lyssnar pa `yt-navigate-finish` och `wxt:locationchange`.

Vid ny video:
- Widgeten behaller sitt lage (oppen/minimerad/stangd)
- Tab-val behalles
- Content rensas (nytt video-ID)
- Cachad sammanfattning laddas om den finns
- Chat-historik rensas (ny video = nytt samtal)
- Transkript hamtas inte automatiskt (vantar pa klick)

## Implementation Notes

### Shadow DOM
Widgeten renderas i en Shadow DOM for att isolera CSS fran YouTube. WXT:s `createShadowRootUi` anvands. Viktigt: undvik `rem`-enheter inuti shadow root -- anvand `px` eller CSS custom properties.

### Sidebar-overtag
For att ersatta rekommendationerna:
1. Injicera widgeten som forsta barn i `#secondary`
2. Dolj ovriga barn i `#secondary` med `display: none` nar widgeten ar oppen
3. Visa dem igen vid minimering/stangning

### Storlek
- Bredd: arver `#secondary` (~400px)
- Hojd: `calc(100vh - 80px)` (viewport minus YouTube-header)
- Content-area: scrollbar, fyller tillgangligt utrymme
- Action-bar: fast langst ner (sticky)
