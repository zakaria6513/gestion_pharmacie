/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#f0faf6',
                    100: '#d7f4eb',
                    200: '#b2ead9',
                    300: '#85dcc3',
                    400: '#5bc8a7',
                    500: '#3eb491',
                    600: '#2d9475',
                    700: '#25765e',
                    800: '#215d4b',
                    900: '#1d4d3f',
                },
                espresso: {
                    950: '#14100e',
                    900: '#1b1614',
                    850: '#221c19',
                    800: '#2a231f',
                    750: '#332b26',
                    700: '#3e342e',
                    600: '#52453e',
                    500: '#736259',
                    400: '#9e8c81',
                    300: '#c7b8ad',
                    200: '#e4dad2',
                    100: '#f4efe9',
                }
            }
        },
    },
    plugins: [],
}
