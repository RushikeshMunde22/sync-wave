# SyncWave UX/UI Design Specification

This document details the interface architecture, design principles, ergonomics, visual styling, and accessibility standards implemented across **SyncWave**.

---

## 1. Core Design Philosophy

SyncWave is designed for immediate, friction-free shared listening. The interface embraces a **dark-first aesthetic**, **fluid ambient transitions**, and **evidence-based ergonomics**. Every design decision is rooted in cognitive psychology and proven human-computer interaction (HCI) principles.

---

## 2. Psychological & Ergonomic Principles

### Hick's Law: Minimizing Decision Latency
> *The time it takes to make a decision increases logarithmically with the number and complexity of choices.*

In social and audio applications, choice overload leads to hesitation and reduced engagement. SyncWave structures user flows to present **no more than two primary actions per screen view**:

- **Home Screen**:
  1. *Action A*: "Create a Room" (Primary CTA, high-contrast Indigo button).
  2. *Action B*: "Join Room" (Secondary CTA, input code with instant join).
- **Listening Room**:
  1. *Action A*: Central Play/Pause toggle (dominant visual anchor).
  2. *Action B*: Skip / Next Track (secondary control).
  - Secondary options (room settings, invite code copy, leave room) are neatly tucked into header utility icons or bottom sheets, preventing cognitive clutter during active music sessions.

### Jakob's Law: Leveraging Familiar Mental Models
> *Users spend most of their time on other sites. They prefer your site to work the same way as all the other sites they already know.*

SyncWave mirrors the established interaction patterns of dominant music platforms (Spotify, Apple Music, YouTube Music):
- **Bottom Navigation Bar**: A fixed 3-tab navigation bar (`Home`, `Discover`, `Profile`) pinned to the viewport bottom on mobile devices.
- **Player Hierarchy**: 
  - Centered album artwork square with subtle rounded corners (`rounded-2xl`).
  - Bold track title directly below artwork, followed by artist name in muted gray.
  - Scrub bar / progress timeline spanning the width of the card.
  - Playback transport controls directly underneath.
- Users instantly know how to play, seek, and browse without requiring onboarding tooltips or tutorials.

### Fitts's Law: Ergonomic Target Sizing
> *The time required to rapidly move to a target area is a function of the ratio between the distance to the target and the width of the target.*

On mobile devices, users operate the interface with one hand, primarily using the thumb within the "thumb zone" (the lower two-thirds of the screen):

- **Play/Pause Button**:
  - Sized at **80px × 80px** (`w-20 h-20`), exceeding standard 56px guidelines.
  - Centered vertically and horizontally in the primary action zone.
  - Effortless to strike without visual precision, even when walking or in low-light environments.
- **Minimum Tap Targets**:
  - Every interactive button, reaction icon, and navigation item enforces a minimum boundary of **44px × 44px** (`min-h-tap: 44px`, `min-w-tap: 44px`), eliminating mis-clicks and accidental navigation.

### Social Proof: Live Presence & Shared Synchrony
Shared listening is inherently social. SyncWave reinforces collective experience through ambient cues:
- **Active Listener Avatars**: Displayed in a horizontal row at the bottom of the room, featuring vibrant emoji icons and colored rings.
- **Real-Time Pulse Dots**: A pulsating green badge (`bg-green-500 animate-pulse`) signifies active, in-sync listening status.
- **Floating Reaction Emojis**: When any participant taps an emoji (❤️, 🔥, 🎉, 👏), physics-based particles float upward across all members' screens using Framer Motion, providing instant emotional feedback without interrupting audio.

---

## 3. Visual System & Typography

### Dark-First Canvas & Ambient Artwork Gradients
Listening apps are predominantly used in personal, relaxed, or dimly lit environments. A light theme causes glare and consumes excess battery on OLED displays.

- **Background Canvas**: Pure dark neutrals (`bg-neutral-950` / `#0a0a0a`), framed by subtle border accents (`border-neutral-800` / `#262626`).
- **Dynamic Ambient Glow**:
  - The active track's album art is projected onto the background with extreme Gaussian blur (`blur-3xl`) and low opacity (`opacity-20` to `opacity-30`).
  - The ambient canvas dynamically morphs as tracks transition, producing a tailored, rich atmosphere for every genre and album without distracting from text legibility.

