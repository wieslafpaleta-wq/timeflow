/**
 * TimeFlow — app.js
 * Główna logika aplikacji PWA do śledzenia bloków czasowych
 *
 * Architektura:
 *  • State — centralne zarządzanie danymi
 *  • Storage — localStorage persistence
 *  • Blocks — CRUD dla bloków czasu
 *  • Analysis — klasyfikacja i obliczenia
 *  • Timeline — wizualizacja
 *  • UI — rendering, nawigacja, animacje
 *  • PWA — Service Worker, instalacja
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. STAN APLIKACJI
   ═══════════════════════════════════════════════════════════════ */

const State = {
  blocks: [],           // Lista bloków czasu
  theme: 'dark',        // 'light' | 'dark'
  activeView: 'add',    // 'add' | 'list' | 'analysis'
  analysisResult: null, // Wynik ostatniej analizy
  loading: false,
};

/* ═══════════════════════════════════════════════════════════════
   2. STAŁE & KONFIGURACJA
   ═══════════════════════════════════════════════════════════════ */

const CONFIG = {
  STORAGE_KEYS: {
    BLOCKS: 'tf_blocks',
    THEME:  'tf_theme',
  },
  MAX_DESC_LENGTH: 200,
  TIMELINE_START: 0,   // godz. 0:00
  TIMELINE_END:   24,  // godz. 24:00
};

/** Słowa kluczowe do automatycznej klasyfikacji aktywności */
const KEYWORDS = {
  productive: [
    'praca', 'nauka', 'projekt', 'kod', 'programowanie', 'czytanie', 'ćwiczenia',
    'sport', 'trening', 'medytacja', 'planowanie', 'spotkanie', 'prezentacja',
    'kurs', 'szkolenie', 'pisanie', 'research', 'analiza', 'learning', 'work',
    'exercise', 'study', 'meeting', 'coding', 'design', 'writing', 'focus',
    'zadania', 'email', 'raporty', 'zdrowie', 'bieganie', 'siłownia',
  ],
  wasteful: [
    'social media', 'facebook', 'instagram', 'tiktok', 'youtube', 'netflix',
    'seriale', 'granie', 'gry', 'leniuchowanie', 'nicnierobienie', 'scrollowanie',
    'scroll', 'prokrastynacja', 'marnowanie', 'bezczynność', 'tv', 'telewizja',
    'twitter', 'x.com', 'reddit', 'gaming', 'games', 'procrastination',
  ],
};

/** Opisy ocen produktywności */
const SCORE_DESCRIPTIONS = [
  { min: 80, emoji: '🏆', title: 'Mistrz dnia!', desc: 'Niesamowity wynik. Twoja produktywność jest na szczycie!' },
  { min: 60, emoji: '🚀', title: 'Świetny dzień', desc: 'Zdecydowanie produktywny dzień. Tak trzymaj!' },
  { min: 40, emoji: '📈', title: 'Dobry postęp', desc: 'Niezły balans. Możesz jeszcze przyśpieszyć.' },
  { min: 20, emoji: '💤', title: 'Leniwszy dzień', desc: 'Trochę za dużo odpoczynku. Jutro się poprawisz?' },
  { min:  0, emoji: '🔴', title: 'Dzień stracony', desc: 'Czas na reset. Jutro zacznij od nowa z planem!' },
];

/* ═══════════════════════════════════════════════════════════════
   3. STORAGE — ZAPIS / ODCZYT Z LOCALSTORAGE
   ═══════════════════════════════════════════════════════════════ */

