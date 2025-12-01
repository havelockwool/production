# Warehouse Production Analysis Dashboard

A production capacity planning tool for warehouse operations with interactive visualization.

## Architecture

This application uses:
- **Frontend**: Vanilla JavaScript with Plotly.js for interactive charts
- **Backend**: Python serverless functions on Vercel
- **Hosting**: Vercel

## Project Structure

```
production/
├── api/
│   └── calculate.py          # Python serverless function for calculations
├── public/
│   ├── index.html            # Main HTML page
│   ├── script.js             # Frontend JavaScript
│   └── favicon.ico           # Site icon
├── vercel.json               # Vercel configuration
├── requirements.txt          # Python dependencies (empty - uses stdlib only)
└── README.md                 # This file
```

## Deployment

### Deploy to Vercel

1. Install Vercel CLI (if not already installed):
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. For production deployment:
```bash
vercel --prod
```

### Configuration

The app uses Python 3.9 runtime for serverless functions. All configuration is in `vercel.json`.

## Local Development

To test locally with Vercel CLI:

```bash
vercel dev
```

This will start a local development server at `http://localhost:3000`

## Features

- Interactive production capacity analysis
- Real-time chart updates with slider controls
- Multiple production hour scenarios
- Revenue target analysis
- Warehouse turnover calculations
- Balanced production point identification

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, Plotly.js
- **Backend**: Python 3.9 (serverless)
- **Deployment**: Vercel