### Spacing & Layout: The 8px Grid System
All margins, padding, component heights, and layout containers conform to a strict **8-pixel grid** (using Tailwind CSS 4px/8px increments):

| Tailwind Token | Pixel Value | Typical Application |
| :--- | :--- | :--- |
| `p-1` / `gap-1` | 4px | Micro-spacing, icon-to-badge offsets |
| `p-2` / `gap-2` | 8px | Button padding, icon spacing |
| `p-4` / `gap-4` | 16px | Card padding, container gaps |
| `p-6` / `gap-6` | 24px | Page gutters, section padding |
| `p-8` / `gap-8` | 32px | Major component separation |
| `h-20` / `w-20` | 80px | Primary hero play button |

### Typography: Inter Sans-Serif
- **Primary Typeface**: `Inter` (Google Fonts / local fallback to system sans-serif: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`).
- **Rationale**: Inter features tall x-heights, open counters, and carefully balanced letterforms engineered for screen readability at small font sizes (such as track duration stamps and queue indices).
- **Hierarchy**:
  - `Display / Track Title`: `text-2xl font-bold tracking-tight text-white line-clamp-1`
  - `Artist / Subheading`: `text-lg font-medium text-neutral-400 line-clamp-1`
  - `Body / Descriptions`: `text-sm font-normal text-neutral-300`
  - `Labels / Timestamps`: `text-xs font-mono text-neutral-500 tabular-nums`

---

## 4. Accessibility & WCAG 2.2 AA Compliance

SyncWave is designed to meet **WCAG 2.2 Level AA** accessibility standards:

### 1. Contrast Ratios (Success Criterion 1.4.3 & 1.4.11)
- **Primary Text (`#FFFFFF`) on Surface (`#0A0A0A`)**: Contrast ratio **18.2:1** (far exceeds the AA requirement of 4.5:1).
- **Secondary Text (`#A3A3A3` / `neutral-400`) on Surface**: Contrast ratio **5.8:1** (exceeds the 4.5:1 minimum).
- **Accent Brand Buttons (`#6366F1` / `indigo-500`)**: Contrast ratio **4.7:1** against white text and dark containers.
- **Focus Rings**: High-visibility outline rings (`focus-visible:ring-2 focus-visible:ring-indigo-400`) provide an unmistakable 3:1 contrast against adjacent backgrounds.

### 2. Touch Target Sizing (Success Criterion 2.5.8)
- All interactive controls provide a target area of at least **44 × 44 CSS pixels**, exceeding the WCAG 2.2 Target Size minimum (24 × 24px).
- Ample negative spacing between adjacent reaction buttons prevents accidental triggers.

### 3. Keyboard Navigation & Focus Management
- Interactive controls are fully accessible via keyboard (`Tab`, `Shift+Tab`, `Space`, `Enter`).
- Standard keyboard shortcuts in listening rooms:
  - `Space`: Toggle Play/Pause.
  - `ArrowRight` / `ArrowLeft`: Seek +5s / -5s.
  - `KeyM`: Toggle Mute / Unmute.
- Modals and dialogs trap keyboard focus and dismiss on `Escape`.

### 4. Screen Reader Support & ARIA Semantics
- Pure icon buttons include unambiguous `aria-label` tags:
  ```html
  <button aria-label="Toggle Play and Pause" onClick={togglePlay}>...</button>
  <button aria-label="Skip to Next Track" onClick={skipTrack}>...</button>
  <button aria-label="Send Heart Reaction" onClick={() => sendReaction('❤️')}>...</button>
  ```
- Track updates and room status changes are communicated via polite ARIA live regions:
  ```html
  <div role="status" aria-live="polite" className="sr-only">
    Now playing: {currentTrack.title} by {currentTrack.artist}
  </div>
  ```
- Audio volume and progress sliders implement semantic `role="slider"` with `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow`.

### 5. Reduced Motion Support
- For users with vestibular motion sensitivities, CSS animations and Framer Motion transitions honor the system preference:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
