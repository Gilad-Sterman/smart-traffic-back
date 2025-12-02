# SmartTraffic Backend

AI-powered traffic violation analysis backend built with Node.js and Express using ES6 modules.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Setup
Copy `.env` file and configure your environment variables:
```bash
cp .env.example .env
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### PoC Endpoints
```
POST /api/poc/upload          # Upload document for analysis
POST /api/poc/analyze/:id     # Start analysis process
GET  /api/poc/results/:id     # Get analysis results
GET  /api/poc/test           # Test endpoint
```

## 🏗️ Project Structure

```
src/
├── controllers/          # Request handlers
│   └── pocController.js
├── routes/              # API routes
│   └── pocRoutes.js
├── services/            # Business logic
│   ├── ocrService.js    # OCR processing
│   └── aiService.js     # AI analysis
├── config/              # Configuration files
├── utils/               # Utility functions
├── DB/                  # Database related files
└── server.js            # Main server file
```

## 🔧 Features

- **ES6 Modules** - Modern JavaScript syntax
- **File Upload** - Multer for handling document uploads
- **OCR Processing** - Text extraction from images/PDFs
- **AI Analysis** - Traffic violation analysis and recommendations
- **Security** - Helmet, CORS, rate limiting
- **Logging** - Morgan for request logging
- **Error Handling** - Global error handling middleware

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test PoC endpoint
curl http://localhost:5000/api/poc/test
```

## 📝 Development Notes

- Currently uses mock data for OCR and AI services
- Session data stored in memory (replace with database for production)
- Ready for integration with real OCR and AI services
- Follows RESTful API conventions

## 🔮 Future Enhancements

- Database integration (PostgreSQL/MongoDB)
- Real OCR service integration (Tesseract.js, Google Vision)
- AI service integration (OpenAI, Claude)
- File storage (AWS S3, local storage)
- Authentication and authorization
- API documentation (Swagger)
- Unit and integration tests
