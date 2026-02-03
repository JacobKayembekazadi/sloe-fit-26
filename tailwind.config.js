/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '375px', // Small phones
            },
            colors: {
                primary: '#D4FF00', // Sloe Volt
                'background-light': '#f5f7f8',
                'background-dark': '#101922',
            },
            fontFamily: {
                display: ['Lexend', 'sans-serif'],
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
