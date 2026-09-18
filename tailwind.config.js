/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /**
       * Escala de capas oficial de Pautello. Ningun componente puede usar un
       * z-index fuera de esta tabla:
       *   base         -> decoraciones locales / backdrop interno de un panel
       *   content      -> contenido que debe pintarse sobre un backdrop local
       *   keys         -> teclas negras del piano virtual
       *   header       -> barra superior (contexto acotado para sus menus)
       *   sidebar      -> navegacion izquierda y cajon del inspector (+ backdrops)
       *   dropdown     -> menus Dropdown/CustomSelect (por encima de sidebar/header)
       *   modal        -> backdrop y panel de modales (ModalBase)
       *   tour         -> onboarding: backdrop, spotlight y dialogo
       *   toast        -> notificaciones flotantes (ToastProvider)
       */
      zIndex: {
        base: '0',
        content: '10',
        keys: '10',
        header: '30',
        sidebar: '40',
        dropdown: '50',
        modal: '60',
        tour: '70',
        toast: '80',
      },

      /**
       * Sistema de color unico del proyecto. Prohibido volver a escribir un hex
       * arbitrario (`dark:bg-[#161922]`) en un componente: todo color sale de
       * aqui. El modo claro usa la rampa `slate` de Tailwind; el modo oscuro,
       * esta escala de superficies de estudio:
       *
       *   bg            fondo del viewport y del scroll del lienzo
       *   surface       paneles estructurales (sidebar, inspector, piano, status bar)
       *   card          tarjetas, modales, hoja de partitura
       *   elevated      controles dentro de una tarjeta, filas, estados hover suaves
       *   raised        hover/pulsado sobre `elevated`, pistas de sliders
       *   hover / deep  estados hover y pulsado neutros
       *   border        bordes estructurales de panel y tarjeta
       *   borderSubtle  separadores internos y bordes de controles
       *   line/lineSoft lineas de pentagrama y bordes finos
       *   accent        ambar de identidad (Do Central, play, foco)
       */
      colors: {
        studio: {
          bg: '#0c0d12',
          surface: '#111319',
          card: '#161922',
          elevated: '#1d212d',
          raised: '#262c3b',
          hover: '#1f2330',
          deep: '#202534',
          border: '#232836',
          borderSubtle: '#1a1d28',
          line: '#2a3042',
          lineSoft: '#282d40',
          accent: '#f59e0b',
          // Tinta de estado del pentagrama. Se eligen estos valores porque son
          // exactamente los que ya usaba ScoreView: mover el tono cambiaría las
          // marcas de práctica y los resaltados de selección de la partitura.
          success: '#22c55e',
          dangerStrong: '#ef4444',
          selection: '#2563eb',
          selectionLight: '#3b82f6',
          selectionDeep: '#4f46e5',

          // Tokens semánticos de estado (Tarea 1 del plan):
          signal: '#0d9488',
          signalLight: '#2dd4bf',
          danger: '#e11d48',
          dangerLight: '#fb7185',
          muted: '#64748b',
          mutedLight: '#94a3b8',
        },
        // El documento musical mantiene tinta y papel constantes incluso cuando
        // el entorno de edición usa el tema oscuro.
        score: {
          paper: '#fffdf6',
          ink: '#1d1d19',
          muted: '#716d63',
          rule: '#dfdacd',
        },
        pastel: {
          amber: '#fed7aa',
          amberDark: '#f59e0b',
          amberText: '#78350f',
          purple: '#c4b5fd',
          purpleDark: '#8b5cf6',
          purpleText: '#4c1d95',
          lime: '#bef264',
          limeDark: '#84cc16',
          limeText: '#365314',
          coral: '#fca5a5',
          coralText: '#7f1d1d',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Serif editorial para titulos de obra, dinamicas, letra y expresion.
        serif: ['EB Garamond', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },

      /**
       * Elevacion: sombras suaves con direccion de luz superior, sin halos de
       * color. `studio-key*` son biseles internos para las teclas del piano.
       */
      boxShadow: {
        'studio-sm': '0 1px 2px 0 rgb(2 3 8 / 0.28)',
        'studio-card': '0 1px 2px 0 rgb(2 3 8 / 0.3), 0 10px 26px -14px rgb(2 3 8 / 0.65)',
        'studio-panel': '0 14px 34px -18px rgb(2 3 8 / 0.7)',
        'studio-dropdown': '0 16px 40px -18px rgb(2 3 8 / 0.8)',
        'studio-key': 'inset 0 -3px 0 rgb(2 3 8 / 0.14)',
        'studio-key-black': 'inset 0 -4px 0 rgb(255 255 255 / 0.09)',
        'studio-paper': '0 16px 38px -24px rgb(15 17 20 / 0.55)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        modalPop: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        dropdownIn: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(-6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheetIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Oscilacion de pendulo: refleja el pulso del compas sin girar en
        // continuo (una rotacion completa marea en pantallas de alta tasa).
        pendulum: {
          '0%, 100%': { transform: 'rotate(-16deg)' },
          '50%': { transform: 'rotate(16deg)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Entrada del compas recien creado con el boton '+' del pentagrama.
        // Solo anima opacidad: el grupo del compas ya lleva un atributo
        // `transform` para posicionarse y un `transform` CSS lo pisaria.
        measureIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Destello que confirma que el compas se ha creado.
        measureFlash: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out forwards',
        'fade-in': 'fadeIn 200ms ease-out forwards',
        fadeOut: 'fadeOut 150ms ease-in forwards',
        'modal-pop': 'modalPop 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        modalPop: 'modalPop 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        dropdown: 'dropdownIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dropdown-in': 'dropdownIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'slide-down': 'slideDown 200ms ease-out forwards',
        'sheet-in': 'sheetIn 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        pendulum: 'pendulum 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'toast-in': 'toastIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'measure-in': 'measureIn 260ms ease-out forwards',
        'measure-flash': 'measureFlash 600ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
