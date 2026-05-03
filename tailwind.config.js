/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./static/**/*.html",
    "./static/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Dark Fantasy Palette
        'dark': {
          900: '#07080e',
          800: '#0c0e18',
          700: '#121422',
          600: '#1a1d2e',
          500: '#242840',
        },
        'gold': {
          50: '#fffdf5',
          100: '#fef9e7',
          200: '#fcefc7',
          300: '#f9e09a',
          400: '#f5cc5a',
          500: '#d4a830',
          600: '#b8922a',
          700: '#967522',
          800: '#7a5f1c',
          900: '#5c4715',
        },
        'blood': {
          700: '#8b1a1a',
          600: '#a31e1e',
          500: '#bf2424',
          400: '#d93838',
        },
        // Legacy gothic names (backward compat)
        'gothic-red': '#8b1a1a',
        'gothic-dark-red': '#641010',
        'gothic-blue': '#1a1a2e',
        'gothic-gray': '#1e1e2e',
        'gothic-gold': '#d4a830',
        'gothic-light': '#e8e8e8'
      },
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
        'noto-sans': ['Noto Sans SC', 'sans-serif'],
        // Legacy names
        'gothic': ['Cinzel', 'serif'],
        'serif': ['Cinzel', 'serif']
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(212, 168, 48, 0.4), 0 0 40px rgba(212, 168, 48, 0.2)',
        'card-glow': '0 4px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(212, 168, 48, 0.1)',
        'inner-gold': 'inset 0 0 20px rgba(212, 168, 48, 0.05)',
        'blood-glow': '0 0 30px rgba(139, 26, 26, 0.5), 0 0 60px rgba(139, 26, 26, 0.2)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'particle-float': 'particleFloat 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'border-glow': 'borderGlow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateY(0)' },
          '50%': { transform: 'translate(-50%, -50%) translateY(-10px)' }
        },
        particleFloat: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)', opacity: '0.4' },
          '33%': { transform: 'translateY(-15px) translateX(5px)', opacity: '0.8' },
          '66%': { transform: 'translateY(-5px) translateX(-5px)', opacity: '0.6' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' }
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(212, 168, 48, 0.3)' },
          '50%': { borderColor: 'rgba(212, 168, 48, 0.7)' }
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