const Storage = {
  /** Zapisz bloki do localStorage */
  saveBlocks() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.BLOCKS, JSON.stringify(State.blocks));
    } catch (err) {
      console.error('[Storage] Błąd zapisu bloków:', err);
      Toast.show('Błąd zapisu danych!', 'error');
    }
  },

  /** Wczytaj bloki z localStorage */
  loadBlocks() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.BLOCKS);
      State.blocks = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[Storage] Błąd odczytu bloków:', err);
      State.blocks = [];
    }
  },

  /** Zapisz motyw */
  saveTheme() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, State.theme);
  },

  /** Wczytaj motyw */
  loadTheme() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
    // Jeśli brak — wykryj preferencje systemowe
    if (!saved) {
      State.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      State.theme = saved;
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   4. KLASYFIKACJA AKTYWNOŚCI
   ═══════════════════════════════════════════════════════════════ */

const Classifier = {
  /**
   * Klasyfikuj opis aktywności na kategorię
   * @param {string} desc — opis aktywności
   * @returns {'productive' | 'wasteful' | 'neutral'}
   */
  classify(desc) {
    const lower = desc.toLowerCase();

    // Sprawdź słowa kluczowe — strata czasu ma priorytet
    for (const keyword of KEYWORDS.wasteful) {
      if (lower.includes(keyword)) return 'wasteful';
    }

    for (const keyword of KEYWORDS.productive) {
      if (lower.includes(keyword)) return 'productive';
    }

    return 'neutral';
  },

  /** Etykieta kategorii po polsku */
  label(category) {
    const map = {
      productive: 'Produktywne',
      neutral:    'Neutralne',
      wasteful:   'Strata czasu',
    };
    return map[category] || 'Nieokreślone';
  },
};

/* ═══════════════════════════════════════════════════════════════
   5. OPERACJE NA BLOKACH CZASU
   ═══════════════════════════════════════════════════════════════ */

const Blocks = {
  /**
   * Przelicz godziny na minuty od początku dnia
   * @param {string} timeStr — np. "09:30"
   * @returns {number} minuty
   */
  timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  /**
   * Formatuj minuty do czytelnego czasu
   * @param {number} minutes
   * @returns {string} np. "1 godz. 30 min"
   */
  formatDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} godz. ${m} min` : `${h} godz.`;
  },

  /**
   * Waliduj dane formularza
   * @returns {string | null} null = OK, string = komunikat błędu
   */
  validate(from, to, desc) {
    if (!from) return 'Wpisz godzinę od';
    if (!to)   return 'Wpisz godzinę do';

    const startMin = this.timeToMinutes(from);
    const endMin   = this.timeToMinutes(to);

    if (endMin <= startMin) return 'Godzina "do" musi być późniejsza niż "od"';
    if (endMin - startMin < 5) return 'Blok musi trwać co najmniej 5 minut';
    if (!desc.trim()) return 'Opisz co robiłeś/aś';
    if (desc.trim().length < 3) return 'Opis jest za krótki (min. 3 znaki)';

    // Sprawdź nakładanie się z istniejącymi blokami
    for (const block of State.blocks) {
      const existStart = this.timeToMinutes(block.from);
      const existEnd   = this.timeToMinutes(block.to);

      if (startMin < existEnd && endMin > existStart) {
        return `Blok nakłada się z "${block.desc.substring(0, 30)}..."`;
      }
    }

    return null;
  },

  /**
   * Dodaj nowy blok czasu
   * @param {string} from — czas rozpoczęcia "HH:MM"
   * @param {string} to   — czas zakończenia "HH:MM"
   * @param {string} desc — opis aktywności
   */
  add(from, to, desc) {
    const block = {
      id:       Date.now().toString(),
      from,
      to,
      desc:     desc.trim(),
      category: Classifier.classify(desc),
      createdAt: new Date().toISOString(),
    };

    State.blocks.push(block);

    // Sortuj bloki chronologicznie
    State.blocks.sort((a, b) =>
      this.timeToMinutes(a.from) - this.timeToMinutes(b.from)
    );

    Storage.saveBlocks();
    return block;
  },

  /**
   * Usuń blok po ID
   * @param {string} id
   */
  remove(id) {
    State.blocks = State.blocks.filter(b => b.id !== id);
    Storage.saveBlocks();
  },

  /**
   * Oblicz statystyki produktywności
   * @returns {object} wyniki analizy
   */
  analyze() {
    if (State.blocks.length === 0) return null;

    let productiveMin = 0;
    let neutralMin    = 0;
    let wastefulMin   = 0;

    for (const block of State.blocks) {
      const duration = this.timeToMinutes(block.to) - this.timeToMinutes(block.from);
      if (block.category === 'productive') productiveMin += duration;
      else if (block.category === 'wasteful') wastefulMin += duration;
      else neutralMin += duration;
    }

    const totalMin = productiveMin + neutralMin + wastefulMin;
    const productivePct = totalMin > 0 ? Math.round((productiveMin / totalMin) * 100) : 0;
    const neutralPct    = totalMin > 0 ? Math.round((neutralMin    / totalMin) * 100) : 0;
    const wastefulPct   = totalMin > 0 ? Math.round((wastefulMin   / totalMin) * 100) : 0;

    // Znajdź opis oceny
    const scoreInfo = SCORE_DESCRIPTIONS.find(s => productivePct >= s.min) || SCORE_DESCRIPTIONS.at(-1);

    return {
      productiveMin, neutralMin, wastefulMin, totalMin,
      productivePct, neutralPct, wastefulPct,
      scoreInfo,
      blockCount: State.blocks.length,
    };
  },
};

/* ═══════════════════════════════════════════════════════════════
   6. TIMELINE — WIZUALIZACJA DNIA
   ═══════════════════════════════════════════════════════════════ */

const Timeline = {
  /**
   * Renderuj timeline z bloków czasu
   */
  render() {
    const bar = document.getElementById('timeline-bar');
    if (!bar) return;

    bar.innerHTML = '';

    if (State.blocks.length === 0) {
      // Pusty placeholder
      bar.innerHTML = '<div style="width:100%;height:100%;background:var(--bg-input);border-radius:6px;display:flex;align-items:center;justify-content:center"><span style="font-size:0.65rem;color:var(--text-muted)">Brak bloków</span></div>';
      return;
    }

    const totalRange = (CONFIG.TIMELINE_END - CONFIG.TIMELINE_START) * 60; // minuty

    // Iteruj po blokach i twórz segmenty
    State.blocks.forEach(block => {
      const startMin = Blocks.timeToMinutes(block.from);
      const endMin   = Blocks.timeToMinutes(block.to);
      const duration = endMin - startMin;

      const pct = (duration / totalRange) * 100;
      const offset = ((startMin - CONFIG.TIMELINE_START * 60) / totalRange) * 100;

      const seg = document.createElement('div');
      seg.className = `timeline-segment ${block.category}`;
      seg.style.width = `${pct}%`;
      seg.style.marginLeft = offset > 0 ? `${offset}%` : '0';
      seg.setAttribute('data-label', `${block.from}–${block.to}: ${block.desc.substring(0, 25)}`);

      // Reset marginLeft dla kolejnych elementów (flex)
      if (bar.children.length > 0) {
        seg.style.marginLeft = '0';
      }

      bar.appendChild(seg);
    });

    // Wypełnij luki pustymi segmentami
    this.fillGaps(bar, totalRange);
  },

  /**
   * Wypełnij luki między blokami przezroczystymi segmentami
   */
  fillGaps(bar, totalRange) {
    const segments = Array.from(bar.querySelectorAll('.timeline-segment'));
    if (segments.length === 0) return;

    // Zamiast inline flex gaps — przerysuj całość jako absolutne pozycje
    bar.style.position = 'relative';
    bar.innerHTML = '';

    let prevEnd = 0;

    State.blocks.forEach(block => {
      const startMin = Blocks.timeToMinutes(block.from) - CONFIG.TIMELINE_START * 60;
      const endMin   = Blocks.timeToMinutes(block.to)   - CONFIG.TIMELINE_START * 60;

      // Luka przed blokiem
      if (startMin > prevEnd) {
        const gapEl = document.createElement('div');
        gapEl.className = 'timeline-segment';
        gapEl.style.cssText = `
          position: absolute;
          left: ${(prevEnd / totalRange) * 100}%;
          width: ${((startMin - prevEnd) / totalRange) * 100}%;
          background: var(--bg-input);
        `;
        bar.appendChild(gapEl);
      }

      // Właściwy blok
      const el = document.createElement('div');
      el.className = `timeline-segment ${block.category}`;
      el.style.cssText = `
        position: absolute;
        left: ${(startMin / totalRange) * 100}%;
        width: ${((endMin - startMin) / totalRange) * 100}%;
      `;
      el.setAttribute('data-label', `${block.from}–${block.to}`);
      bar.appendChild(el);

      prevEnd = endMin;
    });

    // Luka na końcu
    if (prevEnd < totalRange) {
      const gapEl = document.createElement('div');
      gapEl.style.cssText = `
        position: absolute;
        left: ${(prevEnd / totalRange) * 100}%;
        width: ${((totalRange - prevEnd) / totalRange) * 100}%;
        background: var(--bg-input);
        height: 100%;
        border-radius: 6px;
      `;
      bar.appendChild(gapEl);
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   7. RENDEROWANIE UI
   ═══════════════════════════════════════════════════════════════ */

const UI = {
  /**
   * Renderuj listę bloków
   */
  renderBlocks() {
    const list = document.getElementById('blocks-list');
    const badge = document.getElementById('blocks-count-badge');

    if (!list) return;

    // Aktualizuj badge
    if (badge) {
      badge.textContent = `${State.blocks.length} ${State.blocks.length === 1 ? 'blok' : 'bloków'}`;
      badge.classList.toggle('visible', State.blocks.length > 0);
    }

    if (State.blocks.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">⏱️</span>
          <p class="empty-title">Brak bloków czasu</p>
          <p class="empty-desc">Dodaj swój pierwszy blok,<br>aby zacząć śledzić dzień.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = State.blocks.map(block => this.blockHTML(block)).join('');

    // Podłącz zdarzenia usuwania
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteBlock(btn.dataset.delete));
    });
  },

  /**
   * Generuj HTML dla pojedynczego bloku
   * @param {object} block
   * @returns {string} HTML
   */
  blockHTML(block) {
    const durationMin = Blocks.timeToMinutes(block.to) - Blocks.timeToMinutes(block.from);
    const durationStr = Blocks.formatDuration(durationMin);
    const categoryLabel = Classifier.label(block.category);

    return `
      <div class="block-item ${block.category}" data-id="${block.id}">
        <div class="block-color-indicator"></div>
        <div class="block-content">
          <div class="block-time">
            ${block.from} – ${block.to}
            <span class="block-duration-badge">${durationStr}</span>
          </div>
          <div class="block-desc">${escapeHTML(block.desc)}</div>
          <span class="block-category-badge">${categoryLabel}</span>
        </div>
        <div class="block-actions">
          <button class="btn-delete" data-delete="${block.id}" title="Usuń blok" aria-label="Usuń blok">
            🗑️
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Usuń blok z animacją
   * @param {string} id
   */
  deleteBlock(id) {
    const el = document.querySelector(`[data-id="${id}"]`);

    if (el) {
      el.classList.add('removing');
      el.addEventListener('animationend', () => {
        Blocks.remove(id);
        this.renderBlocks();
        Timeline.render();
        State.analysisResult = null;
        this.hideAnalysis();
        Toast.show('Blok usunięty', 'info');
      }, { once: true });
    }
  },

  /**
   * Renderuj wyniki analizy
   * @param {object} result
   */
  renderAnalysis(result) {
    const panel = document.getElementById('analysis-result');
    if (!panel || !result) return;

    const { scoreInfo, productivePct, neutralPct, wastefulPct,
            productiveMin, neutralMin, wastefulMin, totalMin } = result;

    // Kolor oceny
    let scoreColor = '#8c8ba8';
    if (productivePct >= 60) scoreColor = 'var(--productive)';
    else if (productivePct < 30) scoreColor = 'var(--wasteful)';

    panel.innerHTML = `
      <div class="analysis-divider"></div>

      <!-- Główna ocena -->
      <div class="day-score">
        <div class="score-circle" style="border-color: ${scoreColor}">
          <div class="score-number" style="color: ${scoreColor}">${productivePct}%</div>
          <div class="score-label">prod.</div>
        </div>
        <div class="score-details">
          <div class="score-title">${scoreInfo.emoji} ${scoreInfo.title}</div>
          <div class="score-desc">${scoreInfo.desc}</div>
        </div>
      </div>

      <!-- Statystyki kategorii -->
      <div class="category-stats">
        <div class="stat-row">
          <div class="stat-label">
            <span class="stat-dot productive"></span>
            Produktywne
          </div>
          <div class="stat-bar-wrap">
            <div class="stat-bar productive" style="width:0%" data-target="${productivePct}"></div>
          </div>
          <div class="stat-value">${Blocks.formatDuration(productiveMin)}</div>
        </div>
        <div class="stat-row">
          <div class="stat-label">
            <span class="stat-dot neutral"></span>
            Neutralne
          </div>
          <div class="stat-bar-wrap">
            <div class="stat-bar neutral" style="width:0%" data-target="${neutralPct}"></div>
          </div>
          <div class="stat-value">${Blocks.formatDuration(neutralMin)}</div>
        </div>
        <div class="stat-row">
          <div class="stat-label">
            <span class="stat-dot wasteful"></span>
            Strata czasu
          </div>
          <div class="stat-bar-wrap">
            <div class="stat-bar wasteful" style="width:0%" data-target="${wastefulPct}"></div>
          </div>
          <div class="stat-value">${Blocks.formatDuration(wastefulMin)}</div>
        </div>
      </div>

      <!-- Porada AI -->
      <div class="ai-tip">
        <div class="ai-tip-label">✨ Wskazówka dnia</div>
        ${this.generateTip(result)}
      </div>
    `;

    panel.classList.add('visible');

    // Animuj paski po krótkim opóźnieniu
    requestAnimationFrame(() => {
      setTimeout(() => {
        panel.querySelectorAll('.stat-bar').forEach(bar => {
          bar.style.width = `${bar.dataset.target}%`;
        });
      }, 100);
    });
  },

  /**
   * Generuj personalizowaną wskazówkę
   * @param {object} result
   * @returns {string} tekst wskazówki
   */
  generateTip(result) {
    const { productivePct, wastefulPct, wastefulMin, productiveMin } = result;

    if (productivePct >= 80) {
      return 'Rewelacyjny wynik! Pamiętaj, że regularny odpoczynek jest kluczowy dla długoterminowej produktywności.';
    }
    if (wastefulPct > 40) {
      const h = Math.floor(wastefulMin / 60);
      return `Spędziłeś/aś ${Blocks.formatDuration(wastefulMin)} na nieproduktywnych aktywnościach. Nawet jedna z nich zamieniona na naukę to duży zysk.`;
    }
    if (productiveMin < 60) {
      return 'Mniej niż godzina produktywnej pracy. Spróbuj techniki Pomodoro: 25 min pracy, 5 min przerwy.';
    }
    if (productivePct >= 60) {
      return 'Dobry wynik! Spróbuj jutro zidentyfikować i wyeliminować jedną aktywność marnującą czas.';
    }
    return 'Najlepsze dni zaczynają się od zaplanowania kluczowych bloków pracy rano, gdy energia jest najwyższa.';
  },

  hideAnalysis() {
    const panel = document.getElementById('analysis-result');
    if (panel) {
      panel.classList.remove('visible');
      panel.innerHTML = '';
    }
  },

  /**
   * Przełącz widok (zakładkę)
   * @param {string} viewName — 'add' | 'list' | 'analysis'
   */
  switchView(viewName) {
    // Odznacz poprzednią zakładkę
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Aktywuj nową zakładkę
    const view = document.getElementById(`view-${viewName}`);
    const navBtn = document.getElementById(`nav-${viewName}`);

    if (view) view.classList.add('active');
    if (navBtn) navBtn.classList.add('active');

    State.activeView = viewName;
  },

  /**
   * Wyświetl dzisiejszą datę
   */
  renderDate() {
    const el = document.getElementById('current-date');
    if (!el) return;

    const now  = new Date();
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

    el.innerHTML = `<span>${days[now.getDay()]}</span>, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  },
};

/* ═══════════════════════════════════════════════════════════════
   8. TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

const Toast = {
  /**
   * Pokaż powiadomienie
   * @param {string} msg
   * @param {'success' | 'error' | 'info'} type
   */
  show(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span> ${escapeHTML(msg)}`;
    container.appendChild(toast);

    // Usuń po 3s
    setTimeout(() => {
      toast.classList.add('leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
  },
};

/* ═══════════════════════════════════════════════════════════════
   9. OBSŁUGA FORMULARZA
   ═══════════════════════════════════════════════════════════════ */

const Form = {
  init() {
    const addBtn = document.getElementById('add-block-btn');
    const descInput = document.getElementById('desc-input');
    const charCounter = document.getElementById('char-counter');

    // Licznik znaków opisu
    if (descInput && charCounter) {
      descInput.addEventListener('input', () => {
        const len = descInput.value.length;
        const max = CONFIG.MAX_DESC_LENGTH;
        charCounter.textContent = `${len}/${max}`;
        charCounter.classList.toggle('warn', len > max * 0.85);

        if (len > max) {
          descInput.value = descInput.value.substring(0, max);
        }

        // Wyczyść błąd przy pisaniu
        this.clearError('desc-input', 'desc-error');
      });
    }

    // Wyczyść błędy przy zmianie time inputów
    ['from-input', 'to-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.clearError(id, `${id.replace('-input', '')}-error`);
        });
      }
    });

    // Dodaj blok
    if (addBtn) {
      addBtn.addEventListener('click', () => this.submit());
    }

    // Enter w textarea = submit
    if (descInput) {
      descInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) this.submit();
      });
    }
  },

  /**
   * Wyślij formularz — walidacja + dodanie bloku
   */
  submit() {
    const fromVal = document.getElementById('from-input')?.value;
    const toVal   = document.getElementById('to-input')?.value;
    const descVal = document.getElementById('desc-input')?.value || '';

    // Walidacja
    const error = Blocks.validate(fromVal, toVal, descVal);

    if (error) {
      Toast.show(error, 'error');
      // Podświetl problematyczne pole
      if (!fromVal) this.showError('from-input', 'from-error', 'Wymagane');
      if (!toVal)   this.showError('to-input', 'to-error', 'Wymagane');
      if (!descVal.trim()) this.showError('desc-input', 'desc-error', 'Wymagane');
      return;
    }

    // Efekt ładowania na przycisku
    const addBtn = document.getElementById('add-block-btn');
    this.setLoading(addBtn, true);

    // Małe opóźnienie dla UX (wrażenie "przetwarzania")
    setTimeout(() => {
      const block = Blocks.add(fromVal, toVal, descVal);

      // Wyczyść formularz
      this.reset();
      this.setLoading(addBtn, false);

      // Odśwież UI
      UI.renderBlocks();
      Timeline.render();
      State.analysisResult = null;
      UI.hideAnalysis();

      Toast.show('Blok dodany! ✨', 'success');

      // Przenieś do listy
      setTimeout(() => UI.switchView('list'), 400);
    }, 250);
  },

  /**
   * Resetuj formularz
   */
  reset() {
    ['from-input', 'to-input', 'desc-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const counter = document.getElementById('char-counter');
    if (counter) counter.textContent = `0/${CONFIG.MAX_DESC_LENGTH}`;

    ['from-error', 'to-error', 'desc-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  },

  showError(inputId, errorId, msg) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);

    if (input) input.classList.add('error');
    if (error) {
      error.textContent = msg;
      error.classList.add('visible');
    }
  },

  clearError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);

    if (input) input.classList.remove('error');
    if (error) error.classList.remove('visible');
  },

  setLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
      ? '<div class="spinner"></div> Dodawanie...'
      : '+ Dodaj blok';
  },
};

/* ═══════════════════════════════════════════════════════════════
   10. MOTYWY (DARK / LIGHT MODE)
   ═══════════════════════════════════════════════════════════════ */

const Theme = {
  /**
   * Ustaw motyw
   * @param {'dark' | 'light'} theme
   */
  set(theme) {
    State.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Storage.saveTheme();
    this.updateToggle();
  },

  /** Przełącz motyw */
  toggle() {
    this.set(State.theme === 'dark' ? 'light' : 'dark');
  },

  /** Aktualizuj ikonę przycisku */
  updateToggle() {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = State.theme === 'dark' ? '☀️' : '🌙';
      btn.title = State.theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';
    }
  },

  /** Inicjalizuj i nasłuchuj systemowych preferencji */
  init() {
    Storage.loadTheme();
    this.set(State.theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // Tylko jeśli użytkownik nie wybrał ręcznie
      if (!localStorage.getItem(CONFIG.STORAGE_KEYS.THEME)) {
        this.set(e.matches ? 'dark' : 'light');
      }
    });
  },
};

/* ═══════════════════════════════════════════════════════════════
   11. PWA — SERVICE WORKER & INSTALACJA
   ═══════════════════════════════════════════════════════════════ */

const PWA = {
  deferredPrompt: null,

  /** Zarejestruj Service Worker */
  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker nieobsługiwany');
      return;
    }

    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('[PWA] Service Worker zarejestrowany:', reg.scope);

        // Sprawdź aktualizacje
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              Toast.show('Dostępna aktualizacja! Odśwież stronę.', 'info');
            }
          });
        });
      })
      .catch(err => {
        console.error('[PWA] Błąd rejestracji SW:', err);
      });
  },

  /** Obsługuj możliwość instalacji (Add to Home Screen) */
  initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPrompt = e;

      // Pokaż przycisk instalacji
      const btn = document.getElementById('install-btn');
      if (btn) btn.classList.add('visible');

      console.log('[PWA] Aplikacja gotowa do instalacji');
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const btn = document.getElementById('install-btn');
      if (btn) btn.classList.remove('visible');
      Toast.show('Aplikacja zainstalowana! 🎉', 'success');
    });
  },

  /** Uruchom prompt instalacji */
  async install() {
    if (!this.deferredPrompt) {
      Toast.show('Aplikacja jest już zainstalowana lub instalacja niedostępna.', 'info');
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      this.deferredPrompt = null;
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   12. ANALIZA DNIA
   ═══════════════════════════════════════════════════════════════ */

function handleAnalyze() {
  if (State.blocks.length === 0) {
    Toast.show('Dodaj najpierw jakieś bloki czasu!', 'error');
    return;
  }

  const btn = document.getElementById('analyze-btn');

  // Efekt ładowania
  if (btn) {
    btn.innerHTML = '<div class="spinner"></div> Analizuję...';
    btn.disabled = true;
  }

  setTimeout(() => {
    const result = Blocks.analyze();
    State.analysisResult = result;
    UI.renderAnalysis(result);

    if (btn) {
      btn.innerHTML = '🔍 Analizuj ponownie';
      btn.disabled = false;
    }

    Toast.show('Analiza gotowa!', 'success');
  }, 600);
}

/* ═══════════════════════════════════════════════════════════════
   13. RIPPLE EFFECT DLA PRZYCISKÓW
   ═══════════════════════════════════════════════════════════════ */

function addRipple(e) {
  const btn = e.currentTarget;
  const ripple = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);

  ripple.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${e.clientX - rect.left - size / 2}px;
    top: ${e.clientY - rect.top - size / 2}px;
  `;
  ripple.classList.add('ripple');
  btn.appendChild(ripple);

  setTimeout(() => ripple.remove(), 700);
}

/* ═══════════════════════════════════════════════════════════════
   14. NARZĘDZIA
   ═══════════════════════════════════════════════════════════════ */

/** Zabezpiecz HTML przed XSS */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Ustaw domyślne godziny w formularzu (teraz ± 1h) */
function setDefaultTimes() {
  const now  = new Date();
  const from = document.getElementById('from-input');
  const to   = document.getElementById('to-input');

  if (from && !from.value) {
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    from.value = `${h}:${m}`;
  }

  if (to && !to.value) {
    const toDate = new Date(now.getTime() + 60 * 60 * 1000);
    const h = String(toDate.getHours()).padStart(2, '0');
    const m = String(toDate.getMinutes()).padStart(2, '0');
    to.value = `${h}:${m}`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   15. INICJALIZACJA APLIKACJI
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[TimeFlow] Inicjalizacja aplikacji...');

  // 1. Wczytaj dane
  Storage.loadBlocks();

  // 2. Motyw
  Theme.init();
  document.getElementById('theme-toggle')?.addEventListener('click', () => Theme.toggle());

  // 3. Renderuj UI
  UI.renderDate();
  UI.renderBlocks();
  Timeline.render();

  // 4. Formularz
  Form.init();
  setDefaultTimes();

  // 5. Nawigacja
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) UI.switchView(view);
    });
  });

  // 6. Analiza
  document.getElementById('analyze-btn')?.addEventListener('click', handleAnalyze);

  // 7. Instalacja PWA
  PWA.registerServiceWorker();
  PWA.initInstallPrompt();
  document.getElementById('install-btn')?.addEventListener('click', () => PWA.install());

  // 8. Ripple na głównych przyciskach
  document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
    btn.addEventListener('click', addRipple);
  });

  // 9. Domyślny widok
  UI.switchView('add');

  console.log('[TimeFlow] Aplikacja gotowa ✅');
});
